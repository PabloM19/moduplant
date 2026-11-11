(() => {
  const config = document.querySelector('[data-favorites-config]');
  if (!config) return;
  const key = 'green-digital-plants-v1';
  const normalize = ids => [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)))].slice(0, 100);
  const readGuest = () => { try { return normalize(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return []; } };
  const scope = state => `${state.mode}:${state.owner || ''}`;
  let state;
  try { state = JSON.parse(config.dataset.state); } catch { state = {mode: 'unavailable', owner: null, ids: []}; }
  let saved = state.mode === 'guest' ? readGuest() : normalize(state.ids);
  let csrf = config.dataset.csrf;
  let busy = false;
  const savedPage = Boolean(document.querySelector('[data-saved-mode]'));
  const toast = message => {
    const node = document.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    setTimeout(() => node.hidden = true, 3500);
  };
  const refresh = () => {
    document.querySelectorAll('[data-favorites-count]').forEach(node => node.textContent = String(saved.length));
    document.querySelectorAll('.favorite-nav').forEach(node => node.setAttribute('aria-label', `Ver mis plantas guardadas, ${saved.length} ${saved.length === 1 ? 'planta' : 'plantas'}`));
    document.querySelectorAll('[data-favorites-note]').forEach(node => {
      node.textContent = state.mode === 'account' ? 'Guardadas en tu cuenta · Tu colección te acompaña cuando inicias sesión.'
        : state.mode === 'guest' ? 'Conservadas en este navegador · Tú eliges cuáles se quedan.'
        : 'No podemos comprobar tu sesión. Recarga para ver tus favoritos.';
    });
    document.querySelectorAll('[data-save]').forEach(node => {
      const active = saved.includes(node.dataset.save);
      node.disabled = busy || state.mode === 'unavailable';
      node.setAttribute('aria-pressed', String(active));
      node.classList.toggle('is-saved', active);
      if (!node.classList.contains('save-plant')) {
        node.textContent = active ? '♥ En tus favoritos' : '♡ Añadir a favoritos';
        node.setAttribute('title', active ? 'Quitar de favoritos' : 'Añadir a favoritos');
      } else {
        node.textContent = active ? '♥' : '♡';
        node.setAttribute('aria-label', `${active ? 'Quitar de favoritos:' : 'Añadir a favoritos:'} ${node.dataset.plantName}`);
      }
    });
  };
  const collectionUrl = (base = location.href, resetPage = false) => {
    const url = new URL(base, location.origin);
    url.searchParams.set('saved', state.mode === 'account' ? '' : saved.join(','));
    if (resetPage) url.searchParams.delete('page');
    url.hash = 'plantas';
    return url;
  };
  const refreshCollection = (resetPage = false) => {
    const target = collectionUrl(location.href, resetPage).href;
    if (target === new URL(location.href).href) location.reload();
    else location.replace(target);
  };
  const canonicalize = () => {
    if (!savedPage || state.mode === 'unavailable') return false;
    const expected = collectionUrl().href;
    const actual = new URL(location.href).href;
    if (expected === actual) return false;
    location.replace(expected);
    return true;
  };
  const accept = data => {
    if (!data || !['account', 'guest'].includes(data.mode) || typeof data.owner !== 'string' || !Array.isArray(data.ids)) throw new Error('Session unavailable');
    state = data;
    saved = state.mode === 'guest' ? readGuest() : normalize(state.ids);
    refresh();
  };
  const current = async () => {
    const oldScope = scope(state);
    const response = await fetch(config.dataset.endpoint, {credentials: 'same-origin', cache: 'no-store', headers: {'Accept': 'application/json'}});
    if (!response.ok) throw new Error('Session unavailable');
    const result = await response.json();
    accept(result.data);
    if (typeof result.csrf_token === 'string') csrf = result.csrf_token;
    return oldScope !== scope(state);
  };
  const unavailable = () => {
    state = {mode: 'unavailable', owner: null, ids: []};
    saved = [];
    refresh();
    toast('No se puede comprobar tu sesión. Vuelve a intentarlo al recargar.');
  };
  const sync = async () => {
    if (busy) return;
    busy = true;
    try {
      const previousIds = saved.join(',');
      const changed = await current();
      if (savedPage && (changed || previousIds !== saved.join(','))) { refreshCollection(); return; }
      canonicalize();
    } catch { unavailable(); }
    finally { busy = false; refresh(); }
  };
  document.querySelectorAll('[data-save]').forEach(node => node.addEventListener('click', async () => {
    if (busy) return;
    const id = node.dataset.save;
    const active = saved.includes(id);
    busy = true;
    refresh();
    try {
      if (await current()) {
        toast('Tu sesión ha cambiado. Revisa tus favoritas antes de continuar.');
        if (savedPage) refreshCollection();
        return;
      }
      if (state.mode === 'account') {
        const response = await fetch(`${config.dataset.endpoint}/${encodeURIComponent(id)}`, {
          method: active ? 'DELETE' : 'PUT', credentials: 'same-origin', cache: 'no-store',
          headers: {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, 'X-Favorites-Owner': state.owner}, body: '{}',
        });
        const result = await response.json();
        if (response.status === 409 && result.data) {
          accept(result.data);
          toast('Tu sesión ha cambiado. Revisa tus favoritas antes de continuar.');
          if (savedPage) refreshCollection();
          return;
        }
        if (!response.ok) throw new Error(result.message || 'No se pudo guardar la planta.');
        accept(result.data);
      } else {
        const nextSaved = active ? saved.filter(value => value !== id) : normalize([...saved, id]);
        try { localStorage.setItem(key, JSON.stringify(nextSaved)); }
        catch { toast('El navegador no permite guardar favoritos.'); return; }
        saved = nextSaved;
        refresh();
      }
      if (savedPage) { refreshCollection(true); return; }
      toast(active ? 'Planta eliminada de tus favoritos.' : 'Añadida a tus favoritos.');
    } catch { unavailable(); }
    finally { busy = false; refresh(); }
  }));
  document.querySelectorAll('.favorite-nav').forEach(node => node.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try { await current(); location.href = collectionUrl(node.dataset.directoryUrl).href; }
    catch { unavailable(); }
    finally { busy = false; refresh(); }
  }));
  window.addEventListener('focus', sync);
  window.addEventListener('pageshow', event => { if (event.persisted) sync(); });
  window.addEventListener('storage', event => { if (event.key === key && state.mode === 'guest') sync(); });
  refresh();
  canonicalize();
})();
