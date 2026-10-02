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
  const posterMarker = '/*__QR_POSTER_LIBRARY__*/';
  if (html.split(posterMarker).length !== 2) throw new Error('Admin.html requiere una marca para el cartel QR.');
  const posterAssets = {
    logoDataUri: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(base, '../assets/deteco-wordmark.jpg')).toString('base64'),
    scanIconDataUri: 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(base, '../assets/icons/scan.svg'), 'utf8').replace(/currentColor/g, '#494741')).toString('base64'),
  };
  const posterLibrary = 'var app5sQrPosterAssets = ' + JSON.stringify(posterAssets) + ';\n' + read('qr-poster.js');
  const configMarker = '/*__ADMIN_CONFIG_LIBRARY__*/';
  if (html.split(configMarker).length !== 2) throw new Error('Admin.html requiere una marca de configuración administrativa.');
  return html.replace(qrLibraryMarker, () => qrLibrary).replace(posterMarker, () => posterLibrary).replace(configMarker, () => read('admin-settings-ui.js'));
}

function writeDeploy(destination = path.join(base, 'deploy')) {
  fs.mkdirSync(destination, { recursive: true });
  const code = [read('Bridge.gs'), buildCoreSource().trim(), read('Service.gs'), read('AdminSettings.gs'), read('Notifications.gs'), read('FinalSubmission.gs'), read('Code.gs')].join('\n\n');
  const manifest = {
    timeZone: 'America/Santiago',
    exceptionLogging: 'STACKDRIVER',
    runtimeVersion: 'V8',
    webapp: {
      executeAs: 'USER_DEPLOYING',
      access: 'ANYONE_ANONYMOUS',
    },
  };
  fs.writeFileSync(path.join(destination, 'Code.gs'), `${code}\n`, 'utf8');
  fs.writeFileSync(path.join(destination, 'Admin.html'), `${buildAdminHtml()}\n`, 'utf8');
  fs.writeFileSync(path.join(destination, 'appsscript.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return destination;
}

if (require.main === module) process.stdout.write(`${writeDeploy()}\n`);

module.exports = { buildAdminHtml, writeDeploy };
