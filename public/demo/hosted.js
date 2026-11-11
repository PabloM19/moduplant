(() => {
  const serviceWorker = navigator.serviceWorker;
  if (!serviceWorker) return;
  const initialController = serviceWorker.controller;
  const ready = serviceWorker.register('/moduplant-worker.js', {type: 'module', updateViaCache: 'none'})
    .then(registration => {
      if (serviceWorker.controller) return;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          serviceWorker.removeEventListener('controllerchange', activate);
          reject(new Error('El catálogo está tardando en cargar. Recarga y vuelve a intentarlo.'));
        }, 10000);
        function activate() {
          clearTimeout(timer);
          resolve();
        }
        serviceWorker.addEventListener('controllerchange', activate, {once: true});
        if (registration.active && serviceWorker.controller) activate();
      });
    });
  ready.then(() => { if (!initialController) location.reload(); }).catch(() => {});
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (url.origin === location.origin && ['/favoritos', '/sugerencias', '/demo/modo', '/demo/enlace'].includes(url.pathname) && !serviceWorker.controller) {
      await ready;
    }
    return nativeFetch(input, init);
  };
})();
