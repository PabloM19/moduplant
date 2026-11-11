import { isCatalogueRoute } from './catalogue.mjs';
import { loadHostedCatalogue } from './hosted-catalogue.mjs';

export { loadHostedCatalogue };

async function start() {
  try {
    const catalogue = await loadHostedCatalogue();
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? new Request(input, init) : new Request(new URL(input, location.href), init);
      const url = new URL(request.url);
      if (url.origin !== location.origin || !isCatalogueRoute(url.pathname)) return nativeFetch(input, init);
      const method = request.method.toUpperCase();
      const headers = new Headers(request.headers);
      if (!['GET', 'HEAD'].includes(method)) headers.set('Origin', location.origin);
      return (await catalogue.route(new Request(request, {headers}))) ?? nativeFetch(input, init);
    };

    const result = await catalogue.route(new Request(location.href));
    if (!result) return;
    const page = new DOMParser().parseFromString(await result.text(), 'text/html');
    document.title = page.title;
    document.body.replaceWith(document.importNode(page.body, true));
    const scripts = [...page.head.querySelectorAll('script[data-moduplant-script]')];
    for (const original of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = original.src;
        if (original.dataset.moduplantScript === 'module') script.type = 'module';
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar el editor. Recarga la página.'));
        document.head.append(script);
      });
    }
    const modeButton = document.querySelector('[data-demo-mode]');
    if (modeButton) {
      modeButton.disabled = false;
      modeButton.textContent = modeButton.dataset.demoMode === 'admin' ? 'Modo administrador' : 'Ver como visitante';
    }
    const banner = document.querySelector('#moduplant-startup-status');
    if (banner) banner.remove();
  } catch (error) {
    const banner = document.createElement('p');
    banner.id = 'moduplant-startup-status';
    banner.setAttribute('role', 'alert');
    banner.textContent = error.message || 'No se pudo preparar el catálogo. Recarga y vuelve a intentarlo.';
    document.querySelector('main')?.prepend(banner);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}
