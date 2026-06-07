const ConsentStorage = (() => {
  const DB_NAME = 'ConsentimientosDB';
  const STORE_NAME = 'consentimientos';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('rut', 'rut', { unique: false });
          store.createIndex('nombre', 'nombre', { unique: false });
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        reject(event.target.error);
      };
    });

    return dbPromise;
  }

  async function saveConsent(data) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `consent-${Date.now()}`;
    const record = {
      id,
      createdAt: new Date().toISOString(),
      fecha: data.fecha,
      nombre: data.nombre,
      rut: data.rut,
      tipo: data.tipo,
      tratamiento: data.tratamiento,
      autorizacion: data.autorizacion,
      archivo: data.archivo,
      pdfBytes: data.pdfBytes
    };
    store.put(record);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(record);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function getAllConsents() {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const records = request.result || [];
        records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function getConsentById(id) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteConsentById(id) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function deleteConsentsByIds(ids) {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    saveConsent,
    getAllConsents,
    getConsentById,
    deleteConsentById,
    deleteConsentsByIds
  };
})();
