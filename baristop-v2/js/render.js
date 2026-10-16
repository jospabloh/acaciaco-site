/*
 * Baristop v2 — section renderers (spec §1, §3.3, §1.15).
 *
 * render(content) is idempotent: it sets every [data-text="site.key"] with
 * textContent and rebuilds every [data-list="..."] container. Everything that
 * carries data from the Sheet is built with createElement/textContent. The only
 * innerHTML use is for the static SVG icon strings defined below.
 *
 * URL rules: only https:// URLs from content ever reach an href (isSafeHttpsUrl);
 * tel:, mailto: and wa.me links are built here from digits / e-mails.
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var DISMISS_KEY = "baristop-v2:announcement-dismissed";

  var PH = {
    hero: "assets/placeholders/hero-4x3.svg",
    branch: "assets/placeholders/branch-3x2.svg",
    category: "assets/placeholders/category-3x2.svg",
    machine: "assets/placeholders/machine-4x3-sm.svg",
    insumo: "assets/placeholders/insumo-4x5.svg",
    recipe: "assets/placeholders/recipe-4x5.svg",
    logo: "assets/placeholders/logo-2x1.svg",
    promo: "assets/placeholders/promo-16x9.svg",
    product: "assets/placeholders/product-1x1.svg"
  };

  /* Static icon markup (never built from data). */
  var ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5l-.7-1.6c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5 5 0 0 0 3.1.6 2.6 2.6 0 0 0 1.7-1.2 2 2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.2l.8-3H14V8z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.4 2 4 4.5 4.2"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2c-4 0-7 3-7 7 0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.5v11l9-5.5-9-5.5z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  var GROUPS = ["maquinaria", "insumos"];
  var GROUP_ALL = { maquinaria: "Ver toda la maquinaria", insumos: "Ver todos los insumos" };
  var AVAIL_LABEL = { disponible: "Disponible", pocas: "Pocas piezas", pedido: "Bajo pedido", agotado: "Agotado", "": "Consulta disponibilidad" };
  var AVAIL_RANK = { disponible: 4, pocas: 3, pedido: 2, agotado: 1 };
  var BRANCH_SHORT = { ags: "AGS", durango: "DGO" };

  var state = { content: null, branches: [], selectedBranchId: "" };
  var live = null;

  /* ---------- tiny DOM helpers ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== "") n.textContent = text;
    return n;
  }
  function clear(n) {
    while (n && n.firstChild) n.removeChild(n.firstChild);
  }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function list(name) { return qs('[data-list="' + name + '"]'); }
  function setHidden(node, hidden) { if (node) node.hidden = !!hidden; }
  function str(v) { return v == null ? "" : String(v); }

  function icon(name, cls) {
    var s = el("span", "ico" + (cls ? " " + cls : ""));
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || ICONS.link; // static strings only
    return s;
  }

  function isMissing(v) {
    var t = str(v).trim();
    return t === "" || t === "Por definir";
  }

  /* ---------- URL / image safety ---------- */

  function safeUrl(u) {
    return S.isSafeHttpsUrl(u) ? u : "";
  }

  var REL_PATH_RE = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_\-.\/%]*$/;
  var DATA_IMG_RE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/;
  var DRIVE_RE = /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+$/;

  // Site root (spec 12.4): content-relative paths and the placeholders resolve against it,
  // never against document.baseURI, because the catalog shell lives one folder deeper.
  function rootHref() {
    return typeof window.BARISTOP_ROOT === "string" && window.BARISTOP_ROOT ? window.BARISTOP_ROOT : document.baseURI;
  }
  function rootLink(path) {
    return S.rootLink(path, window.location, rootHref());
  }
  function onHome() {
    try { return new URL(rootHref()).pathname === new URL(document.baseURI).pathname; } catch (e) { return false; }
  }
  // demo / nocache are round-1 modes that must survive every navigation.
  function keepQuery() {
    var p = new URLSearchParams(window.location.search), out = [];
    if (p.get("demo") === "1") out.push("demo=1");
    if (p.get("nocache") === "1") out.push("nocache=1");
    return out.join("&");
  }
  // rootLink + preserved modes. On the home page a bare "#anchor" stays a same-page link.
  function link(path) {
    path = path == null ? "" : String(path);
    if (onHome() && path.charAt(0) === "#") return path;
    var keep = keepQuery();
    if (keep) {
      var h = path.indexOf("#");
      var hash = h < 0 ? "" : path.slice(h);
      var base = h < 0 ? path : path.slice(0, h);
      path = base + (base.indexOf("?") < 0 ? "?" : "&") + keep + hash;
    }
    return rootLink(path);
  }
  function setRootLinks() {
    qsa("a[data-root-link]").forEach(function (a) { a.setAttribute("href", link(a.getAttribute("data-root-link"))); });
  }

  // https URL (Drive), a path relative to the site, or a data: image (admin demo mode).
  function imageSrc(u) {
    var v = str(u).trim();
    if (!v) return "";
    if (S.isSafeHttpsUrl(v)) return v;
    if (DATA_IMG_RE.test(v)) return v;
    if (REL_PATH_RE.test(v)) return new URL(v, rootHref()).href;
    return "";
  }
  function phSrc(ph) {
    return new URL(PH[ph] || PH.hero, rootHref()).href;
  }
  // Drive thumbnails honour a size suffix; the error chain strips it first.
  function sized(src, w) {
    return w && DRIVE_RE.test(src) ? src + "=w" + w : src;
  }

  function onImgError(e) {
    var img = e.currentTarget;
    var step = img.getAttribute("data-step") || "0";
    var cur = img.currentSrc || img.src;
    if (!img.getAttribute("data-unsized") && /=w\d+$/.test(cur)) {
      img.setAttribute("data-unsized", "1");
      img.src = cur.replace(/=w\d+$/, "");
      return;
    }
    var m = /^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]+)/.exec(cur);
    if (step === "0" && m) {
      img.setAttribute("data-step", "1");
      img.src = "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
      return;
    }
    if (step !== "2") {
      img.setAttribute("data-step", "2");
      img.setAttribute("data-placeholder", "1");
      img.src = phSrc(img.getAttribute("data-ph"));
    }
  }

  // opts: eager, w/h (intrinsic size), size (Drive thumbnail width).
  function makeImg(url, ph, alt, opts) {
    opts = opts || {};
    var img = document.createElement("img");
    var src = imageSrc(url);
    img.src = src ? sized(src, opts.size) : phSrc(ph);
    img.alt = src ? str(alt) : "";
    img.setAttribute("data-ph", ph);
    if (!src) img.setAttribute("data-placeholder", "1");
    img.decoding = "async";
    img.loading = opts.eager ? "eager" : "lazy";
    if (opts.w) { img.width = opts.w; img.height = opts.h; }
    img.addEventListener("error", onImgError);
    return img;
  }

  /* ---------- contact value builders ---------- */

  function waDigits(v) {
    var d = S.normalizeDigits(v);
    if (d.length === 10) d = "52" + d;
    return d.length >= 11 && d.length <= 15 ? d : "";
  }
  function waLink(v, text) {
    var d = waDigits(v);
    return d ? "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "") : "";
  }
  function telHref(v) {
    var d = S.normalizeDigits(v);
    if (d.length === 10) return "tel:+52" + d;
    if (d.length === 12 && d.indexOf("52") === 0) return "tel:+" + d;
    return d.length >= 7 ? "tel:" + d : "";
  }
  function telLabel(v) {
    var d = S.normalizeDigits(v);
    if (d.length === 12 && d.indexOf("52") === 0) d = d.slice(2);
    if (d.length === 10) return d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6);
    return d;
  }

  function formatLongDate(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(ymd));
    if (!m) return "";
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    var opts = { day: "numeric", month: "long" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    try {
      return new Intl.DateTimeFormat("es-MX", opts).format(d);
    } catch (e) {
      return str(ymd);
    }
  }

  /* ---------- text bindings ---------- */

  function renderTexts(site) {
    qsa("[data-text]").forEach(function (node) {
      var attr = node.getAttribute("data-text");
      if (attr.indexOf("site.") !== 0) return;
      var key = attr.slice(5);
      if (!Object.prototype.hasOwnProperty.call(site, key)) return; // keep inline default
      var v = str(site[key]);
      var wrap = node.closest("[data-optional-wrap]") || node;
      if (v.trim() === "") {
        if (window.BaristopContent && window.BaristopContent.OPTIONAL_SITE_KEYS[key]) wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      node.textContent = v;
    });
    var fr = qs("[data-franchise-wa]");
    if (fr) {
      var href = waLink(site.franchiseWhatsapp);
      if (href) { fr.href = href; fr.hidden = false; } else { fr.hidden = true; }
    }
    qsa("[data-year]").forEach(function (n) { n.textContent = String(new Date().getFullYear()); });
  }

  /* ---------- announcement bar ---------- */

  function dismissedId() {
    try { return window.sessionStorage.getItem(DISMISS_KEY); } catch (e) { return null; }
  }

  function renderAnnouncement(items) {
    var bar = qs("#anuncios");
    if (!bar) return;
    var slot = qs("[data-announce-text]", bar);
    var item = items && items.length ? items[0] : null;
    if (!item || !str(item.text).trim() || dismissedId() === item.id) {
      bar.hidden = true;
      bar.removeAttribute("data-id");
      clear(slot);
      return;
    }
    clear(slot);
    var href = safeUrl(item.url);
    var node;
    if (href) {
      node = el("a", "announce-link", item.text);
      node.href = href;
      node.target = "_blank";
      node.rel = "noopener";
    } else {
      node = el("span", "", item.text);
    }
    slot.appendChild(node);
    bar.setAttribute("data-id", item.id);
    bar.hidden = false;
  }

  /* ---------- hero strip ---------- */

  // Spec 14.2: a tile links to the first group / category whose folded name contains one of
  // the tile title's words (>= 4 letters, whole-word match). No match: plain image, no dead link.
  function tileTarget(title, content) {
    var words = fold(title).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4; });
    if (!words.length || !content) return "";
    var site = content.site || {};
    var idx = catalogIndex(content);
    var i, j;
    for (i = 0; i < GROUPS.length; i++) {
      if (!idx.groups[GROUPS[i]].length) continue;
      var gw = fold(GROUPS[i]) + " " + fold(groupLabel(site, GROUPS[i]));
      for (j = 0; j < words.length; j++) if (gw.split(" ").indexOf(words[j]) !== -1) return link("catalogo?g=" + GROUPS[i]);
    }
    for (i = 0; i < idx.cats.length; i++) {
      var cw = fold(idx.cats[i].name).split(/[^a-z0-9]+/);
      for (j = 0; j < words.length; j++) if (cw.indexOf(words[j]) !== -1) return link("catalogo?c=" + idx.cats[i].id);
    }
    return "";
  }

  function renderHeroStrip(rows, content) {
    var box = list("heroStrip");
    if (!box) return;
    var wrap = box.closest(".hero-strip") || box;
    clear(box);
    if (!rows.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    for (var i = 0; i < 4; i++) {
      var r = rows[i];
      var fig = el("figure", "tile" + (r ? "" : " tile-empty"));
      var target = r ? tileTarget(r.title, content) : "";
      var inner = fig;
      if (target) {
        inner = el("a", "tile-link");
        inner.href = target;
        fig.appendChild(inner);
      }
      inner.appendChild(makeImg(r ? r.image : "", "hero", r ? (r.alt || r.title) : "", { eager: true, w: 1200, h: 900 }));
      if (r && str(r.title).trim()) inner.appendChild(el("figcaption", "tile-cap", r.title));
      box.appendChild(fig);
    }
  }

  /* ---------- promos ---------- */

  function renderPromos(items) {
    var box = list("promos");
    var sec = qs("#promos");
    if (!box) return;
    clear(box);
    setHidden(sec, !items.length);
    items.forEach(function (p) {
      var card = el("article", "promo");
      var fig = el("div", "promo-img");
      fig.appendChild(makeImg(p.image, "promo", p.title, { w: 1200, h: 675 }));
      card.appendChild(fig);
      var body = el("div", "promo-body");
      body.appendChild(el("h3", "", p.title));
      if (str(p.text).trim()) body.appendChild(el("p", "promo-text", p.text));
      var href = safeUrl(p.ctaUrl);
      if (href && str(p.ctaLabel).trim()) {
        var a = el("a", "btn btn-wine", p.ctaLabel);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        body.appendChild(a);
      }
      if (p.endsAt) {
        var until = formatLongDate(p.endsAt);
        if (until) body.appendChild(el("p", "promo-until", "Vigente hasta " + until));
      }
      card.appendChild(body);
      box.appendChild(card);
    });
  }

  /* ---------- catalog model (spec 16.1) ---------- */

  var idxFor = null, idxCache = null;

  function fold(v) {
    return str(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function groupLabel(site, g) {
    var v = g === "maquinaria" ? site.navGroupMachinery : site.navGroupSupplies;
    return str(v).trim() || (g === "maquinaria" ? "Maquinaria" : "Insumos");
  }

  // Lookup tables over one normalised content document (memoised per document).
  function catalogIndex(content) {
    if (idxFor === content && idxCache) return idxCache;
    var idx = {
      cats: [], catById: {}, catPos: {}, groups: { maquinaria: [], insumos: [] },
      products: [], prodById: {}, prodBySlug: {}, prodsByCat: {}, varsByProd: {}, recipeById: {}
    };
    if (content) {
      (content.categories || []).forEach(function (c, i) {
        idx.cats.push(c);
        idx.catById[c.id] = c;
        idx.catPos[c.id] = i;
        if (idx.groups[c.group]) idx.groups[c.group].push(c);
        idx.prodsByCat[c.id] = [];
      });
      (content.products || []).forEach(function (p) {
        idx.products.push(p);
        idx.prodById[p.id] = p;
        idx.prodBySlug[p.slug || p.id] = p;
        if (idx.prodsByCat[p.categoryId]) idx.prodsByCat[p.categoryId].push(p);
        idx.varsByProd[p.id] = [];
      });
      (content.variants || []).forEach(function (v) {
        if (idx.varsByProd[v.productId]) idx.varsByProd[v.productId].push(v);
      });
      (content.recipes || []).forEach(function (r) { idx.recipeById[r.id] = r; });
    }
    idxFor = content;
    idxCache = idx;
    return idx;
  }

  function productRef(p) { return encodeURIComponent(p.slug || p.id); }
  function productLink(p) { return link("catalogo?p=" + productRef(p)); }
  function isExample(p) { return /\(ejemplo\)\s*$/i.test(str(p.name)); }

  function countText(n) {
    return n > 0 ? n + (n === 1 ? " producto" : " productos") : "Próximamente";
  }

  // { kind: "none"|"single"|"from", text, unit }
  function priceInfo(variants) {
    var sum = S.priceSummary(variants || []);
    if (sum.kind === "none" || sum.min == null) return { kind: "none", text: "Precio a cotizar", unit: "" };
    if (sum.kind === "from") return { kind: "from", text: "Desde " + S.formatMoney(sum.min), unit: "" };
    var unit = "";
    (variants || []).forEach(function (v) { if (!unit && v.price != null && v.unit) unit = v.unit; });
    return { kind: "single", text: S.formatMoney(sum.min), unit: unit };
  }

  // Best availability state of a product's variants in one branch ("" = unknown).
  function branchState(variants, branchId) {
    var best = "";
    (variants || []).forEach(function (v) {
      var st = v.availability ? v.availability[branchId] : "";
      if (st && (AVAIL_RANK[st] || 0) > (AVAIL_RANK[best] || 0)) best = st;
    });
    return best;
  }
  function availLabel(state) { return AVAIL_LABEL[state] || AVAIL_LABEL[""]; }
  function branchShort(b) {
    return BRANCH_SHORT[b.id] || fold(b.name).replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
  }
  function dot(state) {
    var d = el("span", "dot dot-" + (state || "none"));
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  /* ---------- cards ---------- */

  function categoryCard(c, count) {
    var a = el("a", "mcard");
    a.href = link("catalogo?c=" + c.id);
    a.setAttribute("data-cat-id", c.id);
    var fig = el("span", "mcard-img");
    fig.appendChild(makeImg(c.image, "category", c.name, { w: 1200, h: 800, size: 600 }));
    a.appendChild(fig);
    var body = el("span", "mcard-body");
    body.appendChild(el("span", "mcard-name", c.name));
    if (str(c.tagline).trim()) body.appendChild(el("span", "mcard-tag", c.tagline));
    body.appendChild(el("span", "mcard-count" + (count ? "" : " is-soon"), countText(count)));
    var more = el("span", "mcard-more", "Ver productos");
    more.appendChild(document.createTextNode(" "));
    more.appendChild(el("span", "", "→")).setAttribute("aria-hidden", "true");
    body.appendChild(more);
    a.appendChild(body);
    return a;
  }

  // opts.crumb: show the (plain text) category name, used by search results.
  function productCard(p, content, opts) {
    opts = opts || {};
    var idx = catalogIndex(content);
    var vars = idx.varsByProd[p.id] || [];
    var a = el("a", "pcard");
    a.href = productLink(p);
    a.setAttribute("data-pid", p.id);
    var fig = el("span", "pcard-img");
    fig.appendChild(makeImg(p.photos[0], "product", p.name, { w: 600, h: 600, size: 600 }));
    if (isExample(p)) fig.appendChild(el("span", "ej-tag", "Ejemplo"));
    a.appendChild(fig);
    var body = el("span", "pcard-body");
    if (opts.crumb && idx.catById[p.categoryId]) body.appendChild(el("span", "pcard-crumb", idx.catById[p.categoryId].name));
    if (p.brand) body.appendChild(el("span", "pcard-brand", p.brand));
    body.appendChild(el("h3", "pcard-name", p.name));
    if (str(p.summary).trim()) body.appendChild(el("span", "pcard-sum", p.summary));
    var info = priceInfo(vars);
    var price = el("span", "pcard-price" + (info.kind === "none" ? " is-quote" : ""));
    price.appendChild(el("span", "pcard-amount", info.text));
    if (info.unit) price.appendChild(el("span", "pcard-unit", " / " + info.unit));
    body.appendChild(price);
    var row = el("span", "pcard-avail");
    (content.branches || []).slice(0, 2).forEach(function (b) {
      var st = branchState(vars, b.id);
      var pa = el("span", "pa");
      pa.setAttribute("title", b.name + ": " + availLabel(st));
      pa.appendChild(dot(st));
      var ini = el("span", "pa-ini", branchShort(b));
      ini.setAttribute("aria-hidden", "true");
      pa.appendChild(ini);
      pa.appendChild(el("span", "sr-only", b.name + ": " + availLabel(st)));
      row.appendChild(pa);
    });
    body.appendChild(row);
    a.appendChild(body);
    return a;
  }

  function recipeCard(r) {
    var href = safeUrl(r.videoUrl);
    var card = href ? el("a", "rcard rcard-link") : el("article", "rcard");
    if (href) {
      card.href = href;
      card.target = "_blank";
      card.rel = "noopener";
    }
    var fig = el("div", "rcard-img");
    fig.appendChild(makeImg(r.photo, "recipe", r.title, { w: 1080, h: 1350, size: 600 }));
    if (href) {
      var badge = el("span", "play-badge");
      badge.setAttribute("aria-hidden", "true");
      badge.appendChild(icon("play"));
      fig.appendChild(badge);
    }
    card.appendChild(fig);
    var body = el("div", "rcard-body");
    body.appendChild(el("h3", "", r.title));
    if (str(r.description).trim()) body.appendChild(el("p", "", r.description));
    if (href) body.appendChild(el("span", "rcard-watch", "Ver video ↗"));
    card.appendChild(body);
    return card;
  }

  /* ---------- navigation (spec 11) ---------- */

  function megaFoot(g, content) {
    var foot = el("div", "mega-foot");
    var all = el("a", "mega-all", GROUP_ALL[g]);
    all.href = link("catalogo?g=" + g);
    all.appendChild(document.createTextNode(" "));
    all.appendChild(el("span", "", "→")).setAttribute("aria-hidden", "true");
    foot.appendChild(all);
    var branches = content.branches || [];
    if (branches.length) {
      var wrap = el("div", "mega-branches");
      wrap.appendChild(el("span", "mega-label", "Sucursales:"));
      branches.forEach(function (b) {
        var item = el("span", "mega-branch");
        var a = el("a", "mega-bname", b.name);
        a.href = link("#sucursales");
        item.appendChild(a);
        var wa = waLink(b.whatsapp);
        if (wa) {
          var w = el("a", "mega-wa");
          w.href = wa;
          w.target = "_blank";
          w.rel = "noopener";
          w.setAttribute("aria-label", "WhatsApp " + b.name);
          w.appendChild(icon("whatsapp"));
          item.appendChild(w);
        }
        wrap.appendChild(item);
      });
      foot.appendChild(wrap);
    }
    var ask = el("a", "mega-ask", "¿Dudas? Escríbenos →");
    ask.href = link("#cotiza");
    foot.appendChild(ask);
    return foot;
  }

  function renderNav(content) {
    var idx = catalogIndex(content);
    var site = content.site || {};
    var desk = list("navGroups");
    var drawer = list("drawerGroups");

    if (desk) {
      var openBtn = qs('.nav-group[aria-expanded="true"]', desk);
      var openId = openBtn ? openBtn.getAttribute("data-group") : "";
      clear(desk);
      GROUPS.forEach(function (g) {
        var cats = idx.groups[g];
        if (!cats.length) return; // a group without visible categories is not rendered
        var item = el("div", "nav-item");
        item.setAttribute("data-group", g);
        var btn = el("button", "nav-group");
        btn.type = "button";
        btn.setAttribute("data-group", g);
        btn.setAttribute("aria-expanded", g === openId ? "true" : "false");
        btn.setAttribute("aria-controls", "menu-" + g);
        btn.appendChild(el("span", "", groupLabel(site, g)));
        btn.appendChild(icon("chevron", "nav-chev"));
        item.appendChild(btn);
        var panel = el("div", "mega" + (g === openId ? " is-open" : ""));
        panel.id = "menu-" + g;
        panel.setAttribute("role", "group");
        panel.setAttribute("aria-label", groupLabel(site, g));
        var inner = el("div", "wrap mega-inner");
        var ul = el("ul", "mega-grid");
        cats.forEach(function (c) {
          var n = (idx.prodsByCat[c.id] || []).length;
          var li = el("li");
          var a = el("a", "mega-card");
          a.href = link("catalogo?c=" + c.id);
          var im = el("span", "mega-img");
          im.appendChild(makeImg(c.image, "category", "", { w: 1200, h: 800, size: 400 }));
          a.appendChild(im);
          var body = el("span", "mega-body");
          body.appendChild(el("span", "mega-name", c.name));
          if (str(c.tagline).trim()) body.appendChild(el("span", "mega-tag", c.tagline));
          body.appendChild(el("span", "mega-count", countText(n)));
          a.appendChild(body);
          li.appendChild(a);
          ul.appendChild(li);
        });
        inner.appendChild(ul);
        inner.appendChild(megaFoot(g, content));
        panel.appendChild(inner);
        item.appendChild(panel);
        desk.appendChild(item);
      });
    }

    if (drawer) {
      var wasOpen = {};
      qsa(".drawer-acc", drawer).forEach(function (b) { wasOpen[b.getAttribute("data-group")] = b.getAttribute("aria-expanded") === "true"; });
      clear(drawer);
      GROUPS.forEach(function (g) {
        var cats = idx.groups[g];
        if (!cats.length) return;
        var open = Object.prototype.hasOwnProperty.call(wasOpen, g) ? wasOpen[g] : g === "maquinaria";
        var box = el("div", "drawer-group");
        var btn = el("button", "drawer-acc");
        btn.type = "button";
        btn.setAttribute("data-group", g);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-controls", "drawer-" + g);
        btn.appendChild(el("span", "", groupLabel(site, g)));
        btn.appendChild(icon("chevron", "nav-chev"));
        box.appendChild(btn);
        var ul = el("ul", "drawer-list");
        ul.id = "drawer-" + g;
        ul.hidden = !open;
        cats.forEach(function (c) {
          var li = el("li");
          var a = el("a", "drawer-link");
          a.href = link("catalogo?c=" + c.id);
          a.appendChild(el("span", "dl-name", c.name));
          if (str(c.tagline).trim()) a.appendChild(el("span", "dl-tag", c.tagline));
          li.appendChild(a);
          ul.appendChild(li);
        });
        var last = el("li");
        var all = el("a", "drawer-link drawer-all", GROUP_ALL[g] + " →");
        all.href = link("catalogo?g=" + g);
        last.appendChild(all);
        ul.appendChild(last);
        box.appendChild(ul);
        drawer.appendChild(box);
      });
    }
  }

  /* ---------- home: catalogue, chips, featured ---------- */

  function fillChips(name, cats) {
    var ul = list(name);
    if (!ul) return;
    clear(ul);
    cats.forEach(function (c) {
      var li = el("li", "chip-li");
      var a = el("a", "chip-link", c.name);
      a.href = link("catalogo?c=" + c.id);
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  function renderGroupGrid(name, cats, idx) {
    var box = list(name);
    if (!box) return;
    var block = box.closest(".cat-block");
    clear(box);
    setHidden(block, !cats.length);
    cats.forEach(function (c) { box.appendChild(categoryCard(c, (idx.prodsByCat[c.id] || []).length)); });
  }

  // Featured products: category order first, then the Sheet order inside the category.
  function featuredProducts(content, group, max) {
    var idx = catalogIndex(content);
    var out = idx.products.filter(function (p) {
      if (!p.featured) return false;
      return !group || (idx.catById[p.categoryId] && idx.catById[p.categoryId].group === group);
    });
    out = out.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) {
      var d = idx.catPos[a.p.categoryId] - idx.catPos[b.p.categoryId];
      return d !== 0 ? d : a.i - b.i;
    }).map(function (x) { return x.p; });
    return max ? out.slice(0, max) : out;
  }

  function renderFeatured(content) {
    var box = list("featured");
    var sec = qs("#destacados");
    if (!box) return;
    clear(box);
    var items = featuredProducts(content, "", 8);
    setHidden(sec, !items.length);
    items.forEach(function (p) { box.appendChild(productCard(p, content)); });
  }

  function renderHomeCatalog(content) {
    var idx = catalogIndex(content);
    fillChips("offerMachineryChips", idx.groups.maquinaria);
    fillChips("offerSuppliesChips", idx.groups.insumos);
    renderGroupGrid("machineryCategories", idx.groups.maquinaria, idx);
    renderGroupGrid("insumos", idx.groups.insumos, idx);
    renderFeatured(content);
  }

  /* ---------- recipes ---------- */

  function renderRecipes(items, site) {
    var box = list("recipes");
    if (!box) return;
    clear(box);
    var empty = qs("[data-recipes-empty]");
    setHidden(empty, items.length > 0);
    setHidden(box, !items.length);
    items.forEach(function (r) { box.appendChild(recipeCard(r)); });
  }

  /* ---------- branches ---------- */

  function row(iconName, cls) {
    var li = el("li", "row" + (cls ? " " + cls : ""));
    li.appendChild(icon(iconName));
    return li;
  }

  function missingSpan(text) {
    return el("span", "is-missing", text);
  }

  function appendBranchRows(ul, b) {
    // phone
    var phone = row("phone");
    var tel = telHref(b.phone);
    if (!isMissing(b.phone) && tel) {
      var pa = el("a", "", telLabel(b.phone));
      pa.href = tel;
      phone.appendChild(pa);
    } else {
      phone.appendChild(missingSpan("Teléfono por confirmar"));
    }
    ul.appendChild(phone);

    // address (+ optional map link)
    var addr = row("pin");
    var addrWrap = el("span", "row-text");
    if (isMissing(b.address)) {
      addrWrap.appendChild(missingSpan("Dirección por confirmar"));
    } else {
      addrWrap.appendChild(el("span", "", b.address));
    }
    var map = safeUrl(b.mapUrl);
    if (map) {
      var ma = el("a", "map-link", "Ver en el mapa ↗");
      ma.href = map;
      ma.target = "_blank";
      ma.rel = "noopener";
      addrWrap.appendChild(ma);
    }
    addr.appendChild(addrWrap);
    ul.appendChild(addr);

    // e-mails
    var mails = (Array.isArray(b.emails) ? b.emails : []).filter(function (m) { return !isMissing(m); });
    if (!mails.length) {
      var em = row("mail");
      em.appendChild(missingSpan("Correo por confirmar"));
      ul.appendChild(em);
    }
    mails.forEach(function (m) {
      var li = row("mail");
      var addrText = str(m).trim();
      if (S.isEmail(addrText)) {
        var a = el("a", "", addrText);
        a.href = "mailto:" + addrText;
        li.appendChild(a);
      } else {
        li.appendChild(el("span", "", addrText));
      }
      ul.appendChild(li);
    });

    // hours
    var hours = (Array.isArray(b.hours) ? b.hours : []).filter(function (h) { return !isMissing(h); });
    var hli = row("clock");
    if (!hours.length) {
      hli.appendChild(missingSpan("Horario por confirmar"));
    } else {
      var hw = el("span", "row-text");
      hours.forEach(function (h) { hw.appendChild(el("span", "", h)); });
      hli.appendChild(hw);
    }
    ul.appendChild(hli);
  }

  function whatsappButton(b, cls) {
    var href = waLink(b.whatsapp);
    if (!href) return null;
    var a = el("a", cls);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(icon("whatsapp"));
    a.appendChild(el("span", "", "WhatsApp " + b.name));
    return a;
  }

  function renderBranchCards(branches) {
    var box = list("branches");
    if (!box) return;
    clear(box);
    setHidden(box, !branches.length);
    branches.forEach(function (b) {
      var card = el("article", "branch");
      card.setAttribute("data-branch-id", b.id);
      card.appendChild(el("h3", "branch-name", b.name));
      var photo = el("div", "branch-photo");
      photo.appendChild(makeImg(b.photo, "branch", "Sucursal " + b.name, { w: 1200, h: 800 }));
      card.appendChild(photo);
      var main = el("div", "branch-main");
      var wa = whatsappButton(b, "btn btn-gold branch-wa");
      if (wa) main.appendChild(wa);
      var ul = el("ul", "rows");
      appendBranchRows(ul, b);
      main.appendChild(ul);
      card.appendChild(main);
      box.appendChild(card);
    });
  }

  function renderFooterBranches(branches) {
    var box = list("footerBranches");
    if (!box) return;
    clear(box);
    branches.forEach(function (b) {
      var col = el("div", "fcol");
      col.appendChild(el("strong", "", b.name));
      var wa = whatsappButton(b, "flink");
      if (wa) col.appendChild(wa);
      var ul = el("ul", "rows");
      appendBranchRows(ul, b);
      col.appendChild(ul);
      box.appendChild(col);
    });
  }

  /* Branch segmented controls (radiogroup), one per mounted form; keyboard handling lives in quote-form.js. */
  function renderBranchSelector(branches) {
    var ids = branches.map(function (b) { return b.id; });
    if (ids.indexOf(state.selectedBranchId) === -1) state.selectedBranchId = ids.length ? ids[0] : "";
    qsa('[data-list="quoteBranches"]').forEach(function (box) {
      clear(box);
      branches.forEach(function (b) {
        var btn = el("button", "seg-btn", b.name);
        btn.type = "button";
        btn.setAttribute("role", "radio");
        btn.setAttribute("data-branch-id", b.id);
        box.appendChild(btn);
      });
    });
    syncBranchSelector();
  }

  function syncBranchSelector() {
    qsa('[data-list="quoteBranches"] .seg-btn').forEach(function (btn) {
      var on = btn.getAttribute("data-branch-id") === state.selectedBranchId;
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
      btn.classList.toggle("is-on", on);
    });
  }

  function setSelectedBranch(id) {
    if (state.selectedBranchId === id) return;
    state.selectedBranchId = id;
    syncBranchSelector();
    document.dispatchEvent(new CustomEvent("baristop:branch", { detail: { id: id } }));
  }

  function getBranch(id) {
    var found = null;
    state.branches.forEach(function (b) { if (b.id === id) found = b; });
    return found;
  }

  /* ---------- social ---------- */

  function renderSocialList(name, items, variant) {
    var box = list(name);
    if (!box) return;
    clear(box);
    setHidden(box, !items.length);
    items.forEach(function (s) {
      var href = safeUrl(s.url);
      var node = href ? el("a", "social-link") : el("span", "social-link is-static");
      if (href) {
        node.href = href;
        node.target = "_blank";
        node.rel = "noopener";
      }
      var key = str(s.id).toLowerCase();
      node.appendChild(icon(ICONS[key] ? key : "link"));
      var label = str(s.handle).trim() || str(s.name);
      node.appendChild(el("span", "", label));
      if (str(s.name).trim() && str(s.handle).trim()) node.setAttribute("aria-label", s.name + ": " + s.handle);
      var li = el("li", variant || "");
      li.appendChild(node);
      box.appendChild(li);
    });
  }

  /* ---------- alliances ---------- */

  function renderAlliances(items) {
    var box = list("alliances");
    var sec = qs("#alianzas");
    if (!box) return;
    clear(box);
    setHidden(sec, !items.length);
    items.forEach(function (a) {
      var href = safeUrl(a.url);
      var hasLogo = !!imageSrc(a.logo);
      var li = el("li", "alliance");
      var holder = href ? el("a", "alliance-box") : el("span", "alliance-box");
      if (href) {
        holder.href = href;
        holder.target = "_blank";
        holder.rel = "noopener";
        holder.setAttribute("aria-label", a.name);
      }
      if (hasLogo) {
        holder.appendChild(makeImg(a.logo, "logo", "", { w: 600, h: 300 }));
      } else {
        holder.classList.add("is-text");
        holder.appendChild(el("span", "alliance-text", a.name));
      }
      li.appendChild(holder);
      if (hasLogo) {
        if (!href) holder.setAttribute("title", a.name);
        li.appendChild(el("span", "sr-only", a.name));
      }
      box.appendChild(li);
    });
  }

  /* ---------- live region ---------- */

  // One polite live region for the whole page ("agregado a tu cotización", result counts...).
  function announce(text) {
    if (!live) {
      live = el("div", "sr-only");
      live.id = "live";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = "";
    window.setTimeout(function () { live.textContent = text; }, 40);
  }

  /* ---------- entry point ---------- */

  function render(content) {
    state.content = content;
    state.branches = content.branches;
    var site = content.site || {};
    renderTexts(site);
    renderAnnouncement(content.announcements);
    renderHeroStrip(content.heroImages, content);
    renderPromos(content.promos);
    renderNav(content);
    renderHomeCatalog(content);
    renderRecipes(content.recipes, site);
    renderBranchCards(content.branches);
    renderBranchSelector(content.branches);
    renderFooterBranches(content.branches);
    renderSocialList("social", content.social, "");
    renderSocialList("footerSocial", content.social, "");
    renderAlliances(content.alliances);
    setRootLinks();
    document.dispatchEvent(new CustomEvent("baristop:rendered", { detail: { content: content } }));
  }

  window.BaristopRender = {
    render: render,
    setSelectedBranch: setSelectedBranch,
    getBranch: getBranch,
    getSelectedBranch: function () { return getBranch(state.selectedBranchId); },
    hasContent: function () { return !!state.content; },
    getContent: function () { return state.content; },
    getSite: function () { return state.content ? state.content.site : {}; },
    getBranches: function () { return state.branches; },
    refreshBranchSelectors: function () { renderBranchSelector(state.branches); },
    waLink: waLink,
    dismissKey: DISMISS_KEY,
    // paths, links
    rootLink: rootLink,
    link: link,
    onHome: onHome,
    setRootLinks: setRootLinks,
    productLink: productLink,
    productRef: productRef,
    // DOM helpers shared with catalog.js / quote-list.js / quote-form.js
    el: el, clear: clear, qs: qs, qsa: qsa, icon: icon, str: str, fold: fold,
    makeImg: makeImg, imageSrc: imageSrc, safeUrl: safeUrl, announce: announce,
    // catalog model
    catalogIndex: catalogIndex, groupLabel: groupLabel, countText: countText,
    priceInfo: priceInfo, branchState: branchState, availLabel: availLabel, branchShort: branchShort,
    dot: dot, isExample: isExample, featuredProducts: featuredProducts,
    categoryCard: categoryCard, productCard: productCard, recipeCard: recipeCard,
    tileTarget: tileTarget
  };
})();
