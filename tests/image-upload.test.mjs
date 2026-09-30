import test from 'node:test';
import assert from 'node:assert/strict';

async function readImageForUpload(...args) {
  const module = await import('../client/image-upload.mjs').catch(() => {
    assert.fail('Falta la preparación automática de fotografías.');
  });
  return module.readImageForUpload(...args);
}

function browser({ width = 4000, height = 3000, sizeAt, decodeFails = false, encodeFails = false } = {}) {
  const encoded = [];
  const revoked = [];
  const backgrounds = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      fillRect: (...args) => backgrounds.push(args),
      drawImage: () => {},
    }),
    toBlob: (callback, type, quality) => {
      encoded.push({ width: canvas.width, height: canvas.height, type, quality });
      const size = sizeAt ? sizeAt(canvas.width, canvas.height, quality) : 500000;
      queueMicrotask(() => callback(encodeFails ? null : new Blob([new Uint8Array(size)], { type })));
    },
  };
  class ImageApi {
    naturalWidth = width;
    naturalHeight = height;
    set src(value) {
      if (!value) return;
      queueMicrotask(() => decodeFails ? this.onerror?.() : this.onload?.());
    }
  }
  class FileReaderApi {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      });
    }
  }
  return {
    encoded,
    revoked,
    backgrounds,
    options: {
      ImageApi,
      FileReaderApi,
      documentApi: { createElement: () => canvas },
      urlApi: { createObjectURL: () => 'blob:photo', revokeObjectURL: value => revoked.push(value) },
    },
  };
}

function photo(size, type = 'image/jpeg', name = 'camera.jpg') {
  const file = new Blob([new Uint8Array(size)], { type });
  Object.defineProperty(file, 'name', { value: name });
  return file;
}

function decodedSize(dataUri) {
  return Buffer.from(dataUri.split(',')[1], 'base64').length;
}

test('una foto de teléfono de 8 MB se prepara dentro de ambos límites del servidor', async () => {
  const native = browser();
  const result = await readImageForUpload(photo(8000000), native.options);
  assert.match(result, /^data:image\/jpeg;base64,/);
  assert.ok(decodedSize(result) <= 1450000);
  assert.ok(result.length < 2000000);
  assert.deepEqual([native.encoded[0].width, native.encoded[0].height], [1920, 1440]);
  assert.deepEqual(native.revoked, ['blob:photo']);
});

test('conserva sin modificar JPG, PNG y WebP pequeños', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const native = browser();
    const result = await readImageForUpload(photo(500, type), native.options);
    assert.equal(result, `data:${type};base64,${Buffer.alloc(500).toString('base64')}`);
    assert.equal(native.encoded.length, 0);
  }
});

test('recomprime una foto bajo 1,5 MB que excede el presupuesto seguro', async () => {
  const native = browser();
  const result = await readImageForUpload(photo(1499990), native.options);
  assert.ok(native.encoded.length > 0);
  assert.ok(result.length < 2000000);
});

test('reduce calidad y después resolución si una foto detallada todavía pesa demasiado', async () => {
  const native = browser({ sizeAt: (width, height, quality) => Math.ceil(width * height * quality * 2) });
  const result = await readImageForUpload(photo(8000000, 'image/png'), native.options);
  assert.ok(decodedSize(result) <= 1450000);
  assert.ok(native.encoded.some(item => item.quality < native.encoded[0].quality));
  assert.ok(native.encoded.some(item => item.width < 1920));
  assert.ok(native.backgrounds.length > 0);
});

test('mantiene proporción vertical y no amplía una imagen pequeña que requiere conversión', async () => {
  const native = browser({ width: 600, height: 900 });
  const result = await readImageForUpload(photo(1000, 'image/heic', 'camera.heic'), native.options);
  assert.match(result, /^data:image\/jpeg;base64,/);
  assert.deepEqual([native.encoded[0].width, native.encoded[0].height], [600, 900]);
});

test('convierte una foto de cámara sin MIME cuando su extensión es reconocida', async () => {
  const native = browser({ width: 3000, height: 4000 });
  const result = await readImageForUpload(photo(1000, '', 'IMG_1234.HEIC'), native.options);
  assert.match(result, /^data:image\/jpeg;base64,/);
  assert.deepEqual([native.encoded[0].width, native.encoded[0].height], [1440, 1920]);
});

test('rechaza archivos no fotográficos y fuentes mayores a 30 MB antes de decodificarlos', async () => {
  const native = browser();
  await assert.rejects(readImageForUpload(photo(50, 'application/pdf', 'doc.pdf'), native.options), /imagen|foto/i);
  await assert.rejects(readImageForUpload(photo(30000001), native.options), /30 MB/);
  assert.equal(native.revoked.length, 0);
});

test('explica cuando el navegador no puede decodificar HEIC y libera su URL', async () => {
  const native = browser({ decodeFails: true });
  await assert.rejects(readImageForUpload(photo(1000, 'image/heic', 'camera.heic'), native.options), /JPG|JPEG/);
  assert.deepEqual(native.revoked, ['blob:photo']);
});

test('informa un fallo del codificador y libera los recursos', async () => {
  const native = browser({ encodeFails: true });
  await assert.rejects(readImageForUpload(photo(8000000), native.options), /preparar|convertir/i);
  assert.deepEqual(native.revoked, ['blob:photo']);
});

test('no entrega una foto que sigue fuera de presupuesto tras todos los ajustes', async () => {
  const native = browser({ sizeAt: () => 1600000 });
  await assert.rejects(readImageForUpload(photo(8000000), native.options), /reducir|preparar/i);
  assert.ok(native.encoded.length < 100);
  assert.deepEqual(native.revoked, ['blob:photo']);
});
