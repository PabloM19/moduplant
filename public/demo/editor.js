import {blockTypes, blockMarkup, shortSafety} from './blocks.js';

const toolbar = document.querySelector('#moduplant-toolbar');
const model = JSON.parse(document.querySelector('#demo-plant')?.textContent ?? 'null');

async function request(url, method, payload) {
  const res = await fetch(url, {
    method,
    headers: {'Content-Type': 'application/json'},
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Vuelve a intentar la operación.');
  return data;
}

const mode = toolbar.querySelector('[data-demo-mode]');
mode.addEventListener('click', async () => {
  mode.disabled = true;
  try {
    await request('/demo/modo', 'POST', {mode: mode.dataset.demoMode});
    const url = new URL(location.href);
    url.searchParams.delete('editar');
    if (url.search === location.search) location.reload();
    else location.replace(url.href);
  } catch {
    mode.disabled = false;
    mode.textContent = 'Reintentar cambio de vista';
  }
});

if (location.hash.startsWith('#/')) {
  const id = location.hash.match(/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})(?=\?|$)/i)?.[1];
  if (id) {
    const response = await fetch('/demo/enlace?' + new URLSearchParams({id}));
    location.replace((await response.json()).url);
  } else {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

if (model) {
  const trigger = toolbar.querySelector('[data-demo-edit]');
  const inlineTrigger = document.createElement('button');
  inlineTrigger.type = 'button';
  inlineTrigger.className = 'button secondary demo-inline-edit';
  inlineTrigger.textContent = 'Editar ficha';
  document.querySelector('.favorite-detail').after(inlineTrigger);
  trigger.addEventListener('click', () => openEditor(trigger));
  inlineTrigger.addEventListener('click', () => openEditor(inlineTrigger));
  if (new URLSearchParams(location.search).has('editar')) openEditor(trigger);
}

function element(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function action(label, handler, className = '') {
  const button = element('button', {type: 'button', textContent: label, className});
  button.addEventListener('click', handler);
  return button;
}

function field(label, input, className = 'demo-field') {
  return element('label', {className}, element('span', {textContent: label}), input);
}

function photoSource(photo, edits, thumb = false) {
  const override = edits.photos[photo.id];
  if (override === true) return `/demo/foto/${model.slug}/${photo.id}`;
  return override || (thumb ? photo.thumb : photo.url);
}

async function resizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12_000_000) {
    throw new Error('Elige una imagen JPG, PNG o WebP de hasta 12 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = element('canvas', {width: Math.max(1, Math.round(bitmap.width * scale)), height: Math.max(1, Math.round(bitmap.height * scale))});
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/webp', 0.82);
    if (!image.startsWith('data:image/webp;base64,') || image.length > 800_000) throw new Error('Esta foto es demasiado pesada. Prueba con otra imagen.');
    return image;
  } finally {
    bitmap.close();
  }
}

function openEditor(opener) {
  if (document.querySelector('#demo-editor')) {
    document.querySelector('.demo-resume:not([hidden])')?.click();
    return;
  }
  const saved = model.edits ?? {fields: {}, category: model.category, cover: model.photos[0].id, photos: {}, blocks: [], hidden: false};
  const draft = structuredClone(saved);
  const endpoint = '/demo/editar/' + model.slug;
  const beforeUnload = event => { event.preventDefault(); event.returnValue = ''; };
  let dirty = false;
  let working = false;
  const pageTitle = document.querySelector('.live-detail-heading h1');
  const eyebrow = document.querySelector('.live-detail-heading .eyebrow');
  const originalEyebrow = eyebrow.textContent;
  const safetySummary = document.querySelector('[data-edit-summary="safety"]');
  const cultivationNote = document.querySelector('.mp-cultivation-note');
  const cultivationSource = cultivationNote?.querySelector('[data-cultivation-source]');
  const gallery = new Map([...document.querySelectorAll('[data-photo-id]')].map(button => [button.dataset.photoId, button]));
  const custom = document.querySelector('#demo-custom-blocks');
  const status = element('p', {className: 'demo-editor-status'});
  status.setAttribute('role', 'status');

  function setDirty() {
    if (!dirty) window.addEventListener('beforeunload', beforeUnload);
    dirty = true;
    status.textContent = 'Vista previa · Cambios sin guardar';
  }

  function preview(edits) {
    for (const [key, original] of Object.entries(model.fields)) {
      for (const node of document.querySelectorAll(`[data-edit-field="${key}"]`)) {
        node.textContent = edits.fields[key] ?? original;
      }
    }
    const cultivationText = edits.fields['garden-note'] ?? model.fields['garden-note'];
    if (cultivationNote) cultivationNote.hidden = !cultivationText.trim();
    if (cultivationSource) cultivationSource.hidden = cultivationText.trim() !== model.fields['garden-note'];
    if (safetySummary) safetySummary.textContent = shortSafety(edits.fields.safety ?? model.fields.safety);
    eyebrow.textContent = edits.category === saved.category ? originalEyebrow : `${model.categories[edits.category]} · ${model.family}`;
    custom.innerHTML = blockMarkup(edits.blocks);
  }

  function previewPhotos(edits, active) {
    for (const photo of model.photos) {
      const button = gallery.get(photo.id);
      if (!button) continue;
      button.dataset.gallery = photoSource(photo, edits);
      button.dataset.alt = edits.photos[photo.id] ? `${pageTitle.textContent} · Foto personalizada` : photo.alt;
      button.querySelector('img').src = photoSource(photo, edits, true);
    }
    gallery.get(active)?.click();
  }

  function close(restore = true) {
    window.removeEventListener('beforeunload', beforeUnload);
    if (restore && dirty) {
      preview(saved);
      previewPhotos(saved, saved.cover);
    }
    panel.remove();
    resume.remove();
    document.body.classList.remove('demo-editing');
    const url = new URL(location.href);
    url.searchParams.delete('editar');
    history.replaceState(null, '', url);
    opener.focus({preventScroll: true});
  }

  function cancel() {
    if (working) return;
    if (!dirty) close();
    else ask('¿Descartar los cambios de esta ficha?', 'Descartar cambios', close);
  }

  const heading = element('h2', {id: 'demo-editor-title', textContent: 'Editar ficha'});
  const panel = element('aside', {id: 'demo-editor', className: 'demo-editor'});
  panel.setAttribute('aria-labelledby', heading.id);
  const dismiss = action('Cerrar', cancel, 'demo-close');
  const resume = action('Volver a editar', () => {
    panel.hidden = false;
    resume.hidden = true;
    document.body.classList.add('demo-editing');
    previewButton.focus({preventScroll: true});
  }, 'demo-resume');
  resume.hidden = true;
  function showPreview(target) {
    panel.hidden = true;
    resume.hidden = false;
    document.body.classList.remove('demo-editing');
    target?.scrollIntoView({block: 'start', behavior: 'smooth'});
    resume.focus({preventScroll: true});
  }
  const previewButton = action('Ver ficha', () => showPreview(), 'demo-preview');
  const summary = element('p', {className: 'demo-editor-name', textContent: pageTitle.textContent});
  const form = element('form', {className: 'demo-editor-form'});
  const tabs = element('div', {className: 'demo-editor-tabs'});
  tabs.setAttribute('aria-label', 'Apartados de edición');
  const tabPanels = new Map();
  const tabButtons = new Map();
  const body = element('div', {className: 'demo-editor-body'});
  const groups = [['ficha', 'Ficha'], ['contenido', 'Contenido'], ['fotos', 'Fotos'], ['bloques', 'Bloques']];
  function showTab(key) {
    for (const [name, tab] of tabButtons) tab.setAttribute('aria-pressed', String(name === key));
    for (const [name, region] of tabPanels) region.hidden = name !== key;
    body.scrollTop = 0;
  }
  for (const [key, label] of groups) {
    const tab = action(label, () => showTab(key));
    const section = element('div', {className: 'demo-editor-group', id: `demo-tab-${key}`});
    tab.setAttribute('aria-controls', section.id);
    tabButtons.set(key, tab);
    tabPanels.set(key, section);
    tabs.append(tab);
    body.append(section);
  }
  showTab('ficha');

  const sections = new Map();
  for (const [key, label] of Object.entries(model.fieldLabels)) {
    const group = ['name', 'scientific', 'introduction', 'description', 'garden-note'].includes(key) ? 'ficha' : 'contenido';
    const singleLine = ['name', 'scientific'].includes(key) || key.endsWith('-question');
    const input = element(singleLine ? 'input' : 'textarea', {
      name: key, value: draft.fields[key] ?? model.fields[key],
      maxLength: ['name', 'scientific'].includes(key) ? 180 : 5000,
      required: ['name', 'scientific'].includes(key),
    });
    input.addEventListener('input', () => {
      if (input.value === model.fields[key]) delete draft.fields[key];
      else draft.fields[key] = input.value;
      preview(draft);
      setDirty();
    });
    const control = field(label, input);
    if (group === 'ficha') {
      tabPanels.get(group).append(control);
      continue;
    }
    const sectionName = key.startsWith('faq-') ? 'Preguntas frecuentes'
      : key.startsWith('trait-') ? 'Características botánicas'
      : key.startsWith('problem-') ? 'Problemas habituales'
      : key === 'safety' ? 'Precauciones'
      : 'Cuidados';
    if (!sections.has(sectionName)) sections.set(sectionName, element('div', {className: 'demo-editor-group'}));
    sections.get(sectionName).append(control);
  }
  for (const [name, controls] of sections) {
    const disclosure = element('details', {className: 'demo-fields-section', open: name === 'Cuidados'},
      element('summary', {textContent: name}), controls);
    tabPanels.get('contenido').append(disclosure);
  }
  const category = element('select', {name: 'category'});
  for (const [value, label] of Object.entries(model.categories)) category.append(new Option(label, value));
  category.value = draft.category;
  category.addEventListener('change', () => {
    draft.category = category.value;
    preview(draft);
    setDirty();
  });
  const visibility = element('input', {type: 'checkbox', checked: draft.hidden});
  visibility.addEventListener('change', () => {
    draft.hidden = visibility.checked;
    setDirty();
  });
  tabPanels.get('ficha').append(field('Categoría', category), field('Ocultar en el catálogo público', visibility, 'demo-check'));

  const photoList = element('div', {className: 'demo-photo-list'});
  for (const [index, photo] of model.photos.entries()) {
    const title = `Foto ${index + 1}`;
    const image = element('img', {src: photoSource(photo, draft, true), alt: '', width: 72, height: 72});
    const upload = element('input', {type: 'file', accept: 'image/jpeg,image/png,image/webp', className: 'demo-file'});
    upload.setAttribute('aria-label', `Reemplazar foto ${index + 1}`);
    const useOriginal = action('Usar original', () => {
      delete draft.photos[photo.id];
      image.src = photoSource(photo, draft, true);
      useOriginal.hidden = true;
      previewPhotos(draft, photo.id);
      setDirty();
    }, 'demo-small-button');
    useOriginal.hidden = !draft.photos[photo.id];
    const radio = element('input', {type: 'radio', name: 'cover', value: photo.id, checked: draft.cover === photo.id});
    radio.addEventListener('change', () => {
      draft.cover = photo.id;
      previewPhotos(draft, photo.id);
      setDirty();
    });
    upload.addEventListener('change', async () => {
      const file = upload.files[0];
      if (!file || working) return;
      working = true;
      submit.disabled = true;
      upload.disabled = true;
      status.textContent = 'Preparando la fotografía…';
      try {
        draft.photos[photo.id] = await resizePhoto(file);
        image.src = photoSource(photo, draft, true);
        useOriginal.hidden = false;
        previewPhotos(draft, photo.id);
        setDirty();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        working = false;
        submit.disabled = false;
        upload.disabled = false;
        upload.value = '';
      }
    });
    const replace = element('label', {className: 'demo-upload'}, 'Reemplazar', upload);
    photoList.append(element('div', {className: 'demo-photo-row'}, image,
      element('div', {className: 'demo-photo-tools'},
        element('strong', {textContent: title}),
        field(`Usar como portada · ${title}`, radio, 'demo-check demo-cover'),
        element('div', {className: 'demo-photo-actions'}, replace, useOriginal))));
  }
  tabPanels.get('fotos').append(element('p', {className: 'demo-editor-note', textContent: 'La portada aparece en el catálogo y al abrir la ficha.'}), photoList);

  const blocksList = element('div', {className: 'demo-block-list'});
  const blockType = element('select', {name: 'block-type'});
  for (const [key, label] of Object.entries(blockTypes)) blockType.append(new Option(label, key));
  const addBlock = action('Añadir bloque', () => {
    if (draft.blocks.length >= 20) return;
    draft.blocks.push({type: blockType.value, title: '', text: ''});
    renderBlocks();
    blocksList.lastElementChild.querySelector('input').focus();
    setDirty();
  }, 'demo-small-button');
  function renderBlocks() {
    blocksList.replaceChildren();
    addBlock.disabled = draft.blocks.length >= 20;
    for (const [index, block] of draft.blocks.entries()) {
      const title = element('input', {value: block.title, maxLength: 180});
      const text = element('textarea', {value: block.text, maxLength: 5000});
      const remove = action('Quitar', () => {
        draft.blocks.splice(index, 1);
        renderBlocks();
        addBlock.focus();
        preview(draft);
        setDirty();
      }, 'demo-small-button');
      for (const [input, key] of [[title, 'title'], [text, 'text']]) {
        input.addEventListener('input', () => {
          block[key] = input.value;
          preview(draft);
          setDirty();
        });
      }
      const group = element('fieldset', {className: 'demo-block'}, element('legend', {textContent: blockTypes[block.type]}), field('Título', title));
      if (block.type !== 'heading') group.append(field('Texto', text));
      group.append(remove);
      blocksList.append(group);
    }
  }
  renderBlocks();
  tabPanels.get('bloques').append(
    element('p', {className: 'demo-editor-note', textContent: 'Los bloques aparecen debajo de las preguntas frecuentes, antes de las fuentes.'}),
    element('div', {className: 'demo-add-block'}, field('Tipo de bloque', blockType), addBlock),
    blocksList,
    action('Ver bloques en la ficha', () => showPreview(custom), 'demo-small-button'),
  );

  const submit = element('button', {type: 'submit', className: 'demo-save', textContent: 'Guardar cambios'});
  async function write(method, data) {
    if (working) return;
    working = true;
    submit.disabled = true;
    status.textContent = 'Guardando…';
    try {
      await request(endpoint, method, data);
      window.removeEventListener('beforeunload', beforeUnload);
      const url = new URL(location.href);
      url.searchParams.delete('editar');
      url.searchParams.set('guardado', method === 'DELETE' ? 'original' : '1');
      url.hash = '';
      location.replace(url);
    } catch (error) {
      status.textContent = error.message;
      working = false;
      submit.disabled = false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    write('PUT', draft);
  });
  const footer = element('div', {className: 'demo-editor-footer'}, status, element('div', {className: 'demo-editor-buttons'}, submit, action('Cancelar', cancel)));
  function ask(message, label, confirmAction) {
    if (working) return;
    footer.querySelector('.demo-confirm')?.remove();
    const confirmation = element('div', {className: 'demo-confirm'}, element('p', {textContent: message}));
    const confirmButton = action(label, () => {
      confirmation.remove();
      confirmAction();
    });
    confirmation.append(element('div', {className: 'demo-editor-buttons'}, confirmButton, action('Volver a la edición', () => {
      confirmation.remove();
      submit.focus();
    })));
    footer.append(confirmation);
    confirmButton.focus();
  }
  if (model.edits) footer.append(action('Restaurar ficha original', () => {
    ask('¿Recuperar los datos y las fotos originales de esta ficha?', 'Restaurar original', () => write('DELETE'));
  }, 'demo-restore'));
  form.append(tabs, body, footer);
  panel.append(element('div', {className: 'demo-editor-header'}, element('div', {}, heading, summary), element('div', {className: 'demo-editor-header-actions'}, previewButton, dismiss)), form);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); cancel(); }
  });
  document.body.append(panel, resume);
  document.body.classList.add('demo-editing');
  panel.querySelector('input[name="name"]').focus({preventScroll: true});
}

const notificationUrl = new URL(location.href);
if (notificationUrl.searchParams.has('guardado')) {
  const toast = document.querySelector('.toast');
  toast.textContent = notificationUrl.searchParams.get('guardado') === 'original' ? 'Ficha original restaurada.' : 'Cambios guardados en el catálogo local.';
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 4000);
  notificationUrl.searchParams.delete('guardado');
  history.replaceState(null, '', notificationUrl);
}
