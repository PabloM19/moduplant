(() => {
  const controls = [];
  let opened = null;
  const close = () => {
    if (!opened) return;
    opened.panel.hidden = true;
    opened.button.setAttribute('aria-expanded', 'false');
    opened.button.removeAttribute('aria-activedescendant');
    opened = null;
  };
  document.querySelectorAll('[data-catalogue-form] .catalogue-select > select').forEach((select, number) => {
    if (select.multiple || !select.options.length) return;
    const wrapper = select.closest('.catalogue-select');
    const label = select.getAttribute('aria-label') || select.name;
    const id = `directory-select-${number}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'directory-select-trigger';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `${id}-options`);
    button.setAttribute('aria-describedby', `${id}-value`);
    const value = document.createElement('span');
    value.id = `${id}-value`;
    value.className = 'directory-select-value';
    const arrow = document.createElement('span');
    arrow.className = 'directory-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(value, arrow);
    const panel = document.createElement('div');
    panel.className = 'directory-select-popup';
    panel.hidden = true;
    const list = document.createElement('ul');
    list.id = `${id}-options`;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label);
    panel.append(list);
    let active = select.selectedIndex;
    let typed = '', typedAt = 0;
    const options = Array.from(select.options).map((option, index) => {
      const item = document.createElement('li');
      item.id = `${id}-option-${index}`;
      item.setAttribute('role', 'option');
      item.textContent = option.text;
      if (option.disabled) item.setAttribute('aria-disabled', 'true');
      list.append(item);
      return item;
    });
    const update = () => {
      value.textContent = select.options[select.selectedIndex]?.text || '';
      button.disabled = select.disabled;
      options.forEach((item, index) => item.setAttribute('aria-selected', String(index === select.selectedIndex)));
    };
    const activate = (index, scroll = true) => {
      if (index < 0 || index >= options.length || select.options[index].disabled) return;
      active = index;
      options.forEach((item, i) => item.classList.toggle('is-active', i === active));
      button.setAttribute('aria-activedescendant', options[active].id);
      if (scroll) {
        const item = options[active];
        const top = item.offsetTop;
        const bottom = top + item.offsetHeight;
        if (top < panel.scrollTop) panel.scrollTop = top;
        else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
      }
    };
    const position = () => {
      const box = button.getBoundingClientRect();
      const width = Math.min(Math.max(box.width, 220), window.innerWidth - 32);
      const below = window.innerHeight - box.bottom - 16;
      const above = box.top - 16;
      const upward = below < 180 && above > below;
      const height = Math.max(44, Math.min(320, upward ? above : below));
      panel.style.width = `${width}px`;
      panel.style.maxHeight = `${height}px`;
      panel.style.left = `${Math.max(16, Math.min(box.left, window.innerWidth - width - 16))}px`;
      panel.style.top = upward ? 'auto' : `${box.bottom + 7}px`;
      panel.style.bottom = upward ? `${window.innerHeight - box.top + 7}px` : 'auto';
      };
    const open = () => {
      close();
      position();
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      opened = {button, panel, position};
      activate(select.selectedIndex >= 0 ? select.selectedIndex : Array.from(select.options).findIndex(option => !option.disabled));
    };
    const commit = index => {
      if (index < 0 || select.options[index].disabled) return;
      const changed = select.selectedIndex !== index;
      select.selectedIndex = index;
      update();
      close();
      button.focus();
      if (changed) select.dispatchEvent(new Event('change', {bubbles: true}));
    };
    options.forEach((item, index) => {
      item.addEventListener('pointermove', () => activate(index, false));
      item.addEventListener('pointerdown', event => event.preventDefault());
      item.addEventListener('click', () => commit(index));
    });
    button.addEventListener('click', () => opened?.button === button ? close() : open());
    button.addEventListener('keydown', event => {
      const isOpen = opened?.button === button;
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault(); event.stopPropagation(); close(); return;
      }
      if (event.key === 'Tab') { close(); return; }
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (isOpen) commit(active); else open();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!isOpen) { open(); if (event.key.startsWith('Arrow')) return; }
        let next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1);
        const direction = ['ArrowUp', 'End'].includes(event.key) ? -1 : 1;
        while (next >= 0 && next < options.length && select.options[next].disabled) next += direction;
        activate(next);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        if (!isOpen) open();
        const now = Date.now();
        typed = now - typedAt > 700 ? event.key : typed + event.key;
        typedAt = now;
        const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
        const index = Array.from(select.options).findIndex(option => !option.disabled && normalize(option.text).startsWith(normalize(typed)));
        activate(index);
      }
    });
    select.addEventListener('change', update);
    select.form?.addEventListener('reset', () => setTimeout(update, 0));
    wrapper.append(button);
    document.body.append(panel);
    wrapper.classList.add('catalogue-select--enhanced');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    update();
    controls.push({button, panel});
  });
  if (!controls.length) return;
  document.addEventListener('pointerdown', event => {
    if (opened && !opened.button.contains(event.target) && !opened.panel.contains(event.target)) close();
  });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', event => {
    if (opened && !opened.panel.contains(event.target)) opened.position();
  }, {capture: true, passive: true});
})();
