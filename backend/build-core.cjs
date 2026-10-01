const fs = require('node:fs');
const path = require('node:path');

const domainDirectory = path.join(__dirname, '..', 'domain');
const orderedModules = ['catalog.mjs', 'scoring.mjs', 'kaizen.mjs', 'daily-management.mjs', 'inspection.mjs', 'calendar.mjs'];

function transpile(source) {
  return source
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/\bexport\s+const\b/g, 'const')
    .replace(/\bexport\s+function\b/g, 'function');
}

function buildCoreSource() {
  const header = '// Generado por build-core.cjs desde app/domain/. No editar directamente.\n';
  const modules = orderedModules.map(file => transpile(fs.readFileSync(path.join(domainDirectory, file), 'utf8').trim()));
  return `${header}\n${modules.join('\n\n')}\n`;
}

function writeCoreFile(destination = path.join(__dirname, 'deploy', 'Core.gs')) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buildCoreSource(), 'utf8');
  return destination;
}

if (require.main === module) process.stdout.write(`${writeCoreFile()}\n`);

module.exports = { buildCoreSource, writeCoreFile };
