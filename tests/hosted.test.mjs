import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {indexedDB} from 'fake-indexeddb';
import {load} from 'cheerio';

const origin = 'https://moduplant.vercel.app';
const plants = JSON.parse(readFileSync(new URL('../directory/plants.json', import.meta.url)));
const plant = plants.find(plant => plant.slug === 'hydrangea-macrophylla');

async function browserCatalogue(revision) {
  globalThis.indexedDB = indexedDB;
  const {loadHostedCatalogue} = await import('../dist/moduplant-app.js?test=' + revision);
  const catalogue = await loadHostedCatalogue();
  return async function request(path, method = 'GET', body) {
    return catalogue.route(new Request(origin + path, {
      method,
      headers: method === 'GET' ? {} : {'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    }));
  };
}

test('static deployment renders the catalogue and every direct plant URL', () => {
  const home = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const $ = load(home);
  assert.equal($('.plant-card').length, 12);
  assert.ok($('.mp-opening').length);
  assert.ok($('script[src="/demo/hosted.js"]').length);
  assert.ok($('script[data-moduplant-script][type="application/moduplant-script"]').length > 0);
  assert.ok(!home.includes('Abre el catálogo con el servidor local'));
  for (const plant of plants) {
    const html = readFileSync(new URL('../dist/plantas/' + plant.slug + '.html', import.meta.url), 'utf8');
    const page = load(html);
    assert.equal(page('h1').text(), plant.common_name);
    assert.equal(page('[data-gallery]').length, 3);
    assert.equal(page('.plant-faq').length, 4);
    assert.equal(page('details#fuentes').length, 1);
    assert.equal(page('details#fuentes[open]').length, 0);
    assert.ok(page('details#fuentes > summary h2').text().includes('Fuentes'));
    assert.ok(page('details#fuentes .source-entry').length > 0);
  }
});

test('published catalogue keeps edits, photos and mode after reloading the page', async () => {
  let request = await browserCatalogue('initial');
  const initial = load(await (await request('/plantas/' + plant.slug)).text());
  assert.equal(initial('h1').text(), plant.common_name);
  assert.equal(initial('[data-demo-edit]').length, 0);
  assert.equal((await request('/demo/modo', 'POST', {mode:'admin'})).status, 200);
  const admin = load(await (await request('/plantas/' + plant.slug)).text());
  const model = JSON.parse(admin('#demo-plant').text());
  assert.equal(model.slug, plant.slug);
  assert.ok(admin('[data-demo-edit]').length);

  const photo = readFileSync(new URL('../public/directory/photos/' + plant.photos[1] + '-thumb.webp', import.meta.url));
  const image = 'data:image/webp;base64,' + photo.toString('base64');
  const edits = {
    fields: {name: 'Hortensia de prueba', 'garden-note': 'Texto local de prueba.'},
    category: model.category,
    cover: plant.photos[1],
    photos: {[plant.photos[1]]: image},
    hidden: false,
    blocks: [{type:'highlight', title:'Módulo local', text:'Contenido de prueba.'}],
  };
  assert.equal((await request('/demo/editar/' + plant.slug, 'PUT', edits)).status, 200);
  request = await browserCatalogue('restart');
  const result = load(await (await request('/plantas/' + plant.slug)).text());
  assert.equal(result('h1').text(), 'Hortensia de prueba');
  assert.ok(result('.demo-custom-block').text().includes('Módulo local'));
  assert.equal(result('.mp-cultivation-note p').text(), 'Texto local de prueba.');
  const photoResponse = await request('/demo/foto/' + plant.slug + '/' + plant.photos[1]);
  assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), photo);
  const suggestions = await (await request('/sugerencias?q=hortensia')).json();
  assert.ok(suggestions.data.some(item => item.name === 'Hortensia de prueba'));
  const selected = load(await (await request('/?region=atlantica')).text());
  assert.equal(selected('.plant-card').length, 2);

  await request('/demo/modo', 'POST', {mode:'visitor'});
  request = await browserCatalogue('visitor');
  const visitor = load(await (await request('/plantas/' + plant.slug)).text());
  assert.equal(visitor('h1').text(), 'Hortensia de prueba');
  assert.equal(visitor('[data-demo-edit]').length, 0);
  assert.equal((await request('/demo/editar/' + plant.slug, 'DELETE')).status, 403);
  await request('/demo/modo', 'POST', {mode:'admin'});
  assert.equal((await request('/demo/editar/' + plant.slug, 'DELETE')).status, 200);
  const restored = load(await (await request('/plantas/' + plant.slug)).text());
  assert.equal(restored('h1').text(), plant.common_name);
  assert.equal(restored('.demo-custom-block').length, 0);
  assert.equal(await request('/directory/identity.css'), null);
});
