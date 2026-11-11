import { load } from 'cheerio';
import { blockTypes, blockMarkup, shortSafety } from './public/demo/blocks.js';

const origin = 'http://127.0.0.1:8780';

export function isCatalogueRoute(path) {
  const cleanPath = path.replace(/\/$/, '') || '/';
  return ['/', '/plataforma/directorio', '/sugerencias', '/favoritos', '/demo/modo', '/demo/enlace'].includes(cleanPath)
    || ['/plantas/', '/demo/foto/', '/demo/editar/'].some(prefix => cleanPath.startsWith(prefix));
}

function respond(status, body, type = 'application/json; charset=utf-8', extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', type);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(type.startsWith('application/json') ? JSON.stringify(body) : body, {status, headers});
}

async function readBody(req) {
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) {
        await reader.cancel();
        throw new Error('El formulario supera el tamaño máximo.');
      }
      text += decoder.decode(value, {stream: true});
    }
  }
  return JSON.parse(text + decoder.decode());
}

export function createCatalogue({source, changes = {}, saveChange, mode, hosted = false}) {
  const plants = JSON.parse(source('plants.json'));
  const bySlug = new Map(plants.map(plant => [plant.slug, plant]));
  const shell = source('shell.html');
  const chrome = load(source('moduplant.html'), {}, false);
  const opening = chrome('#mp-opening').html();
  const regionalNotes = JSON.parse(source('regional-notes.json'));
  const noteField = 'garden-note';
  const noteFieldLabel = 'Consejo de cultivo';
  const catalogue = source('catalogue.html');
  const savedCatalogue = load(source('saved.html'))('main').html();
  const emptyCatalogue = source('empty.html');
  const emptySaved = source('saved-empty.html');
  const categories = Object.fromEntries(load(catalogue)('.collection-categories a').toArray().slice(1).map(node => {
    const $ = load(node);
    return [new URL($('a').attr('href'), origin).searchParams.get('category'), $('a').text().trim()];
  }));
  const exposures = Object.fromEntries(load(catalogue)('.catalogue-exposure label').toArray().map(node => {
    const $ = load(node);
    return [$('input').val(), $('span').text()];
  }));
  let pending = Promise.resolve();
  function persist(slug, change) {
    const operation = pending.then(async () => {
      await saveChange(slug, change);
      if (change) changes[slug] = change;
      else delete changes[slug];
    });
    pending = operation.catch(() => {});
    return operation;
  }

  function validatedChange(plant, input) {
    const fields = {};
    for (const [key, value] of Object.entries(input.fields ?? {})) {
      if ((!Object.hasOwn(plant.fields, key) && key !== noteField) || typeof value !== 'string' || value.length > 5000) throw new Error('Revisa los campos de la ficha.');
      if (['name', 'scientific'].includes(key) && (!value.trim() || value.length > 180)) throw new Error('Escribe un nombre válido.');
      fields[key] = value.trim();
    }
    const {category, cover, hidden, photos, blocks} = input;
    if (!Object.hasOwn(categories, category) || !plant.photos.includes(cover) || typeof hidden !== 'boolean') throw new Error('Revisa la categoría y la portada.');
    if (!Array.isArray(blocks) || blocks.length > 20) throw new Error('Puedes añadir hasta 20 bloques.');
    const customBlocks = blocks.map(block => {
      if (!Object.hasOwn(blockTypes, block.type) || typeof block.title !== 'string' || typeof block.text !== 'string' || block.title.length > 180 || block.text.length > 5000) throw new Error('Revisa el contenido de los bloques.');
      return {type: block.type, title: block.title.trim(), text: block.text.trim()};
    });
    const localPhotos = {};
    for (const [id, photo] of Object.entries(photos ?? {})) {
      if (!plant.photos.includes(id)) throw new Error('Revisa las fotografías.');
      if (photo === true && changes[plant.slug]?.photos?.[id]) {
        localPhotos[id] = changes[plant.slug].photos[id];
        continue;
      }
      if (typeof photo !== 'string' || photo.length > 800_000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(photo)) throw new Error('No se pudo guardar una fotografía.');
      const signature = atob(photo.split(',')[1].slice(0, 16));
      if (signature.slice(0, 4) !== 'RIFF' || signature.slice(8, 12) !== 'WEBP') throw new Error('Formato de fotografía incorrecto.');
      localPhotos[id] = photo;
    }
    return {fields, category, cover, hidden, photos: localPhotos, blocks: customBlocks};
  }

  const clean = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const collator = new Intl.Collator('es', {sensitivity: 'base'});
  function plantName(plant) { return changes[plant.slug]?.fields.name ?? plant.common_name; }
  function scientificName(plant) { return changes[plant.slug]?.fields.scientific ?? plant.scientific_name; }
  function categoryFor(plant) { return changes[plant.slug]?.category ?? plant.category; }
  function photoUrl(plant, id, thumb = false) {
    return changes[plant.slug]?.photos[id] ? `/demo/foto/${plant.slug}/${id}` : `/directory/photos/${id}${thumb ? '-thumb' : ''}.webp`;
  }
  function plantPath(plant) { return `/plantas/${plant.slug}`; }
  function resultUrl(params, updates = {}) {
    const result = new URLSearchParams(params);
    for (const [key, value] of Object.entries(updates)) {
      result.delete(key);
      if (value != null) (Array.isArray(value) ? value : [value]).forEach(item => result.append(key, String(item)));
    }
    const query = result.toString();
    return `/${query ? '?' + query : ''}#plantas`;
  }
  function parseFilters(query) {
    return {
      q: query.get('q')?.trim().slice(0, 180) || '',
      category: query.get('category') || '',
      family: query.get('family') || '',
      atlantic: query.get('region') === 'atlantica',
      exposure: query.getAll('exposure[]').filter(value => Object.hasOwn(exposures, value)),
      saved: query.has('saved') ? new Set((query.get('saved') ?? '').split(',')) : null,
      view: query.get('view') === 'comfortable' ? 'comfortable' : 'compact',
      perPage: query.get('per_page') === '24' ? 24 : 12,
      sort: query.get('sort') || 'name_asc',
    };
  }
  function filterPlants(filters, showHidden) {
    const words = clean(filters.q).split(/\s+/).filter(Boolean);
    return plants.filter(plant => {
      if ((!showHidden && changes[plant.slug]?.hidden) || (filters.saved && !filters.saved.has(plant.id))) return false;
      if (filters.atlantic && !Object.hasOwn(regionalNotes, plant.slug)) return false;
      if (filters.category && categoryFor(plant) !== filters.category) return false;
      if (filters.family && plant.family !== filters.family) return false;
      if (filters.exposure.length && !filters.exposure.some(exposure => plant.exposure.includes(exposure))) return false;
      const names = clean([plantName(plant), scientificName(plant), plant.slug.replaceAll('-', ' '), ...plant.synonyms].join(' '));
      return words.every(word => names.includes(word));
    }).sort((a, b) => filters.sort === 'scientific'
      ? collator.compare(scientificName(a), scientificName(b))
      : collator.compare(plantName(a), plantName(b)) * (filters.sort === 'name_desc' ? -1 : 1));
  }

  function renderCard(plant, isAdmin, categoryUrl) {
    const $ = load(plant.card, {}, false);
    const changesForPlant = changes[plant.slug];
    if (changesForPlant) {
      const name = plantName(plant);
      $('.card-content h3 a').text(name);
      $('.scientific').text(scientificName(plant));
      $('[data-save]').attr('data-plant-name', name);
      $('.card-photo img').attr({src: photoUrl(plant, changesForPlant.cover, true), alt: name});
      if (changesForPlant.fields.light) $('.card-info span').first().text(changesForPlant.fields.light);
    }
    $('.card-category').attr('href', categoryUrl).text(categories[categoryFor(plant)]);
    if (isAdmin) {
      const edit = $('<a class="demo-card-edit">Editar ficha</a>').attr({href: plantPath(plant) + '?editar=1', 'aria-label': `Editar ficha de ${plantName(plant)}`});
      $('.card-content').append(edit);
      if (changesForPlant?.hidden) $('.card-content').append('<span class="demo-hidden-label">Oculta al público</span>');
    }
    return $.html();
  }

  function pagination($, query, page, pages, first, last, total) {
    const nav = $('.catalogue-pagination');
    if (!total) { nav.remove(); return; }
    nav.find('.catalogue-pagination-summary p').first().text(`Mostrando ${first} a ${last} de ${total} resultados`);
    nav.find('.catalogue-pagination-summary p').last().empty().append('Página ', $('<strong>').text(page), ` de ${pages}`);
    const links = nav.find('.catalogue-page-navigation').empty();
    const direction = (number, label, arrow) => {
      const valid = number >= 1 && number <= pages;
      const node = valid ? $('<a>').attr('href', resultUrl(query, {page: number})) : $('<span>').attr('aria-disabled', 'true');
      return node.addClass('catalogue-page-direction').text(label + ' ' + arrow);
    };
    const list = $('<ul class="catalogue-page-list">');
    for (let i = 1; i <= pages; i++) {
      const item = $('<li>').toggleClass('catalogue-page-distant', Math.abs(i - page) > 1);
      const link = i === page ? $('<span aria-current="page">') : $('<a>').attr({href: resultUrl(query, {page: i}), 'aria-label': `Ir a la página ${i}`});
      list.append(item.append(link.text(i)));
    }
    links.append(direction(page - 1, 'Anterior', '←'), list, direction(page + 1, 'Siguiente', '→'));
  }

  function renderCatalogue(query, isAdmin) {
    const filters = parseFilters(query);
    const {q, category, family, exposure, atlantic, saved, view, sort, perPage} = filters;
    const results = filterPlants(filters, isAdmin);
    const total = results.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.min(pages, Math.max(1, parseInt(query.get('page'), 10) || 1));
    const first = (page - 1) * perPage;
    const last = Math.min(first + perPage, total);
    const filtersActive = Boolean(q || category || family || exposure.length || atlantic);
    const $ = load(saved ? savedCatalogue : catalogue, {}, false);
    if (!saved && !filtersActive) {
      $('.live-catalogue').before(opening);
      const featured = ['hydrangea-macrophylla', 'camellia-japonica'].map(slug => bySlug.get(slug))
        .find(plant => plant && (isAdmin || !changes[plant.slug]?.hidden));
      if (featured) {
        const edit = changes[featured.slug];
        $('.mp-opening-photo img').attr({src: photoUrl(featured, edit?.cover ?? featured.photos[2]), alt: ''});
        $('.mp-opening-photo a').attr('href', plantPath(featured)).text(plantName(featured) + ' ')
          .append('<span aria-hidden="true">↗</span>');
      } else {
        $('.mp-opening-photo').remove();
      }
    }
    if (!saved) {
      const title = q ? `Resultados para «${q}»` : atlantic ? 'Selección atlántica' : 'Catálogo de plantas';
      $('.section-heading .eyebrow').remove();
      $('#catalogue-query').attr('placeholder', 'Por ejemplo, hortensia o camelia');
      $('.section-heading h2').replaceWith($(filtersActive ? '<h1>' : '<h2>').text(title));
    }
    if (atlantic) {
      $('.catalogue-controls').prepend('<input type="hidden" name="region" value="atlantica">');
      $('.collection-categories a').first().text('Toda la selección');
    }
    $('[data-result-count]').text(saved ? `${total} ${total === 1 ? 'planta favorita' : 'plantas favoritas'}` : `${total} ${total === 1 ? 'planta' : 'plantas'}`);
    $('input[name="category"]').val(category);
    $('input[name="q"]').val(q);
    $('input[name="view"]').val(view);
    $('input[name="saved"]').val(query.get('saved') ?? '');
    $('select[name="category"]').val(category);
    $('select[name="family"]').val(family);
    $('select[name="sort"]').val(sort);
    $('select[name="per_page"]').val(String(perPage));
    $('input[name="exposure[]"]').each((_, node) => $(node).prop('checked', exposure.includes($(node).val())));
    const activeCount = Number(Boolean(family)) + Number(Boolean(exposure.length)) + Number(Boolean(saved && category));
    $('[data-catalogue-filter-fields]').attr('data-active-filters', activeCount);
    if (activeCount) $('[data-catalogue-filter-toggle] .catalogue-chevron').before($('<b>').text(activeCount));
    $('.collection-categories a').each((_, node) => {
      const link = $(node);
      const type = new URL(link.attr('href'), origin).searchParams.get('category') || '';
      link.attr('href', resultUrl(query, {category: type || null, page: null}));
      link.removeAttr('aria-current');
      if (type === category) link.attr('aria-current', 'page');
    });
    $('.catalogue-view-switch a').each((index, node) => {
      const type = index ? 'comfortable' : 'compact';
      $(node).attr('href', resultUrl(query, {view: type})).removeAttr('aria-current');
      if (type === view) $(node).attr('aria-current', 'true');
    });
    $('.favorite-nav').attr('data-directory-url', resultUrl(new URLSearchParams({view, sort, per_page: perPage})));
    if (saved || atlantic) $('[data-suggestions-url]').attr('data-suggestions-url', '/sugerencias?' + query);
    const range = $('.catalogue-result-range').empty();
    if (total) range.append($('<strong>').text(`${first + 1}–${last}`), ` de ${total} plantas`);
    else range.text('Sin resultados');
    const grid = $('.catalogue-grid').removeClass('catalogue-grid--compact catalogue-grid--comfortable').addClass('catalogue-grid--' + view).attr('data-catalogue-view', view).empty();
    for (const plant of results.slice(first, last)) {
      grid.append(renderCard(plant, isAdmin, resultUrl(saved ? query : new URLSearchParams(), {category: categoryFor(plant), page: null})));
    }
    if (!total) grid.append(saved && !filtersActive ? emptySaved : emptyCatalogue);
    if (saved && !total && !filtersActive) $('.catalogue-controls').remove();
    $('.catalogue-active-filters').remove();
    if (filtersActive) {
      const active = $('<div class="catalogue-active-filters" aria-label="Filtros aplicados">');
      const chip = (label, updates) => $('<a>').attr({href: resultUrl(query, {...updates, page: null}), 'aria-label': `Quitar filtro ${label}`}).append($('<span>').text(label), '<span aria-hidden="true">×</span>');
      if (q) active.append(chip(q, {q: null}));
      if (category && categories[category]) active.append(chip(categories[category], {category: null}));
      if (family) active.append(chip(family, {family: null}));
      if (atlantic) active.append(chip('Selección atlántica', {region: null}));
      exposure.forEach(value => active.append(chip(exposures[value], {'exposure[]': exposure.filter(item => item !== value)})));
      const clear = resultUrl(query, {q: null, category: null, family: null, 'exposure[]': null, region: null, page: null});
      active.append($('<a class="catalogue-clear-filters">Limpiar filtros</a>').attr('href', clear));
      $('.catalogue-controls').after(active);
      $('.catalogue-filter-actions').append($('<a>Limpiar filtros</a>').attr('href', clear));
    }
    pagination($, query, page, pages, first + 1, last, total);
    return $.html();
  }

  function renderPlant(plant, isAdmin) {
    const $ = load(source(`details/${plant.slug}.html`), {}, false);
    const edit = changes[plant.slug];
    const fields = Object.fromEntries(Object.keys(plant.fields).map(key => [key, $(dataField(key)).first().text().trim()]));
    const regionalNote = regionalNotes[plant.slug];
    fields[noteField] = regionalNote?.text ?? '';
    const noteText = edit?.fields[noteField] ?? fields[noteField];
    const note = $('<section class="mp-cultivation-note" aria-labelledby="mp-cultivation-title">').append(
      $('<h2 id="mp-cultivation-title">').text(noteFieldLabel),
      $('<p>').attr('data-edit-field', noteField).text(noteText),
    );
    if (regionalNote) {
      const link = $('<a data-cultivation-source>').attr('href', regionalNote.url).text(regionalNote.source);
      if (noteText !== regionalNote.text) link.attr('hidden', '');
      note.append(link);
    }
    if (!noteText) note.attr('hidden', '');
    layoutPlant($, note);
    const originalPhoto = id => `/directory/photos/${id}.webp`;
    const originalThumb = id => `/directory/photos/${id}-thumb.webp`;
    const originals = plant.photos.map(id => {
      const button = $('[data-gallery]').filter((_, node) => $(node).attr('data-gallery') === originalPhoto(id)).first();
      return {id, url: originalPhoto(id), thumb: originalThumb(id), alt: button.attr('data-alt') || plant.common_name};
    });
    if (edit) {
      for (const [field, value] of Object.entries(edit.fields)) $(dataField(field)).text(value);
      if (Object.hasOwn(edit.fields, 'safety')) $('[data-edit-summary="safety"]').text(shortSafety(edit.fields.safety));
      if (edit.category !== plant.category) $('.live-detail-heading .eyebrow').text(`${categories[edit.category]} · ${plant.family}`);
      if (edit.fields.name) $('[data-save]').attr('data-plant-name', plantName(plant));
      if (edit.cover !== plant.photos[0]) {
        const buttons = $('[data-gallery]');
        buttons.filter((_, node) => $(node).attr('data-gallery') === originalPhoto(edit.cover)).prependTo('.live-thumbnails');
      }
      $('[data-gallery]').each((index, node) => {
        const button = $(node);
        const original = originals.find(photo => photo.url === button.attr('data-gallery'));
        if (!original) return;
        const custom = Boolean(edit.photos[original.id]);
        const alt = custom ? `${plantName(plant)} · Foto personalizada` : original.alt;
        button.toggleClass('selected', index === 0).attr({
          'data-gallery': photoUrl(plant, original.id),
          'data-photo-id': original.id,
          'data-alt': alt,
          'aria-label': `Ver fotografía ${index + 1} de ${plant.photos.length}`,
          'aria-pressed': String(index === 0),
        });
        button.find('img').attr('src', photoUrl(plant, original.id, true));
        button.find('.thumbnail-error').text(`Foto ${index + 1}`);
        if (index === 0) $('#main-photo').attr({src: photoUrl(plant, original.id), alt});
      });
    } else {
      $('[data-gallery]').each((index, node) => $(node).attr('data-photo-id', plant.photos[index]));
    }
    if (isAdmin && edit?.hidden) $('.live-detail-heading').append('<p class="demo-hidden-label">Oculta al público</p>');
    const blocks = $('<div class="wrap demo-custom-blocks" id="demo-custom-blocks">').html(blockMarkup(edit?.blocks ?? []));
    $('.live-sources').before(blocks);
    const model = isAdmin ? {
      slug: plant.slug,
      fields,
      fieldLabels: {...plant.fields, [noteField]: noteFieldLabel},
      family: plant.family,
      categories,
      category: plant.category,
      photos: originals,
      edits: edit ? {...edit, photos: Object.fromEntries(Object.keys(edit.photos).map(id => [id, true]))} : null,
    } : null;
    return {html: $.html(), model};
  }

  function layoutPlant($, note) {
    const hero = $('.live-detail-hero').addClass('mp-plant-overview');
    const heading = hero.children('.live-detail-heading');
    const intro = hero.children('.live-plant-intro');
    const gallery = hero.children('.live-gallery');
    const quickCare = intro.children('.quick-care');
    const careLink = intro.children('a[href="#cuidados"]').addClass('mp-section-link').text('Ver todos los cuidados →');

    intro.children('.live-introduction').after(heading.children('.safety-summary'));
    hero.prepend($('<div class="mp-overview-copy">').append(heading, intro));
    gallery.append($('<div class="mp-gallery-tools">').append(gallery.children('.gallery-status, .gallery-fit-toggle')));
    gallery.children('.gallery-zoom-hint').remove();

    quickCare.children('.eyebrow').remove();
    quickCare.find('[data-exposure-trigger]').each((_, node) => {
      const trigger = $(node);
      const label = trigger.next('.exposure-tooltip').children('strong').first().text().trim();
      if (label) trigger.append($('<span class="mp-care-label" aria-hidden="true">').text(label));
    });
    const glance = $('<section class="wrap mp-glance" aria-labelledby="mp-glance-title">').append(
      $('<div class="mp-section-heading">').append($('<h2 id="mp-glance-title">').text('Cuidados de un vistazo'), careLink),
      quickCare,
      note,
    );
    hero.after(glance);
    $('.plant-faq-heading .eyebrow, .live-extras > .eyebrow, .live-sources > .eyebrow').remove();
    $('.plant-faq-number').remove();
  }

  function dataField(key) { return `[data-edit-field="${key}"]`; }

  function renderPage(content, {title, isAdmin, model = null, atlantic = false}) {
    const $ = load(shell);
    $('title').text(`${title} · ModuPlant`);
    $('meta[name="description"]').attr('content', 'Explora el catálogo de plantas y sus cuidados en ModuPlant.');
    $('link[rel~="icon"], link[rel="apple-touch-icon"], head > style, script[src="/directory/website-chrome.js"]').remove();
    $('head').append('<link rel="stylesheet" href="/demo/moduplant.css">');
    if (hosted) $('head').prepend('<script src="/demo/hosted.js"></script>');
    $('#moduplant-toolbar').remove();
    $('.website-chrome-header').replaceWith(chrome('.mp-header').toString());
    $('.website-chrome-footer').replaceWith(chrome('.mp-footer').toString());
    if (atlantic) $('.mp-header a[href^="/?region="]').attr('aria-current', 'page');
    $('main').html(content);
    const toolbar = $('#moduplant-toolbar').addClass('demo-toolbar').attr('aria-label', 'Modo de la demo');
    toolbar.append(
      $('<div class="demo-toolbar-actions">').append(isAdmin && model ? '<button type="button" data-demo-edit>Editar ficha</button>' : '',
        $('<button type="button" data-demo-mode>').attr('data-demo-mode', isAdmin ? 'visitor' : 'admin').text(isAdmin ? 'Ver como visitante' : 'Modo administrador'))
    );
    if (isAdmin) toolbar.attr('data-admin', 'true');
    if (model) {
      const json = JSON.stringify(model).replaceAll('<', '\\u003c');
      $('body').append($('<script type="application/json" id="demo-plant">').text(json));
    }
    return $.html();
  }

  async function route(req) {
    const url = new URL(req.url);
    const query = url.searchParams;
    const path = url.pathname.replace(/\/$/, '') || '/';
    const isAdmin = mode.isAdmin(req);
    const read = req.method === 'GET' || req.method === 'HEAD';
    if (req.method === 'POST' && path === '/demo/modo') {
      if (req.headers.get('origin') !== url.origin) return respond(403, {error: 'Petición fuera de ModuPlant.'});
      try {
        const body = await readBody(req);
        if (!['admin', 'visitor'].includes(body.mode)) return respond(400, {error: 'Modo no válido.'});
        const isAdmin = body.mode === 'admin';
        const headers = await mode.setAdmin(isAdmin);
        return respond(200, {admin: isAdmin}, undefined, headers);
      } catch (error) {
        return respond(400, {error: error.message});
      }
    }
    if (path === '/sugerencias' && read) {
      const filters = parseFilters(query);
      const data = clean(filters.q).length < 2 ? [] : filterPlants(filters, isAdmin).slice(0, 8).map(plant => ({
        name: plantName(plant), scientific_name: scientificName(plant), url: plantPath(plant),
      }));
      return respond(200, {data});
    }
    if (path === '/favoritos' && read) return respond(200, {data: {mode: 'guest', owner: 'guest', ids: []}});
    if (path === '/demo/enlace' && read) {
      const id = query.get('id');
      const plant = plants.find(item => item.id === id);
      return respond(200, {url: plant ? plantPath(plant) : '/'});
    }
    const photo = path.match(/^\/demo\/foto\/([a-z0-9-]+)\/([a-f0-9-]+)$/);
    if (photo && read) {
      const [, slug, id] = photo;
      const entry = changes[slug];
      const value = entry?.photos[id];
      if (!value || (entry.hidden && !isAdmin)) return respond(404, {error: 'Fotografía no disponible.'});
      return respond(200, Uint8Array.from(atob(value.split(',')[1]), char => char.charCodeAt(0)), 'image/webp');
    }
    const edit = path.match(/^\/demo\/editar\/([a-z0-9-]+)$/);
    if (edit && ['PUT', 'DELETE'].includes(req.method)) {
      if (!isAdmin || req.headers.get('origin') !== url.origin) return respond(403, {error: 'Activa el modo administrador.'});
      const plant = bySlug.get(edit[1]);
      if (!plant) return respond(404, {error: 'Ficha no encontrada.'});
      let change = null;
      if (req.method === 'PUT') {
        try { change = validatedChange(plant, await readBody(req)); }
        catch (error) { return respond(400, {error: error.message}); }
      }
      await persist(plant.slug, change);
      return respond(200, {saved: true});
    }
    if ((path === '/' || path === '/plataforma/directorio') && read) {
      const atlantic = query.get('region') === 'atlantica';
      const title = query.has('saved') ? 'Mis plantas favoritas' : atlantic ? 'Selección atlántica' : 'Catálogo de plantas';
      return respond(200, renderPage(renderCatalogue(query, isAdmin), {title, isAdmin, atlantic}), 'text/html; charset=utf-8');
    }
    if (path.startsWith('/plantas/') && read) {
      const plant = bySlug.get(path.slice('/plantas/'.length));
      if (!plant || (!isAdmin && changes[plant.slug]?.hidden)) {
        const content = '<section class="wrap directory-opening"><div><h1>Ficha no disponible</h1><a class="text-link" href="/#plantas">Volver al catálogo →</a></div></section>';
        return respond(404, renderPage(content, {title: 'Ficha no disponible', isAdmin}), 'text/html; charset=utf-8');
      }
      const {html, model} = renderPlant(plant, isAdmin);
      return respond(200, renderPage(html, {title: plantName(plant), isAdmin, model}), 'text/html; charset=utf-8');
    }
    return null;
  }

  return {route, slugs: [...bySlug.keys()]};
}
