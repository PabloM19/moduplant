import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'vite';
import { createCatalogue } from '../catalogue.mjs';

const {route, slugs} = createCatalogue({
  source: name => readFileSync(new URL(`../directory/${name}`, import.meta.url), 'utf8'),
  hosted: true,
  mode: {isAdmin: () => false},
});

const dist = new URL('../dist/', import.meta.url);
await mkdir(new URL('plantas/', dist), {recursive: true});
await mkdir(new URL('plataforma/', dist), {recursive: true});

async function render(path, file, expectedStatus = 200) {
  const result = await route(new Request('https://moduplant.invalid' + path));
  if (result.status !== expectedStatus) throw new Error(`Error generando ${path}: ${result.status}`);
  await writeFile(new URL(file, dist), await result.text());
}

await render('/', 'index.html');
await render('/plataforma/directorio', 'plataforma/directorio.html');
await render('/plantas/ficha-no-disponible', '404.html', 404);
for (const slug of slugs) await render('/plantas/' + slug, 'plantas/' + slug + '.html');

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {entry: 'hosted-app.js', formats: ['es'], fileName: () => 'moduplant-app.js'},
  },
});
await writeFile(new URL('moduplant-worker.js', dist), `self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.registration.unregister()));`);
console.log(`Portada y ${slugs.length} fichas exportadas para el despliegue.`);
