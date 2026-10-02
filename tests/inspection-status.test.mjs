import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as catalog from '../domain/catalog.mjs';
import * as calendar from '../domain/calendar.mjs';
import * as inspection from '../domain/inspection.mjs';
import * as dailyManagement from '../domain/daily-management.mjs';
import { validateInspection } from '../domain/scoring.mjs';
import { validateKaizenReviews } from '../domain/kaizen.mjs';
import { createBridgeSession } from '../client/bridge-session.mjs';
import { parseQrRoute, scrubQrFragment } from '../client/route.mjs';

const moduleUrl = new URL('../client/inspection-status.mjs', import.meta.url);
const statusModule = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const baseline = { online:true, validated:true, serverConfirmed:true, now:new Date('2026-09-30T15:00:00Z'), clientId:'phone-a', inspection:{status:'new',schedule:calendar.DEFAULT_INSPECTION_SCHEDULE} };
function status(overrides={}) {
  assert.equal(typeof statusModule.inspectionStatus, 'function', 'Falta el cálculo único del semáforo');
  return statusModule.inspectionStatus({...baseline,...overrides});
}
test('verde solo con confirmación y horario permitido del servidor', () => {
  assert.equal(status().tone,'green');
  assert.equal(status({serverConfirmed:false}).tone,'amber');
  assert.equal(status({validated:false}).tone,'amber');
});
test('comprobando y enviando son ámbar', () => {
  assert.equal(status({checking:true}).tone,'amber');
  assert.equal(status({closing:true}).tone,'amber');
  assert.equal(status({closing:true,error:'Falló el primer intento.'}).tone,'amber');
});
test('fuera de horario y viernes cerrado son rojos con motivo', () => {
  const result=status({now:new Date('2026-10-02T15:00:00Z')});
  assert.equal(result.tone,'red');
  assert.match(result.reason,/horario/i);
});
test('usa horario configurado, no impone el predeterminado', () => {
  const schedule=structuredClone(calendar.DEFAULT_INSPECTION_SCHEDULE);
  schedule.days[4].enabled=true;
  assert.equal(status({now:new Date('2026-10-02T15:00:00Z'),inspection:{status:'new',schedule}}).tone,'green');
});
test('sin conexión, error o reserva ajena son rojos con motivo', () => {
  assert.match(status({online:false}).reason,/internet|conexión/i);
  assert.equal(status({error:'No se pudo validar el QR.'}).tone,'red');
  assert.equal(status({inspection:{...baseline.inspection,status:'open',editor:{clientId:'phone-b',inspectorName:'Otro inspector'}}}).tone,'red');
});
test('cierre confirmado no se confunde con disponibilidad de nueva inspección', () => {
  const result=status({inspection:{status:'closed'}});
  assert.equal(result.label,'Guardada');
  assert.equal(result.tone,'green');
  assert.equal(status({inspection:{status:'closed'},identity:true}).tone,'red');
});

function harness(reply) {
  const calls=[], listeners={}, dialogs={opened:0,closed:0}, timers=new Map();
  let phoneTime='2026-10-02T15:00:00Z',timerId=0;
  let html='',renders=0;
  const app={get innerHTML(){return html;},set innerHTML(value){html=value;renders++;},addEventListener:(event,fn)=>{listeners[event]=fn;},querySelector:()=>null};
  const route={stationId:'oficina',accessToken:'t'.repeat(32)};
  const storage={getItem:()=>null,setItem(){}};
  const session={getItem:()=>JSON.stringify(route),setItem(){}};
  class PhoneDate extends Date { constructor(...args){super(...(args.length?args:[phoneTime]));} }
  const context=vm.createContext({ ...catalog,...calendar,...inspection,...dailyManagement,...statusModule,parseQrRoute,scrubQrFragment,validateInspection,validateKaizenReviews,createBridgeSession,
    resolveAppConfig:()=>({mode:'bridge',bridgeEndpoint:'test'}),createFormBridge:()=>({send:async request=>{calls.push(request);return typeof reply==='function'?reply(request):reply;}}),
    localStorage:storage,sessionStorage:session,crypto:{randomUUID:()=> 'phone-a'},navigator:{onLine:true},Date:PhoneDate,URL,URLSearchParams,
    history:{replaceState(){}},document:{title:'Prueba',activeElement:null,querySelector:selector=>selector==='#app'?app:selector==='#inspection-status-dialog'?{showModal(){dialogs.opened++;},close(){dialogs.closed++;}}:null},
    window:{DETECO_5S_CONFIG:{},location:{href:'https://deteco.github.io/inspecciones-5s-deteco/'},addEventListener:(event,fn)=>{listeners[event]=fn;},setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);},matchMedia:()=>({matches:true})} });
  const source=readFileSync(new URL('../client/app.mjs',import.meta.url),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm,'').replace(/initializeApp\(\);\s*$/,'');
  vm.runInContext(source+'\nglobalThis.api={state,initializeApp,render,validateStationAccess,openScanner};',context);
  return {...context.api,app,calls,listeners,dialogs,timers,renders:()=>renders,setPhoneTime:value=>{phoneTime=value;}};
}
const receipt={state:{...inspection.createInspection({stationId:'oficina',week:'2026-W40'}),schedule:calendar.DEFAULT_INSPECTION_SCHEDULE},station:{id:'oficina',name:'OFICINA'},inspectorNames:[],receivedAt:'2026-09-30T15:00:00Z'};
test('consulta final-state sin reservar y muestra verde con hora del servidor aunque teléfono marque viernes',async()=>{
  const h=harness(receipt);
  await h.initializeApp();
  assert.deepEqual(h.calls.map(call=>call.operation),['final-state']);
  assert.match(h.app.innerHTML,/status-green/);
  assert.match(h.app.innerHTML,/data-action="show-inspection-status"/);
  assert.doesNotMatch(h.app.innerHTML,/El servidor comprobará|Validando el QR|Listo para validar/);
});
test('rojo fuera de horario muestra motivo en diálogo y bloquea inicio',async()=>{
  const h=harness({...receipt,receivedAt:'2026-10-02T15:00:00Z'});
  await h.initializeApp();
  assert.match(h.app.innerHTML,/status-red/);
  assert.match(h.app.innerHTML,/data-action="start" disabled/);
  assert.doesNotMatch(h.app.innerHTML,/<div class="notice danger">/);
  h.listeners.click({target:{closest:()=>({dataset:{action:'show-inspection-status'}})}});
  assert.equal(h.dialogs.opened,1);
});
test('error del servidor queda en detalle, reintento preserva nombre y recupera disponibilidad',async()=>{
  let fail=true;
  const h=harness(()=>{if(fail)throw new Error('El acceso del QR no es válido.');return receipt;});
  await h.initializeApp();
  h.state.inspectorName='Inspector prueba';
  assert.match(h.app.innerHTML,/status-red/);
  assert.match(h.app.innerHTML,/El acceso del QR no es válido/);
  assert.doesNotMatch(h.app.innerHTML,/<div class="notice/);
  fail=false;
  await h.validateStationAccess();
  assert.equal(h.state.inspectorName,'Inspector prueba');
  assert.match(h.app.innerHTML,/status-green/);
  assert.equal(h.calls.length,2);
});
test('la comprobación de disponibilidad jamás reemplaza respuestas de una inspección en curso',async()=>{
  const h=harness(receipt);
  await h.initializeApp();
  h.state.screen='module';
  h.state.inspection.answers={'separar-1':2};
  await h.validateStationAccess();
  assert.equal(h.calls.length,1);
  assert.equal(h.state.inspection.answers['separar-1'],2);
});
test('sin hora del servidor nunca habilita verde ni iniciar',async()=>{
  const h=harness({...receipt,receivedAt:undefined});
  await h.initializeApp();
  assert.doesNotMatch(h.app.innerHTML,/status-green/);
  assert.match(h.app.innerHTML,/data-action="start" disabled/);
});
test('el color cambia al vencer horario sin peticiones ni reemplazar el nombre',async()=>{
  const h=harness(receipt);
  await h.initializeApp();
  h.state.inspectorName='Inspector prueba';
  const tick=[...h.timers.values()].find(timer=>timer.ms===30000);
  assert.ok(tick,'El indicador debe actualizar su horario sin consultas periódicas');
  h.setPhoneTime('2026-10-02T22:00:00Z');
  tick.fn();
  assert.match(h.app.innerHTML,/status-red/);
  assert.equal(h.calls.length,1);
  assert.equal(h.state.inspectorName,'Inspector prueba');
});
test('volver al navegador no reemplaza el visor de cámara',async()=>{
  const h=harness(receipt);
  await h.initializeApp();
  h.state.screen='scanner';
  const html=h.app.innerHTML;
  h.listeners.focus();
  assert.equal(h.app.innerHTML,html);
});
test('una validación anterior no vuelve a dibujar ni borra el visor de un nuevo escaneo',async()=>{
  let resolveReply;
  const h=harness(()=>new Promise(resolve=>{resolveReply=resolve;}));
  const boot=h.initializeApp();
  h.openScanner();
  const renders=h.renders();
  resolveReply(receipt);
  await boot;
  assert.equal(h.renders(),renders);
  assert.equal(h.state.screen,'scanner');
  assert.equal(h.state.qrAccessValidated,false);
});
