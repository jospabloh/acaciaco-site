// Per-app half of the shared smoke suite. smoke.spec.js next to this file is
// byte-identical across the portfolio — the canonical copy lives in
// `jospabloh/acacia-app-standard` → `shared/smoke/`. Change it there and copy
// it out; everything specific to this app belongs here instead.
export default {
  name: 'acaciaco.com.mx',
  url: 'https://acaciaco.com.mx',

  // Verbatim from this repo's index.html — proves the deploy served THIS app
  // and not a stale or unrelated one.
  title: /ACACIA/,

  // A first-time visitor has to clear this before the corner is clickable.
  dismissOverlay: '#cookie-banner [data-cookies="all"]',

  // Public routes the corner-collision check visits. The cookie banner shares
  // this corner, and the freeware tools carry entirely different chrome from
  // the marketing pages, so both shapes are worth a look.
  routes: ['./', './servicios', './freeware/'],

  theme: {
    // `data-theme` on <html>, the token system styles/base.css uses.
    kind: 'attribute',
    root: '.acacia-theme-switcher',
  },
};
