document.querySelectorAll('[data-plant-autocomplete]').forEach(root => {
  const input = root.querySelector('input');
  const popup = root.querySelector('[data-suggestion-popup]');
  const list = root.querySelector('[role="listbox"]');
  const status = root.querySelector('[role="status"]');
  let timer, controller, sequence = 0, items = [], active = -1;

  const close = () => {
    clearTimeout(timer);
    controller?.abort();
    sequence++;
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const select = index => {
    active = index;
    Array.from(list.children).forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      const option = list.children[index];
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({block: 'nearest'});
    } else input.removeAttribute('aria-activedescendant');
  };
  const search = () => {
    close();
    const query = input.value.trim();
    if (Array.from(query).length < 2) return;
    const current = sequence;
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const url = new URL(root.dataset.suggestionsUrl, window.location.href);
        url.searchParams.set('q', query);
        const response = await fetch(url, {signal: controller.signal, headers: {'Accept': 'application/json'}});
        if (!response.ok) throw new Error('Suggestions unavailable');
        const result = await response.json();
        if (current !== sequence) return;
        items = Array.isArray(result.data) ? result.data : [];
        list.replaceChildren();
        items.forEach((item, index) => {
          const option = document.createElement('li');
          option.id = `${input.id}-option-${index}`;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          const name = document.createElement('strong');
          name.textContent = item.name;
          const scientific = document.createElement('span');
          scientific.textContent = item.scientific_name;
          option.append(name, scientific);
          option.addEventListener('mousedown', event => event.preventDefault());
          option.addEventListener('click', () => { window.location.href = item.url; });
          list.appendChild(option);
        });
        status.textContent = items.length ? `${items.length} ${items.length === 1 ? 'sugerencia disponible' : 'sugerencias disponibles'}. Usa las flechas para elegir.` : 'No hay sugerencias. Puedes buscar de todos modos.';
        popup.hidden = false;
        input.setAttribute('aria-expanded', String(items.length > 0));
      } catch (error) {
        if (error.name === 'AbortError' || current !== sequence) return;
        list.replaceChildren();
        items = [];
        status.textContent = 'No se han podido cargar las sugerencias. Puedes buscar de todos modos.';
        popup.hidden = false;
      }
    }, 250);
  };
  input.addEventListener('input', search);
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) search(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (popup.hidden || !items.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(active + 1, items.length - 1) : (active < 0 ? items.length - 1 : Math.max(active - 1, 0));
      select(next);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      window.location.href = items[active].url;
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
});
