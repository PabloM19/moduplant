import { createCatalogue } from './catalogue.mjs';

const templates = import.meta.glob('./directory/**/*.{html,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export async function loadHostedCatalogue() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('moduplant-hosted', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('edits');
      request.result.createObjectStore('settings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra las otras pestañas de ModuPlant y vuelve a intentarlo.'));
  });

  function read(storeName, key) {
    const store = database.transaction(storeName).objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = key === undefined ? store.getAll() : store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function write(storeName, key, value) {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      if (value === null) store.delete(key);
      else store.put(value, key);
    });
  }

  const [records, admin] = await Promise.all([read('edits'), read('settings', 'admin')]);
  let isAdmin = admin === true;
  return createCatalogue({
    source: name => templates['./directory/' + name],
    hosted: true,
    changes: Object.fromEntries(records.map(record => [record.slug, record.change])),
    saveChange: (slug, change) => write('edits', slug, change ? {slug, change} : null),
    mode: {
      isAdmin: () => isAdmin,
      async setAdmin(value) {
        await write('settings', 'admin', value);
        isAdmin = value;
      },
    },
  });
}
