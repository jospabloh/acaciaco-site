// Headless smoke test for the Baristop v2 catalog (spec 19.2). Run by hand:
//
//   node /private/tmp/.../cleanurl-server.mjs &            # Vercel-style: cleanUrls, no trailing slash (8898)
//   python3 -m http.server 8899 &                           # trailing-slash host, from the repo root
//   node tests/smoke/baristop-catalogo.mjs
//
// CLEAN_BASE / SLASH_BASE override the hosts; CHROME overrides the browser binary.
// This is an .mjs file on purpose: `npm test` only globs tests/**/*.test.ts.
import { chromium } from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLEAN = (process.env.CLEAN_BASE || 'http://localhost:8898').replace(/\/$/, '');
const SLASH = (process.env.SLASH_BASE || 'http://localhost:8899').replace(/\/$/, '');
const EXE = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PRODUCT = 'saju-taro-ejemplo';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + (detail === undefined ? '' : detail)));
}

const browser = await chromium.launch({ executablePath: EXE });

async function open(url, { width = 1280, height = 900, reload = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'es-MX' });
  const page = await ctx.newPage();
  const bad = [], errors = [], redirects = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)/.test(r.url())) bad.push(r.status() + ' ' + r.url());
    if (r.status() >= 300 && r.status() < 400) redirects.push(r.status() + ' ' + r.headers().location);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  // demo=1 pins the seed content so the assertions do not depend on the live Sheet.
  if (!/demo=/.test(url)) { const [u, hash = ''] = url.split('#'); url = u + (u.includes('?') ? '&' : '?') + 'demo=1' + (hash ? '#' + hash : ''); }
  await page.goto(url, { waitUntil: 'networkidle' });
  return { ctx, page, bad, errors, redirects };
}
const path_ = (page) => new URL(page.url()).pathname + new URL(page.url()).search;
const h1 = (page) => page.locator('main h1').first().innerText();

// ---- 1. three URL forms, five views, zero 4xx -----------------------------------------
const views = ['', '?g=insumos', '?c=molinos', '?p=' + PRODUCT, '?q=taro'];
const forms = [
  ['clean', CLEAN + '/baristop-v2/catalogo'],
  ['slash', SLASH + '/baristop-v2/catalogo/'],
  ['file', SLASH + '/baristop-v2/catalogo/index.html']
];
for (const [label, base] of forms) {
  for (const v of views) {
    const { ctx, page, bad, errors } = await open(base + v);
    const title = await h1(page);
    check(`${label} ${v || 'index'}: loads with no 4xx and no console errors`, bad.length === 0 && errors.length === 0 && title.length > 0, JSON.stringify({ bad, errors, title }));
    await ctx.close();
  }
}

// ---- 2. 308 keeps the query -------------------------------------------------------------
{
  const { ctx, page, redirects } = await open(CLEAN + '/baristop-v2/catalogo/?c=molinos');
  check('clean: /catalogo/?c=molinos ends on /catalogo?c=molinos after a 308', new URL(page.url()).pathname === '/baristop-v2/catalogo' && /^\?c=molinos/.test(new URL(page.url()).search) && redirects.some((r) => r.startsWith('308')), page.url() + ' ' + redirects);
  check('clean: the redirected URL renders the category', (await h1(page)) === 'Molinos');
  await ctx.close();
}

// ---- 3. desktop mega-menu ---------------------------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2');
  const btn = page.locator('.nav-group[data-group=maquinaria]');
  await btn.click();
  check('desktop: Maquinaria opens a disclosure panel', (await btn.getAttribute('aria-expanded')) === 'true' && (await page.locator('#menu-maquinaria').isVisible()));
  await page.keyboard.press('Escape');
  check('desktop: Escape closes it', (await btn.getAttribute('aria-expanded')) === 'false');
  await btn.click();
  await page.locator('#menu-maquinaria .mega-card').first().click();
  await page.waitForURL(/catalogo\?c=/);
  check('desktop: first mega link lands on a category page', /\?c=cafeteras/.test(page.url()) && (await h1(page)) === 'Cafeteras espresso', page.url());
  await page.locator('.nav-group[data-group=insumos]').click();
  await page.locator('#menu-insumos .mega-bname').first().click();
  await page.waitForTimeout(400);
  const u = new URL(page.url());
  check('desktop: mega footer Sucursales lands on the home #sucursales', u.pathname === '/baristop-v2' && u.hash === '#sucursales' && (await page.locator('#sucursales').isVisible()), page.url());
  await ctx.close();
}

// ---- 3b. same-page menu links (Chrome on a Galaxy S25 Ultra: the menu "did nothing") ---------
// With the <base> bootstrap, href="#recetas" on /baristop-v2 resolved to /baristop-v2/#recetas,
// so every tap reloaded the page through a 308 and the jump was lost on a real phone.
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2', { width: 412, height: 915 });
  const navs = [];
  page.on('request', (r) => { if (r.isNavigationRequest()) navs.push(r.url()); });
  await page.evaluate(() => { window.__sameDoc = 1; });
  await page.locator('.nav-toggle').click();
  await page.locator('a.drawer-plain', { hasText: 'Recetas' }).first().click();
  await page.waitForTimeout(800);
  check('phone: drawer "Recetas" stays in the same document', await page.evaluate(() => window.__sameDoc === 1), navs.join(', '));
  check('phone: drawer "Recetas" makes no navigation request', navs.length === 0, navs.join(', '));
  check('phone: drawer "Recetas" scrolls to the section', await page.evaluate(() => {
    const r = document.getElementById('recetas').getBoundingClientRect(); return r.top < 200 && r.bottom > 0;
  }));
  await ctx.close();
}

// ---- 4. phone drawer ---------------------------------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?p=' + PRODUCT, { width: 360, height: 740 });
  await page.locator('.nav-toggle').click();
  const acc = page.locator('.drawer-acc[data-group=insumos]');
  await acc.click();
  check('phone: Insumos accordion expands', (await acc.getAttribute('aria-expanded')) === 'true');
  await page.locator('#drawer-insumos .drawer-link').nth(1).click();
  await page.waitForFunction(() => /\?c=polvos/.test(location.search));
  check('phone: accordion link routes to the category without reload', (await h1(page)) === 'Polvos y bases');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('phone: no horizontal scroll at 360 px', !overflow);
  await ctx.close();
}

// ---- 5. Back from product restores the filtered category --------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?c=polvos&marca=Saju');
  check('filters: marca chip is pressed from the URL', (await page.locator('.fchip[data-marca=Saju]').getAttribute('aria-pressed')) === 'true' && (await page.locator('.pcard').count()) === 1);
  await page.locator('.pcard').first().click();
  await page.waitForURL(/\?p=/);
  await page.goBack();
  await page.waitForURL(/\?c=polvos/);
  check('back: category keeps its filters', /marca=Saju/.test(page.url()) && (await page.locator('.fchip[data-marca=Saju]').getAttribute('aria-pressed')) === 'true' && (await page.locator('.pcard').count()) === 1, page.url());
  await ctx.close();
}

// ---- 6. hidden / unknown variant falls back ---------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?p=cafe-coatepec-ejemplo&v=nope');
  const on = await page.locator('.vchip[aria-checked=true]').count();
  const first = await page.locator('.vchip').first().getAttribute('aria-checked');
  check('?v=nope: first variant selected and v dropped from the URL', on === 1 && first === 'true' && !/v=/.test(page.url()), page.url());
  await page.locator('.vchip').nth(1).click();
  check('variant chip click writes v with replaceState', /v=cafe-coatepec-p2/.test(page.url()));
  await ctx.close();
}

// ---- 7. #lista direct open / close, add, persistence ------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?p=' + PRODUCT + '#lista');
  check('#lista: drawer opens on direct load', await page.locator('.qlist.is-open').count() === 1);
  const before = page.url();
  await page.locator('.qlist-close').click();
  await page.waitForTimeout(300);
  check('#lista: closing keeps us on the product page', new URL(page.url()).pathname === '/baristop-v2/catalogo' && /\?p=/.test(page.url()) && !/#lista/.test(page.url()) && (await page.locator('.qlist.is-open').count()) === 0 && before !== page.url());
  await page.locator('.add-btn').first().click();
  check('add: badge shows 1', (await page.locator('.nav-list [data-qlist-badge]').first().innerText()) === '1');
  await page.locator('.nav-list').click();
  check('add: drawer lists the line', (await page.locator('.qline').count()) === 1 && /taro/i.test(await page.locator('.qline .ql-name').innerText()));
  await page.locator('.qlist-close').click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  check('add: reload keeps the list', (await page.locator('.nav-list [data-qlist-badge]').first().innerText()) === '1');
  await ctx.close();
}

// ---- 8. accented, case-insensitive search -----------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?q=SOY%20T%C3%89');
  check('search: SOY TÉ finds the Soy Té example', (await page.locator('.pcard').count()) === 1 && /Tisana/.test(await page.locator('.pcard-name').innerText()));
  check('search: result cards use a plain-text category crumb', (await page.locator('.pcard a').count()) === 0 && (await page.locator('.pcard-crumb').count()) === 1);
  await page.goto(CLEAN + '/baristop-v2/catalogo?q=te', { waitUntil: 'networkidle' });
  await page.goto(CLEAN + '/baristop-v2/catalogo?q=t', { waitUntil: 'networkidle' });
  check('search: one letter shows the hint', (await page.locator('.search-hint').innerText()) === 'Escribe al menos 2 letras.');
  await page.goto(CLEAN + '/baristop-v2/catalogo?q=zzz', { waitUntil: 'networkidle' });
  check('search: no results shows WhatsApp buttons', (await page.locator('.empty-band .btn').count()) >= 2);
  await ctx.close();
}

// ---- 9. unknown ids -----------------------------------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?p=no-existe');
  check('unknown product: not-found state', /No encontramos esa página/.test(await h1(page)) && /No encontrado/.test(await page.title()));
  await ctx.close();
}

// ---- 10. demo=1 survives three in-shell clicks --------------------------------------------
{
  const { ctx, page } = await open(CLEAN + '/baristop-v2/catalogo?demo=1');
  await page.locator('.mcard').first().click();
  await page.waitForURL(/\?c=/);
  await page.locator('.pcard').first().click();
  await page.waitForURL(/\?p=/);
  await page.locator('.crumbs a', { hasText: 'Catálogo' }).click();
  await page.waitForFunction(() => !/[?&](c|p)=/.test(location.search));
  check('demo=1 preserved after 3 in-shell clicks', /demo=1/.test(page.url()), page.url());
  await ctx.close();
}

// ---- 11. no absolute /baristop-v2 strings in the shipped source ----------------------------
{
  const hits = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(html|js|css|json)$/.test(f.name) && fs.readFileSync(p, 'utf8').includes('"/baristop-v2')) hits.push(p);
    }
  })(path.join(ROOT, 'baristop-v2'));
  check('no "/baristop-v2 absolute string in baristop-v2/', hits.length === 0, hits.join(', '));
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
