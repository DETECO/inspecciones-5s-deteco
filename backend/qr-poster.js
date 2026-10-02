(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/qrcode-generator-2.0.4.js'));
  } else {
    root.app5sQrPoster = factory(root.qrcode);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (qrcode) {
  'use strict';

  const escapeXml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);

  function createQrPoster({ stationName, qrUrl, logoDataUri, scanIconDataUri }) {
    const name = String(stationName || '').trim().toLocaleUpperCase('es-CL');
    if (!name) throw new Error('Falta el nombre de la estación.');
    if (!qrUrl || typeof qrUrl !== 'string') throw new Error('Falta el enlace QR de la estación.');
    for (const asset of [logoDataUri, scanIconDataUri]) {
      if (!/^data:image\/(?:jpeg|png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(asset || '')) {
        throw new Error('El cartel requiere cada imagen embebida.');
      }
    }

    // Same literal payload and QR algorithm as the previous admin preview.
    // Four white modules on each side are retained, with no logo over the code.
    const qr = qrcode(0, 'M');
    qr.addData(qrUrl, 'Byte');
    qr.make();
    const modules = qr.getModuleCount();
    // Bound the complete code, not just its dark modules: footer artwork must
    // never overlap the four-module white border, even for a short URL.
    const qrSize = Math.min(795, 680 * (modules + 8) / modules);
    const quietZone = qrSize * 4 / (modules + 8);
    const qrSvg = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true })
      .replace('<svg ', `<svg id="station-qr" x="${(1080 - qrSize) / 2}" y="${565 - quietZone}" width="${qrSize}" height="${qrSize}" `);
    const fontSize = name.length <= 8 ? 188 : Math.max(64, Math.min(154, Math.round(1500 / name.length)));
    const nameWidth = Math.min(920, Math.round(name.length * fontSize * 0.745));
    const safeName = escapeXml(name);
    let nameMarkup = `<text id="station-name" x="540" y="${name.length <= 8 ? 382 : 355}" text-anchor="middle" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" font-weight="900" textLength="${nameWidth}" lengthAdjust="spacingAndGlyphs">${safeName}</text>`;
    if (name.length > 24) {
      const breaks = [...name.matchAll(/ /g)].map(match => match.index);
      const middle = breaks.length ? breaks.reduce((best, index) => Math.abs(index - name.length / 2) < Math.abs(best - name.length / 2) ? index : best) : Math.ceil(name.length / 2);
      const lines = [name.slice(0, middle).trim(), name.slice(middle).trim()];
      const lineSize = Math.max(70, Math.min(112, Math.round(1500 / Math.max(...lines.map(line => line.length)))));
      nameMarkup = '<g id="station-name">' + lines.map((line, index) => `<text class="station-name-line" x="540" y="${296 + index * 91}" text-anchor="middle" fill="#fff" font-family="Arial Black, Arial, sans-serif" font-size="${lineSize}" font-weight="900" textLength="${Math.min(920, Math.round(line.length * lineSize * 0.745))}" lengthAdjust="spacingAndGlyphs">${escapeXml(line)}</text>`).join('') + '</g>';
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440" width="1080" height="1440" role="img" aria-labelledby="poster-title">
<title id="poster-title">${safeName} · Inspección 5S · DETECO</title>
<rect width="1080" height="1440" fill="#fff"/>
<image href="${logoDataUri}" x="190" y="34" width="700" height="144" preserveAspectRatio="xMidYMid meet"/>
<rect y="200" width="1080" height="295" fill="#f26522"/>
${nameMarkup}
<text x="540" y="465" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="80" font-weight="900" textLength="610" lengthAdjust="spacingAndGlyphs">INSPECCIÓN 5S</text>
${qrSvg}
<image href="${scanIconDataUri}" x="158" y="1294" width="112" height="112"/>
<text x="306" y="1364" fill="#494741" font-family="Arial, sans-serif" font-size="65" font-weight="900" textLength="616" lengthAdjust="spacingAndGlyphs">Escanea para iniciar</text>
<rect y="1414" width="1080" height="26" fill="#f26522"/>
</svg>`;
  }

  return { createQrPoster };
}));
