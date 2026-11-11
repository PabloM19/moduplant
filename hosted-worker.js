import { createCatalogue, isCatalogueRoute } from './catalogue.mjs';

const templates = import.meta.glob('./directory/**/*.{html,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const openDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open('moduplant-hosted', 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('edits');
    request.result.createObjectStore('settings');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function read(storeName, key) {
  const database = await openDatabase;
  const store = database.transaction(storeName).objectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = key === undefined ? store.getAll() : store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write(storeName, key, value) {
  const database = await openDatabase;
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    if (value === null) store.delete(key);
    else store.put(value, key);
  });
}

let catalogue;
function loadCatalogue() {
  catalogue ??= Promise.all([read('edits'), read('settings', 'admin')]).then(([records, admin]) => {
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
  });
  return catalogue;
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !isCatalogueRoute(url.pathname)) return;
  event.respondWith(loadCatalogue()
    .then(async catalogue => (await catalogue.route(request)) ?? fetch(request))
    .catch(error => {
      console.error(error);
      if (request.mode === 'navigate') return fetch(request);
      return Response.json({error: 'No se ha podido abrir el catálogo en este navegador.'}, {status: 500});
    }));
});
