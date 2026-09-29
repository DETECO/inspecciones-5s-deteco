const fs = require('node:fs');
const path = require('node:path');
const { buildCoreSource } = require('./build-core.cjs');

const base = __dirname;
const read = file => fs.readFileSync(path.join(base, file), 'utf8').trim();
const qrLibraryMarker = '/*__LOCAL_QR_LIBRARY__*/';

function buildAdminHtml() {
  const html = read('Admin.html');
  if (html.split(qrLibraryMarker).length !== 2) {
    throw new Error('Admin.html debe contener una única marca para el generador QR local.');
  }
  const qrLibrary = read('vendor/qrcode-generator-2.0.4.js');
  return html.replace(qrLibraryMarker, () => qrLibrary);
}

function writeDeploy(destination = path.join(base, 'deploy')) {
  fs.mkdirSync(destination, { recursive: true });
  const code = [read('Bridge.gs'), buildCoreSource().trim(), read('Service.gs'), read('Code.gs')].join('\n\n');
  const manifest = {
    timeZone: 'America/Santiago',
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
  };
  fs.writeFileSync(path.join(destination, 'Code.gs'), `${code}\n`, 'utf8');
  fs.writeFileSync(path.join(destination, 'Admin.html'), `${buildAdminHtml()}\n`, 'utf8');
  fs.writeFileSync(path.join(destination, 'appsscript.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return destination;
}

if (require.main === module) process.stdout.write(`${writeDeploy()}\n`);

module.exports = { buildAdminHtml, writeDeploy };
