(() => {
  const exposureBadges = [...document.querySelectorAll('[data-exposure-badge]')];
  const exposureControls = new Map();
  const closeExposureBadges = except => exposureControls.forEach((close, badge) => {
    if (badge !== except) close();
  });
  exposureBadges.forEach(badge => {
    const trigger = badge.querySelector('[data-exposure-trigger]');
    const tooltip = badge.querySelector('.exposure-tooltip');
    const setOpen = open => {
      if (open) closeExposureBadges(badge);
      trigger.setAttribute('aria-expanded', String(open));
      tooltip.hidden = !open;
      if (open && tooltip.getBoundingClientRect && tooltip.style) {
        tooltip.style.left = '0px';
        tooltip.style.top = '100%';
        tooltip.style.bottom = 'auto';
        const bounds = tooltip.getBoundingClientRect();
        const shift = Math.max(16 - bounds.left, Math.min(0, window.innerWidth - 16 - bounds.right));
        tooltip.style.left = `${shift}px`;
        if (bounds.bottom > window.innerHeight - 16 && badge.getBoundingClientRect().top > bounds.height + 16) {
          tooltip.style.top = 'auto';
          tooltip.style.bottom = '100%';
        }
      }
    };
    let pinned = false;
    exposureControls.set(badge, () => { pinned = false; setOpen(false); });
    badge.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setOpen(true); });
    badge.addEventListener('pointerleave', () => { if (!pinned && !badge.contains(document.activeElement)) setOpen(false); });
    badge.addEventListener('focusin', () => setOpen(true));
    badge.addEventListener('focusout', event => { if (!badge.contains(event.relatedTarget)) { pinned = false; setOpen(false); } });
    trigger.addEventListener('click', () => { pinned = !pinned; setOpen(pinned); });
    badge.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      pinned = false;
      trigger.focus();
      setOpen(false);
    });
  });
  if (exposureBadges.length) document.addEventListener('pointerdown', event => {
    if (!event.target.closest('[data-exposure-badge]')) closeExposureBadges();
  });
  if (exposureBadges.length) window.addEventListener('resize', () => closeExposureBadges());
  document.querySelectorAll('[data-toggle-secret]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.toggleSecret);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.textContent = visible ? 'Ocultar clave' : 'Mostrar clave';
  }));
  const inheritedHeader = document.querySelector('.website-chrome-header');
  const updateHeaderOffset = () => document.documentElement.style.setProperty('--directory-header-height', `${inheritedHeader?.getBoundingClientRect().height || 0}px`);
  updateHeaderOffset();
  if (inheritedHeader) new ResizeObserver(updateHeaderOffset).observe(inheritedHeader);
  const revealAnchor = hash => {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    if (target instanceof HTMLDetailsElement) target.open = true;
    updateHeaderOffset();
    requestAnimationFrame(() => {
      target.scrollIntoView({behavior: 'instant', block: 'start'});
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({preventScroll: true});
    });
  };
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    let targetId;
    try { targetId = decodeURIComponent(hash.slice(1)); } catch { return; }
    if (!document.getElementById(targetId)) return;
    event.preventDefault();
    history.pushState(null, '', hash);
    revealAnchor(hash);
  }));
  window.addEventListener('hashchange', () => revealAnchor(location.hash));
  window.addEventListener('load', () => { if (location.hash) revealAnchor(location.hash); }, {once: true});
  if (location.hash) revealAnchor(location.hash);
  const gallery = document.querySelector('[data-plant-gallery]');
  if (gallery) {
    const frame = gallery.querySelector('[data-photo-zoom]');
    const photo = gallery.querySelector('#main-photo');
    const photos = Array.from(gallery.querySelectorAll('[data-gallery]'));
    const status = gallery.querySelector('[data-gallery-status]');
    const error = gallery.querySelector('.photo-error');
    const fitToggle = gallery.querySelector('[data-photo-fit-toggle]');
    const zoom = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
    let selectedPhoto = 0;
    const resetZoom = () => {
      frame.classList.remove('is-zoomed');
      photo.style.transformOrigin = '50% 50%';
    };
    const announce = state => {
      frame.dataset.photoState = state;
      error.hidden = state !== 'error';
      status.textContent = state === 'loading' ? 'Cargando fotografía…' : state === 'error' ? 'Fotografía no disponible. Puedes volver a intentarlo.' : `Fotografía ${selectedPhoto + 1} de ${photos.length}`;
      if (state !== 'ready') resetZoom();
    };
    photo.addEventListener('load', () => announce('ready'));
    photo.addEventListener('error', () => announce('error'));
    const selectPhoto = index => {
      selectedPhoto = (index + photos.length) % photos.length;
      const button = photos[selectedPhoto];
      resetZoom();
      photos.forEach(node => {
        const selected = node === button;
        node.classList.toggle('selected', selected);
        node.setAttribute('aria-pressed', String(selected));
      });
      announce('loading');
      photo.alt = button.dataset.alt;
      photo.src = button.dataset.gallery;
      if (photo.complete && photo.naturalWidth) announce('ready');
    };
    photos.forEach((button, index) => {
      button.addEventListener('click', () => selectPhoto(index));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? photos.length - 1 : index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1);
        selectPhoto(next);
        photos[selectedPhoto].focus();
      });
      const thumb = button.querySelector('img');
      thumb.addEventListener('error', () => button.classList.add('is-unavailable'));
      thumb.addEventListener('load', () => button.classList.remove('is-unavailable'));
      if (thumb.complete && !thumb.naturalWidth) button.classList.add('is-unavailable');
    });
    gallery.querySelector('[data-photo-retry]').addEventListener('click', () => selectPhoto(selectedPhoto));
    if (fitToggle) {
      fitToggle.hidden = false;
      fitToggle.addEventListener('click', () => {
        const complete = frame.classList.toggle('show-complete');
        fitToggle.textContent = complete ? 'Volver a llenar el marco' : 'Ver foto completa';
        resetZoom();
      });
    }
    frame.addEventListener('pointermove', event => {
      if (!zoom.matches || event.pointerType === 'touch' || frame.dataset.photoState !== 'ready') return;
      const bounds = frame.getBoundingClientRect();
      const ratios = [bounds.width / photo.naturalWidth, bounds.height / photo.naturalHeight];
      const fit = frame.classList.contains('show-complete') ? Math.min(...ratios) : Math.max(...ratios);
      const scale = 2;
      const origin = (position, size, content) => {
        const inset = (size - content) / 2;
        const min = scale * inset / (scale - 1);
        const max = (scale * (inset + content) - size) / (scale - 1);
        return min > max ? size / 2 : Math.max(min, Math.min(max, position));
      };
      photo.style.transformOrigin = `${origin(event.clientX - bounds.left, bounds.width, photo.naturalWidth * fit)}px ${origin(event.clientY - bounds.top, bounds.height, photo.naturalHeight * fit)}px`;
      frame.classList.add('is-zoomed');
    });
    frame.addEventListener('pointerleave', resetZoom);
    zoom.addEventListener('change', resetZoom);
    if (photo.complete) announce(photo.naturalWidth ? 'ready' : 'error');
  }
})();

// Los índices no se reutilizan después de quitar una fila.
document.querySelectorAll('[data-add-row]').forEach(button => {
    const name = button.dataset.addRow;
    const list = document.querySelector(`[data-repeat-list="${name}"]`);
    const template = document.querySelector(`[data-row-template="${name}"]`);
    if (!list || !template) return;
    let next = Math.max(-1, ...Array.from(list.querySelectorAll('[name]'), input => {
        const match = input.name.match(/\[(\d+)\]/);
        return match ? Number(match[1]) : -1;
    })) + 1;
    button.addEventListener('click', () => {
        list.insertAdjacentHTML('beforeend', template.innerHTML.replaceAll('__INDEX__', String(next++)));
        list.lastElementChild?.querySelector('input')?.focus();
    });
});
document.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-row]');
    if (button) button.closest('.repeat-row, .trait-row')?.remove();
});

document.querySelectorAll('[data-copy-target]').forEach(button => {
    button.addEventListener('click', async () => {
        const input = document.getElementById(button.dataset.copyTarget);
        if (!input) return;
        try {
            await navigator.clipboard.writeText(input.value);
            button.textContent = 'Clave copiada';
        } catch {
            input.focus();
            input.select();
            button.textContent = 'Pulsa ⌘C o Ctrl+C para copiar';
        }
    });
});
