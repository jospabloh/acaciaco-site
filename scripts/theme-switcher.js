/**
 * ACACIA theme switcher — the vanilla twin of the React component every app in
 * the portfolio ships (`src/components/ThemeSwitcher.jsx` there). Same shape,
 * same three modes, same corner, so the site and the products feel like one
 * product.
 *
 * At rest it is a small circle pinned to the bottom-right showing the mode in
 * force. Pressing it grows the circle sideways into a three-slot track whose
 * indicator slides to the chosen slot — three states, three physical positions,
 * which a two-state sun/moon button cannot express once "follow the device" is
 * one of the options.
 *
 * It owns the theme for the whole site. Load it on every page and delete any
 * other theme control: two writers of `data-theme` will fight.
 *
 *   <script defer src="/scripts/theme-switcher.js"></script>
 *
 * Preference (not resolved colour) is stored under `acacia-theme` as
 * 'light' | 'dark' | 'system'. Each page's inline pre-mount script reads the
 * same key with the same rules so the first paint is already correct — change
 * one and change the other.
 *
 * Self-contained on purpose: it injects its own CSS, because it has to work
 * both on pages using styles/base.css tokens (--bg-card / --border / --text /
 * --text-muted / --primary) and on the freeware tools, which use their own
 * (--card / --line / --ink / --ink-2 / --accent). The variable chains below
 * cover both, and fall back to plain colours if neither is present.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'acacia-theme';
  var MODES = [
    { value: 'light', label: 'Claro', hint: 'Tema claro' },
    { value: 'dark', label: 'Oscuro', hint: 'Tema oscuro' },
    { value: 'system', label: 'Sistema', hint: 'Seguir al dispositivo' }
  ];
  var SLOT = 34;
  var PAD = 3;

  var GLYPHS = {
    light: '<circle cx="8" cy="8" r="3.1"/><path d="M8 1.3v1.4M8 13.3v1.4M14.7 8h-1.4M2.7 8H1.3M12.74 3.26l-.99.99M4.25 11.75l-.99.99M12.74 12.74l-.99-.99M4.25 4.25l-.99-.99"/>',
    dark: '<path d="M13.6 9.62A5.9 5.9 0 0 1 6.38 2.4a5.9 5.9 0 1 0 7.22 7.22Z"/>',
    system: '<rect x="1.6" y="2.6" width="12.8" height="8.6" rx="1.6"/><path d="M6 14.4h4M8 11.2v3.2"/>'
  };

  var CSS = [
    '.acacia-theme-switcher{',
    '  --ats-surface: var(--bg-card, var(--card, #ffffff));',
    '  --ats-line: var(--border, var(--line, rgba(0,0,0,0.12)));',
    '  --ats-line-strong: var(--border-hover, var(--line-2, rgba(0,0,0,0.24)));',
    '  --ats-ink: var(--text, var(--ink, #111318));',
    '  --ats-muted: var(--text-muted, var(--ink-2, rgba(0,0,0,0.5)));',
    '  --ats-accent: var(--primary, var(--accent, #3b6ef8));',
    '  position: fixed; z-index: 60;',
    '  bottom: calc(var(--theme-switcher-bottom, 1rem) + env(safe-area-inset-bottom, 0px));',
    '  right: calc(var(--theme-switcher-right, 1rem) + env(safe-area-inset-right, 0px));',
    '}',
    '@media print { .acacia-theme-switcher { display: none; } }',
    '.ats-shell{',
    '  position: relative; display: flex; align-items: center; height: 40px; width: 40px;',
    '  border: 1px solid var(--ats-line); border-radius: 999px; overflow: hidden; opacity: 0.7;',
    '  background: color-mix(in srgb, var(--ats-surface) 82%, transparent);',
    '  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);',
    '  box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 10px 30px -12px rgba(0,0,0,0.35);',
    '  transition: width 300ms cubic-bezier(0.32,0.72,0,1), opacity 200ms ease, border-color 200ms ease;',
    '}',
    '@supports not (background: color-mix(in srgb, red 50%, transparent)) {',
    '  .ats-shell { background: var(--ats-surface); }',
    '}',
    '.ats-shell:hover, .acacia-theme-switcher:focus-within .ats-shell{ opacity: 1; border-color: var(--ats-line-strong); }',
    '.acacia-theme-switcher[data-open="true"] .ats-shell{ width: 108px; opacity: 1; }',
    '.ats-bubble{',
    '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;',
    '  border: 0; padding: 0; background: none; cursor: pointer; border-radius: 999px;',
    '  color: var(--ats-muted); transition: opacity 200ms ease, color 200ms ease;',
    '}',
    '.ats-bubble:hover{ color: var(--ats-ink); }',
    '.acacia-theme-switcher[data-open="true"] .ats-bubble{ opacity: 0; pointer-events: none; }',
    '.ats-track{',
    '  position: relative; display: flex; align-items: center; padding: ' + PAD + 'px;',
    '  opacity: 0; pointer-events: none; transition: opacity 200ms ease;',
    '}',
    '.acacia-theme-switcher[data-open="true"] .ats-track{ opacity: 1; pointer-events: auto; transition-delay: 70ms; }',
    '.ats-thumb{',
    '  position: absolute; left: ' + PAD + 'px; width: ' + SLOT + 'px; height: ' + SLOT + 'px; border-radius: 999px;',
    '  background: color-mix(in srgb, var(--ats-accent) 15%, transparent);',
    '  transition: transform 300ms cubic-bezier(0.32,0.72,0,1);',
    '}',
    '.ats-slot{',
    '  position: relative; width: ' + SLOT + 'px; height: ' + SLOT + 'px; display: flex; align-items: center;',
    '  justify-content: center; border: 0; padding: 0; background: none; border-radius: 999px;',
    '  color: var(--ats-muted); cursor: pointer; transition: color 200ms ease;',
    '}',
    '.ats-slot:hover{ color: var(--ats-ink); }',
    '.ats-slot[aria-checked="true"]{ color: var(--ats-accent); }',
    '.ats-slot:focus-visible, .ats-bubble:focus-visible{ outline: 2px solid var(--ats-accent); outline-offset: -2px; }',
    '.acacia-theme-switcher svg{ width: 16px; height: 16px; display: block; }',
    '@media (prefers-reduced-motion: reduce){',
    '  .ats-shell, .ats-track, .ats-thumb, .ats-bubble, .ats-slot { transition: none; }',
    '}'
  ].join('\n');

  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readMode() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch (e) { /* private mode — fall through to following the device */ }
    return 'system';
  }

  function resolve(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return media && media.matches ? 'dark' : 'light';
  }

  function apply(mode) {
    var resolved = resolve(mode);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
    return resolved;
  }

  function svg(mode) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      GLYPHS[mode] + '</svg>';
  }

  function build() {
    var mode = readMode();
    apply(mode);

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.className = 'acacia-theme-switcher';
    root.setAttribute('data-open', 'false');

    var shell = document.createElement('div');
    shell.className = 'ats-shell';

    var bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'ats-bubble';
    bubble.setAttribute('aria-expanded', 'false');

    var track = document.createElement('div');
    track.className = 'ats-track';
    track.setAttribute('role', 'radiogroup');
    track.setAttribute('aria-label', 'Tema del sitio');
    track.setAttribute('aria-hidden', 'true');

    var thumb = document.createElement('span');
    thumb.className = 'ats-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    track.appendChild(thumb);

    var slots = MODES.map(function (option) {
      var slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'ats-slot';
      slot.setAttribute('role', 'radio');
      slot.setAttribute('aria-label', option.hint);
      slot.title = option.label;
      slot.innerHTML = svg(option.value);
      track.appendChild(slot);
      return slot;
    });

    shell.appendChild(bubble);
    shell.appendChild(track);
    root.appendChild(shell);
    document.body.appendChild(root);

    var open = false;
    var collapseTimer = null;

    function activeIndex() {
      for (var i = 0; i < MODES.length; i++) if (MODES[i].value === mode) return i;
      return 2;
    }

    function render() {
      var index = activeIndex();
      bubble.innerHTML = svg(MODES[index].value);
      bubble.setAttribute('aria-label', 'Tema: ' + MODES[index].label + '. Abrir selector de tema');
      bubble.title = 'Tema: ' + MODES[index].label;
      thumb.style.transform = 'translateX(' + (index * SLOT) + 'px)';
      slots.forEach(function (slot, i) {
        slot.setAttribute('aria-checked', i === index ? 'true' : 'false');
        // Only the checked radio is in the tab order, and only while the track
        // is open; arrow keys move between them from there.
        slot.tabIndex = open && i === index ? 0 : -1;
      });
    }

    function setOpen(next, restoreFocus) {
      open = next;
      window.clearTimeout(collapseTimer);
      root.setAttribute('data-open', open ? 'true' : 'false');
      track.setAttribute('aria-hidden', open ? 'false' : 'true');
      bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
      bubble.tabIndex = open ? -1 : 0;
      render();
      if (open) slots[activeIndex()].focus();
      else if (restoreFocus) bubble.focus();
    }

    function setMode(next) {
      mode = next;
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* session-only */ }
      apply(mode);
      render();
      document.dispatchEvent(new CustomEvent('acacia:themechange', {
        detail: { mode: mode, resolved: resolve(mode) }
      }));
    }

    bubble.addEventListener('click', function () { setOpen(true); });

    slots.forEach(function (slot, index) {
      slot.addEventListener('click', function (event) {
        setMode(MODES[index].value);
        window.clearTimeout(collapseTimer);
        // Picking with the pointer closes the track once the indicator has
        // finished sliding, so the corner goes quiet again on its own. Picking
        // with the keyboard (detail === 0) leaves it open — collapsing under a
        // focused element would drop the caret somewhere unasked-for.
        if (event.detail > 0) collapseTimer = window.setTimeout(function () { setOpen(false); }, 1100);
      });
      slot.addEventListener('keydown', function (event) {
        var last = MODES.length - 1;
        var next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = last;
        if (next === null) return;
        event.preventDefault();
        window.clearTimeout(collapseTimer);
        setMode(MODES[next].value);
        slots[next].focus();
      });
    });

    document.addEventListener('pointerdown', function (event) {
      if (open && !root.contains(event.target)) setOpen(false);
    }, true);

    document.addEventListener('keydown', function (event) {
      if (open && event.key === 'Escape') setOpen(false, true);
    });

    if (media) {
      var onSystemChange = function () { if (mode === 'system') { apply(mode); render(); } };
      if (media.addEventListener) media.addEventListener('change', onSystemChange);
      else if (media.addListener) media.addListener(onSystemChange);
    }

    // Another tab changed the preference — follow it rather than disagreeing.
    window.addEventListener('storage', function (event) {
      if (event.key !== STORAGE_KEY) return;
      mode = readMode();
      apply(mode);
      render();
    });

    // The cookie notice is a card in this same corner, and it wins on z-index.
    // While it is on screen the switcher steps above it and then settles back,
    // rather than sitting underneath something the visitor cannot click past.
    var banner = document.getElementById('cookie-banner');
    if (banner) {
      var reposition = function () {
        var showing = banner.classList.contains('show') && !banner.classList.contains('dismiss');
        if (showing) {
          // Inline on <html> so it overrides the :root value from the stylesheet
          // and can be handed straight back by removing it.
          document.documentElement.style.setProperty(
            '--theme-switcher-bottom',
            (banner.offsetHeight + 40) + 'px'
          );
        } else {
          document.documentElement.style.removeProperty('--theme-switcher-bottom');
        }
      };
      reposition();
      new MutationObserver(reposition).observe(banner, {
        attributes: true,
        attributeFilter: ['class']
      });
      window.addEventListener('resize', reposition);
    }

    window.acaciaTheme = {
      get: function () { return mode; },
      set: setMode,
      resolved: function () { return resolve(mode); }
    };

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
