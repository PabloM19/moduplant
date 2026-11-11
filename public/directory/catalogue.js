(() => {
  const form = document.querySelector('[data-catalogue-form]');
  if (!form) return;
  const toggle = form.querySelector('[data-catalogue-filter-toggle]');
  const fields = form.querySelector('[data-catalogue-filter-fields]');
  if (toggle && fields) {
    const setExpanded = expanded => {
      fields.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
    };
    toggle.hidden = false;
    setExpanded(Number(fields.dataset.activeFilters) > 0);
    toggle.addEventListener('click', () => setExpanded(fields.hidden));
    fields.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      setExpanded(false);
      toggle.focus();
    });
  }
  form.querySelector('[data-catalogue-update]')?.setAttribute('hidden', '');
  form.querySelectorAll('[data-catalogue-auto-submit]').forEach(select => {
    select.addEventListener('change', () => form.requestSubmit());
  });
})();
