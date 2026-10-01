import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function panel() {
  const source = readFileSync(new URL('../backend/Admin.html', import.meta.url), 'utf8');
  const labels = source.slice(source.indexOf('const statusLabel'), source.indexOf('const kaizenStatusLabel'));
  const renderer = source.slice(source.indexOf('function showPanel(snapshot)'), source.indexOf('function openQrDialog(station)'));
  const nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, {hidden:false,textContent:'',innerHTML:'',value:'all',options:[{value:'all'}],querySelectorAll:()=>[]});
    return nodes.get(id);
  };
  const context = vm.createContext({state:{},el,document:{querySelectorAll:()=>[]},escapeHtml:value=>String(value??''),formatDate:value=>value,setView:()=>{}});
  vm.runInContext(labels + renderer, context);
  const render = station => {
    context.showPanel({week:'2026-W40',adminEmail:'admin@deteco.cl',permissions:{canConfigure:true,canRelease:true},stations:[{stationId:'oficina',stationName:'OFICINA',owner:'Ana',qrUrl:'',...station}]});
    return el('stations').innerHTML;
  };
  return {render,help:()=>el('refresh-help').textContent};
}

test('la prueba antigua abierta sin editor aparece pendiente, no como inspección activa', () => {
  const html = panel().render({status:'open',editorId:'',editorName:'',startedBy:'Prueba antigua',startedAt:'2026-09-30T18:09:00Z'});
  assert.match(html, />Pendiente</);
  assert.doesNotMatch(html, /En progreso|Prueba antigua|Sin editor|Sin reserva activa|No requiere liberación|2026-09-30/);
});

test('una reserva real conserva inspector, inicio y permiso para liberar', () => {
  const html = panel().render({status:'open',editorId:'phone-active',editorName:'Inspector actual',startedBy:'Inspector actual',startedAt:'2026-10-01T12:00:00Z'});
  assert.match(html, />En progreso</);
  assert.match(html, /Inspector actual/);
  assert.match(html, /Liberar estación/);
});

test('cerradas e incompletas conservan sus estados y no se presentan como pendientes', () => {
  const p = panel();
  assert.match(p.render({status:'closed',startedBy:'Inspector'}), />Cerrada</);
  assert.match(p.render({status:'expired',startedBy:'Inspector'}), />Cerrada incompleta</);
});

test('una consulta nueva muestra el cierre recibido sin conservar la tarjeta anterior', () => {
  const p = panel();
  assert.match(p.render({status:'open',editorId:'phone-active'}), />En progreso</);
  const html = p.render({status:'closed',editorId:''});
  assert.match(html, />Cerrada</);
  assert.doesNotMatch(html, /En progreso|Liberar estación/);
});

test('la consulta muestra una confirmación horaria visible sin prometer actualización automática', () => {
  const p = panel();
  p.render({status:'new'});
  assert.match(p.help(), /Última consulta:/);
  assert.match(p.help(), /Solo consulta/);
});
