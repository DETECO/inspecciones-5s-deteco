const MAX_UPLOAD_BYTES = 1450000;
const MAX_SOURCE_BYTES = 30000000;
const supportedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const cameraTypes = /^image\/(?:jpeg|jpg|png|webp|heic|heif|avif|bmp|gif)$/i;
const cameraExtensions = /\.(?:jpe?g|png|webp|heic|heif|avif|bmp|gif)$/i;

function dataUrl(blob, FileReaderApi) {
  return new Promise((resolve, reject) => {
    const reader = new FileReaderApi();
    reader.onerror = () => reject(new Error('No se pudo leer la fotografía. Inténtalo nuevamente.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function decodeImage(url, ImageApi) {
  return new Promise((resolve, reject) => {
    const image = new ImageApi();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Este navegador no pudo abrir la foto. Elige una fotografía JPG o PNG.'));
    image.src = url;
  });
}

function encodeJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob
      ? resolve(blob)
      : reject(new Error('No se pudo preparar la fotografía. Inténtalo nuevamente.')), 'image/jpeg', quality);
  });
}

export async function readImageForUpload(file, {
  ImageApi = globalThis.Image,
  FileReaderApi = globalThis.FileReader,
  documentApi = globalThis.document,
  urlApi = globalThis.URL,
} = {}) {
  if (!file || !(cameraTypes.test(file.type || '') || (!file.type && cameraExtensions.test(file.name || '')))) {
    throw new Error('El archivo debe ser una fotografía JPG, PNG o de cámara.');
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('La fotografía está vacía o no se pudo leer.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La fotografía supera 30 MB. Selecciona una imagen más pequeña.');
  if (supportedUploadTypes.has(file.type) && file.size <= MAX_UPLOAD_BYTES) return dataUrl(file, FileReaderApi);

  const url = urlApi.createObjectURL(file);
  let canvas;
  let image;
  try {
    // Native image decoding applies camera orientation before canvas resizing.
    image = await decodeImage(url, ImageApi);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!(width > 0 && height > 0)) throw new Error('No se pudo preparar la fotografía. Elige una imagen JPG o PNG.');
    canvas = documentApi.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la fotografía en este navegador.');
    let longSide = Math.min(1920, Math.max(width, height));
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const ratio = longSide / Math.max(width, height);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.74, 0.62, 0.5]) {
        const prepared = await encodeJpeg(canvas, quality);
        if (prepared.size <= MAX_UPLOAD_BYTES) return await dataUrl(prepared, FileReaderApi);
      }
      longSide = Math.floor(longSide * 0.8);
    }
    throw new Error('No se pudo reducir esta fotografía para guardarla. Toma otra foto o elige una imagen más pequeña.');
  } finally {
    urlApi.revokeObjectURL(url);
    if (image) image.src = '';
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
