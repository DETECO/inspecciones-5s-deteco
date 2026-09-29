function requireKey(key) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('La clave del borrador no es válida.');
  return key;
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = () => reject(new Error('No se pudo acceder al borrador local.'));
  });
}

export function createIndexedDraftStore({
  indexedDBApi = globalThis.indexedDB,
  databaseName = 'deteco-5s-offline',
  storeName = 'drafts',
} = {}) {
  if (!indexedDBApi?.open) throw new Error('Este navegador no permite guardar inspecciones sin conexión.');
  let databasePromise;

  function database() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDBApi.open(databaseName, 1);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      };
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = () => reject(new Error('No se pudo preparar el almacenamiento sin conexión.'));
    });
    return databasePromise;
  }

  async function store(mode) {
    return (await database()).transaction(storeName, mode).objectStore(storeName);
  }

  return {
    async load(key) {
      const value = await requestValue((await store('readonly')).get(requireKey(key)));
      return value === undefined ? null : value;
    },
    async save(key, value) {
      if (value === undefined) throw new Error('El borrador no es válido.');
      await requestValue((await store('readwrite')).put(value, requireKey(key)));
    },
    async remove(key) {
      await requestValue((await store('readwrite')).delete(requireKey(key)));
    },
  };
}
