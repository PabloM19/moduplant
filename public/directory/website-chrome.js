document.querySelectorAll('green-digital-chrome').forEach(function (element) {
  var template = element.querySelector('template[shadowrootmode]');
  if (!element.shadowRoot && template) {
    element.attachShadow({mode: 'open'}).appendChild(template.content.cloneNode(true));
    template.remove();
  }
  var websiteMenu = element.shadowRoot?.querySelector('.website-mobile-navigation');
  websiteMenu?.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    websiteMenu.open = false;
    websiteMenu.querySelector('summary').focus();
  });
  const root = element.shadowRoot;
  const toggle = root?.querySelector('.menu-toggle');
  const mobile = root?.querySelector('#mobile-nav');
  const closeMenu = function (restoreFocus) {
    if (!mobile || !toggle) return;
    mobile.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };
  const positionMenu = function () {
    if (mobile) root.host.style.setProperty('--website-menu-top', `${root.querySelector('.site-header').getBoundingClientRect().bottom}px`);
  };
  if (toggle && mobile) {
    toggle.addEventListener('click', function () {
      const open = mobile.hidden;
      mobile.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      positionMenu();
    });
    window.addEventListener('resize', function () { closeMenu(false); positionMenu(); });
    window.addEventListener('scroll', positionMenu, {passive: true});
    root.addEventListener('click', function (event) {
      if (event.target.closest('a') && mobile.contains(event.target)) closeMenu(false);
    });
  }
  root?.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (mobile && !mobile.hidden) closeMenu(true);
    root.querySelectorAll('.account-menu[open]').forEach(function (account) {
      account.open = false;
      account.querySelector('summary').focus();
    });
  });
  let previousFocus;
  root?.addEventListener('click', function (event) {
    const trigger = event.target.closest('[data-website-dialog]');
    if (trigger) {
      const id = trigger.getAttribute('data-website-dialog');
      const dialog = [...document.querySelectorAll('green-digital-chrome')]
        .map(host => host.shadowRoot?.getElementById(id)).find(Boolean);
      if (dialog) {
        event.preventDefault();
        previousFocus = trigger;
        dialog.showModal();
        dialog.querySelector('.modal-close')?.focus();
        dialog.addEventListener('close', function () { previousFocus?.focus(); }, {once: true});
      }
    }
    const close = event.target.closest('.modal-close');
    if (close) close.closest('dialog')?.close();
    if (event.target.tagName === 'DIALOG') event.target.close();
    if (!event.target.closest('.account-menu')) {
      root.querySelectorAll('.account-menu[open]').forEach(account => { account.open = false; });
    }
  });
});
