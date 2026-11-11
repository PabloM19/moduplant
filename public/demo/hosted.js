(async () => {
  try {
    if (navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const previous = registrations.filter(registration => [registration.active, registration.waiting, registration.installing]
        .some(worker => worker && new URL(worker.scriptURL).pathname === '/moduplant-worker.js'));
      await Promise.all(previous.map(registration => registration.unregister()));
      if (previous.length && navigator.serviceWorker.controller) {
        location.reload();
        return;
      }
    }
  } catch {
    // La edición se prepara directamente aunque el navegador desactive los workers.
  }
  try {
    await import('/moduplant-app.js');
  } catch (error) {
    const notice = document.createElement('p');
    notice.setAttribute('role', 'alert');
    notice.textContent = 'No se pudo preparar la edición. Recarga para volver a intentarlo.';
    document.querySelector('main')?.prepend(notice);
    console.error(error);
  }
})();
