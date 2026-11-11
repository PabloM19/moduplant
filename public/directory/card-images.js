document.querySelectorAll('[data-card-photo]').forEach(card => {
  const image = card.querySelector('img');
  const error = card.querySelector('[data-card-photo-error]');
  const message = error.querySelector('[role="status"]');
  const retry = error.querySelector('[data-card-photo-retry]');
  const failed = () => {
    error.hidden = false;
    retry.disabled = false;
    message.textContent = 'No se ha podido cargar la foto.';
  };
  image.addEventListener('error', failed);
  image.addEventListener('load', () => { error.hidden = true; retry.disabled = false; });
  retry.addEventListener('click', () => {
    retry.disabled = true;
    message.textContent = 'Cargando foto…';
    const url = new URL(image.currentSrc || image.src, window.location.href);
    url.searchParams.set('_retry', String(Date.now()));
    image.src = url.href;
  });
  if (image.complete && !image.naturalWidth) failed();
});
