/*
 * Baristop v2 — catalog shell: router + views (spec 12, 13, 18).
 *
 * One static page (catalogo/index.html) renders the catalog index, a group, a category, a
 * product and a search from location.search. Links are real <a href>; clicks on same-page
 * links are intercepted and routed with pushState, Back/Forward re-render from popstate.
 * Everything that carries data from the Sheet is built with createElement / textContent.
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var C = window.BaristopContent;
  var R = window.BaristopRender;
  var QL = window.BaristopQuoteList;
  var QF = window.BaristopQuoteForm;
  var view = document.getElementById("view");
  if (!view || !R || !S || !C) return;

  var el = R.el, clear = R.clear, fold = R.fold, str = R.str;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
  var SORTS = ["precio-asc", "precio-desc", "nombre"];
  var SORT_LABELS = { "": "Recomendado", "precio-asc": "Precio: menor a mayor", "precio-desc": "Precio: mayor a menor", nombre: "Nombre A–Z" };
  var GROUPS = ["maquinaria", "insumos"];

  var content = null;
  var idx = null;
  var route = null;
  var renderedSearch = null;
  var lastKey = "";
  var ui = { qty: 1, pendingV: "", warnedV: "" };
  var lightbox = null;

  /* ---------- route parsing (spec 12.2) ---------- */

  function readParams(search) {
    var out = Object.create(null);
    String(search || "").replace(/^\?/, "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      var k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : kv.slice(i + 1);
      try {
        k = decodeURIComponent(k.replace(/\+/g, " "));
        v = decodeURIComponent(v.replace(/\+/g, " "));
      } catch (e) { return; } // malformed escape: the parameter is treated as absent
      if (!(k in out)) out[k] = v;
    });
    return out;
  }

  // Free text (q, marca): strip control characters, trim, cap at 60. No character allowlist.
  function cleanText(v) {
    var t = str(v).replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (t.length > 60) t = t.slice(0, 60).trim();
    return t;
  }

  function parseRoute(search) {
    var q = readParams(search);
    var r = { view: "index", id: "", v: "", q: "", filters: { marca: "", disp: false, suc: "", orden: "" } };
    function has(name) { return name in q; }
    function ok(name, re) { return has(name) && re.test(q[name]); }
    if (has("p")) {
      if (!ok("p", SLUG_RE)) return { view: "notfound", filters: r.filters };
      r.view = "product";
      r.id = q.p;
      r.v = has("v") ? q.v : "";
      return r;
    }
    if (has("c")) {
      if (!ok("c", ID_RE)) return { view: "notfound", filters: r.filters };
      r.view = "category";
      r.id = q.c;
      r.filters.marca = cleanText(q.marca);
      r.filters.disp = q.disp === "1";
      r.filters.suc = ok("suc", ID_RE) ? q.suc : "";
      if (r.filters.suc) r.filters.disp = true; // a branch only means something together with "disponible ahora"
      r.filters.orden = SORTS.indexOf(q.orden) !== -1 ? q.orden : "";
      return r;
    }
    if (has("g")) {
      if (GROUPS.indexOf(q.g) === -1) return { view: "notfound", filters: r.filters };
      r.view = "group";
      r.id = q.g;
      return r;
    }
    if (has("q")) {
      r.view = "search";
      r.q = cleanText(q.q);
    }
    return r;
  }

  function enc(v) { return encodeURIComponent(v); }

  function routeQuery(r) {
    var p = [];
    if (r.view === "product") { p.push("p=" + enc(r.id)); if (r.v) p.push("v=" + enc(r.v)); }
    else if (r.view === "category") {
      p.push("c=" + enc(r.id));
      var f = r.filters;
      if (f.marca) p.push("marca=" + enc(f.marca));
      if (f.disp) p.push("disp=1");
      if (f.suc) p.push("suc=" + enc(f.suc));
      if (f.orden) p.push("orden=" + enc(f.orden));
    }
    else if (r.view === "group") p.push("g=" + enc(r.id));
    else if (r.view === "search") p.push("q=" + enc(r.q));
    return p.length ? "?" + p.join("&") : "";
  }
  function hrefFor(r) { return R.link("catalogo" + routeQuery(r)); }

  // replaceState for filter / variant changes: no history entry, hash and state kept.
  function replaceRoute() {
    var href = hrefFor(route) + window.location.hash;
    try { window.history.replaceState(window.history.state, "", href); } catch (e) { /* ignore */ }
    renderedSearch = window.location.search;
  }

  /* ---------- small builders ---------- */

  function h1(text) {
    var n = el("h1", "view-title", text);
    n.tabIndex = -1;
    return n;
  }
  function link(cls, text, href) {
    var a = el("a", cls, text);
    a.href = href;
    return a;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function lines(text) {
    return str(text).split(/\r?\n/);
  }

  function waButtons(textFor, cls) {
    var box = el("div", "wa-row");
    (content.branches || []).forEach(function (b) {
      var href = R.waLink(b.whatsapp, textFor(b));
      if (!href) return;
      var a = el("a", cls || "btn btn-gold");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.appendChild(R.icon("whatsapp"));
      a.appendChild(el("span", "", "WhatsApp " + b.name));
      a.setAttribute("data-branch-id", b.id);
      box.appendChild(a);
    });
    return box;
  }

  // "¿No encuentras algo?" band (13.1, 18.1).
  function waBand(title, text, textFor) {
    var band = el("section", "wa-band");
    band.appendChild(el("h2", "", title || "¿No encuentras algo?"));
    band.appendChild(el("p", "", text || "Cotiza por WhatsApp y te enviamos opciones."));
    band.appendChild(waButtons(textFor || function (b) { return "Hola Baristop " + b.name + ", busco un producto y quiero una cotización."; }, "btn btn-gold"));
    return band;
  }

  function productGrid(products, opts) {
    var grid = el("div", "pgrid");
    var frag = document.createDocumentFragment();
    products.forEach(function (p) { frag.appendChild(R.productCard(p, content, opts)); });
    grid.appendChild(frag);
    return grid;
  }

  function featuredBlock(group) {
    var items = R.featuredProducts(content, group, 8);
    if (!items.length) return null;
    var site = content.site;
    var sec = el("section", "view-sec");
    sec.appendChild(el("p", "seal-label", "Destacados"));
    sec.appendChild(el("h2", "view-h2", site.featuredTitle));
    if (str(site.featuredIntro).trim()) sec.appendChild(el("p", "view-intro", site.featuredIntro));
    sec.appendChild(productGrid(items));
    return sec;
  }

  function emptyBand(group) {
    var box = el("section", "empty-band");
    box.appendChild(el("p", "", content.site.catalogEmptyCategory));
    box.appendChild(waButtons(function (b) { return "Hola Baristop " + b.name + ", busco opciones de " + (group || "catálogo") + ". ¿Me pueden ayudar?"; }, "btn btn-gold"));
    box.appendChild(link("btn btn-outline", "Ver otras líneas", R.link("catalogo")));
    return box;
  }

  /* ---------- views ---------- */

  // Each view returns { node, h1, title, description, crumbs }.

  function crumbBase() {
    return [{ label: "Inicio", href: R.link("") }, { label: "Catálogo", href: R.link("catalogo") }];
  }

  function viewIndex(hint) {
    var site = content.site;
    var box = el("div", "view-index");
    var title = h1(site.catalogIndexTitle || "Catálogo");
    box.appendChild(title);
    if (str(site.catalogIndexIntro).trim()) box.appendChild(el("p", "view-intro", site.catalogIndexIntro));
    if (hint) {
      var hp = el("p", "search-hint", "Escribe al menos 2 letras.");
      hp.setAttribute("role", "status");
      box.appendChild(hp);
    }
    var any = false;
    GROUPS.forEach(function (g) {
      var cats = idx.groups[g];
      if (!cats.length) return;
      any = true;
      var sec = el("section", "view-sec");
      var head = el("div", "view-sec-head");
      head.appendChild(el("p", "seal-label", R.groupLabel(site, g)));
      head.appendChild(link("block-all", (g === "maquinaria" ? "Ver toda la maquinaria" : "Ver todos los insumos") + " →", R.link("catalogo?g=" + g)));
      sec.appendChild(head);
      var grid = el("div", "mgrid");
      cats.forEach(function (c) { grid.appendChild(R.categoryCard(c, (idx.prodsByCat[c.id] || []).length)); });
      sec.appendChild(grid);
      box.appendChild(sec);
    });
    if (!any) box.appendChild(emptyBand(""));
    var feat = featuredBlock("");
    if (feat) box.appendChild(feat);
    box.appendChild(waBand());
    return {
      node: box, h1: title, title: "Catálogo · Baristop",
      description: str(site.catalogIndexIntro) || "Catálogo de maquinaria e insumos Baristop.",
      crumbs: [crumbBase()[0], { label: "Catálogo" }]
    };
  }

  function viewGroup(g) {
    var site = content.site;
    var label = R.groupLabel(site, g);
    var cats = idx.groups[g];
    var box = el("div", "view-group");
    var title = h1(label);
    box.appendChild(title);
    var intro = g === "maquinaria" ? site.groupMachineryIntro : site.groupSuppliesIntro;
    if (str(intro).trim()) box.appendChild(el("p", "view-intro", intro));
    if (!cats.length) {
      box.appendChild(emptyBand(label.toLowerCase()));
      box.appendChild(link("btn btn-wine", "Ver todo el catálogo", R.link("catalogo")));
    } else {
      var grid = el("div", "mgrid");
      cats.forEach(function (c) { grid.appendChild(R.categoryCard(c, (idx.prodsByCat[c.id] || []).length)); });
      box.appendChild(grid);
      var feat = featuredBlock(g);
      if (feat) box.appendChild(feat);
      box.appendChild(waBand());
    }
    return {
      node: box, h1: title, title: label + " · Catálogo Baristop",
      description: str(intro) || label + " Baristop.",
      crumbs: crumbBase().concat([{ label: label }])
    };
  }

  /* ----- category: filters ----- */

  function priceOf(p) {
    var sum = S.priceSummary(idx.varsByProd[p.id] || []);
    return sum.min == null ? null : sum.min;
  }

  function availableNow(p, branchId) {
    return (idx.varsByProd[p.id] || []).some(function (v) {
      var a = v.availability || {};
      if (branchId) return a[branchId] === "disponible" || a[branchId] === "pocas";
      return Object.keys(a).some(function (k) { return a[k] === "disponible" || a[k] === "pocas"; });
    });
  }

  function applyFilters(products, f) {
    var out = products.filter(function (p) {
      if (f.marca && fold(p.brand) !== fold(f.marca)) return false;
      if (f.disp && !availableNow(p, f.suc)) return false;
      return true;
    });
    if (f.orden === "precio-asc" || f.orden === "precio-desc") {
      var dir = f.orden === "precio-asc" ? 1 : -1;
      out = out.map(function (p, i) { return { p: p, i: i, pr: priceOf(p) }; }).sort(function (a, b) {
        if (a.pr == null && b.pr == null) return a.i - b.i;
        if (a.pr == null) return 1;   // products without a price sort last in both orders
        if (b.pr == null) return -1;
        return a.pr === b.pr ? a.i - b.i : (a.pr - b.pr) * dir;
      }).map(function (x) { return x.p; });
    } else if (f.orden === "nombre") {
      out = out.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "es"); });
    }
    return out;
  }

  function chip(text, pressed, attrs) {
    var b = el("button", "fchip", text);
    b.type = "button";
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    for (var k in attrs) b.setAttribute(k, attrs[k]);
    return b;
  }

  function trapTab(e, container) {
    if (e.key !== "Tab") return;
    var nodes = R.qsa(FOCUSABLE, container).filter(function (n) { return n.offsetParent !== null; });
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function viewCategory(cat) {
    var site = content.site;
    var prods = idx.prodsByCat[cat.id] || [];
    var box = el("div", "view-category");
    var title = h1(cat.name);
    box.appendChild(title);
    if (str(cat.tagline).trim()) box.appendChild(el("p", "view-sub", cat.tagline));
    if (str(cat.description).trim()) box.appendChild(el("p", "view-desc", cat.description));
    var countEl = el("p", "view-count", prods.length ? plural(prods.length, "producto", "productos") : "Próximamente");
    box.appendChild(countEl);

    var groupLabel = R.groupLabel(site, cat.group);
    var res = {
      node: box, h1: title, title: cat.name + " · Catálogo Baristop",
      description: str(cat.tagline) || str(cat.description) || cat.name,
      crumbs: crumbBase().concat([{ label: groupLabel, href: R.link("catalogo?g=" + cat.group) }, { label: cat.name }])
    };
    if (!prods.length) {
      box.appendChild(emptyBand(cat.name.toLowerCase()));
      return res;
    }

    var brands = [], seen = {};
    prods.forEach(function (p) {
      var k = fold(p.brand);
      if (p.brand && !seen[k]) { seen[k] = true; brands.push(p.brand); }
    });

    var bar = el("div", "toolbar");
    var openBtn = el("button", "filters-open", "Filtrar y ordenar");
    openBtn.type = "button";
    openBtn.setAttribute("aria-haspopup", "dialog");
    var openBadge = el("span", "badge", "0");
    openBadge.hidden = true;
    openBtn.appendChild(openBadge);
    bar.appendChild(openBtn);

    var panel = el("div", "filters");
    panel.id = "filters";
    var sheetHead = el("div", "sheet-head");
    var sheetTitle = el("h2", "", "Filtrar y ordenar");
    sheetTitle.id = "filters-title";
    var done = el("button", "sheet-done", "Listo");
    done.type = "button";
    sheetHead.appendChild(sheetTitle);
    sheetHead.appendChild(done);
    panel.appendChild(sheetHead);

    function group(label) {
      var g = el("div", "fgroup");
      g.appendChild(el("span", "fgroup-label", label));
      var row = el("div", "fgroup-row");
      g.appendChild(row);
      panel.appendChild(g);
      return row;
    }
    var chips = { brand: [], disp: null, branches: [] };
    if (brands.length >= 2) {
      var rowB = group("Marca");
      brands.forEach(function (b) {
        var c = chip(b, false, { "data-marca": b });
        rowB.appendChild(c);
        chips.brand.push(c);
      });
    }
    var rowD = group("Disponibilidad");
    chips.disp = chip("Disponible ahora", false, { "data-disp": "1" });
    rowD.appendChild(chips.disp);
    var branches = content.branches || [];
    if (branches.length) {
      var rowS = group("Sucursal");
      branches.forEach(function (b) {
        var c = chip(b.name, false, { "data-suc": b.id });
        rowS.appendChild(c);
        chips.branches.push(c);
      });
    }
    var sortG = el("div", "fgroup fgroup-sort");
    var sortLabel = el("label", "fgroup-label", "Ordenar");
    sortLabel.setAttribute("for", "orden");
    var select = document.createElement("select");
    select.id = "orden";
    select.className = "fselect";
    select.setAttribute("aria-label", "Ordenar");
    ["", "precio-asc", "precio-desc", "nombre"].forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = SORT_LABELS[v];
      select.appendChild(o);
    });
    sortG.appendChild(sortLabel);
    sortG.appendChild(select);
    panel.appendChild(sortG);
    bar.appendChild(panel);

    var sheetBack = el("div", "sheet-backdrop");
    bar.appendChild(sheetBack);
    var active = el("div", "active-filters");
    bar.appendChild(active);
    box.appendChild(bar);

    var grid = el("div", "pgrid");
    grid.setAttribute("aria-busy", "false");
    box.appendChild(grid);
    var empty = el("div", "no-match");
    empty.hidden = true;
    empty.appendChild(el("p", "", "Ningún producto coincide con esos filtros."));
    var clearBtn = el("button", "btn btn-wine", "Quitar filtros");
    clearBtn.type = "button";
    clearBtn.setAttribute("data-clear", "");
    empty.appendChild(clearBtn);
    box.appendChild(empty);
    box.appendChild(waBand());

    function activeCount(f) { return (f.marca ? 1 : 0) + (f.disp ? 1 : 0); }

    function sync(announce) {
      var f = route.filters;
      chips.brand.forEach(function (c) { c.setAttribute("aria-pressed", fold(c.getAttribute("data-marca")) === fold(f.marca) ? "true" : "false"); });
      chips.disp.setAttribute("aria-pressed", f.disp ? "true" : "false");
      chips.branches.forEach(function (c) { c.setAttribute("aria-pressed", f.suc === c.getAttribute("data-suc") ? "true" : "false"); });
      select.value = f.orden;
      var list = applyFilters(prods, f);
      var frag = document.createDocumentFragment();
      list.forEach(function (p) { frag.appendChild(R.productCard(p, content)); });
      clear(grid);
      grid.appendChild(frag);
      grid.hidden = !list.length;
      empty.hidden = list.length > 0;
      var n = activeCount(f);
      countEl.textContent = n ? list.length + " de " + plural(prods.length, "producto", "productos") : plural(prods.length, "producto", "productos");
      openBadge.textContent = String(n);
      openBadge.hidden = !n;
      clear(active);
      if (n) {
        if (f.marca) active.appendChild(removable("Marca: " + f.marca, "marca"));
        if (f.disp) {
          var b = f.suc ? (branches.filter(function (x) { return x.id === f.suc; })[0] || { name: f.suc }) : null;
          active.appendChild(removable(b ? "Disponible en " + b.name : "Disponible ahora", "disp"));
        }
        var all = el("button", "linklike", "Quitar filtros");
        all.type = "button";
        all.setAttribute("data-clear", "");
        active.appendChild(all);
      }
      if (announce) R.announce(list.length + (list.length === 1 ? " producto" : " productos"));
    }

    function removable(text, what) {
      var b = el("button", "fchip is-active", text + " ×");
      b.type = "button";
      b.setAttribute("data-remove", what);
      b.setAttribute("aria-label", "Quitar filtro: " + text);
      return b;
    }

    function setFilters(patch) {
      for (var k in patch) route.filters[k] = patch[k];
      if (!route.filters.disp) route.filters.suc = "";
      replaceRoute();
      sync(true);
    }

    bar.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      var f = route.filters;
      if (t.hasAttribute("data-marca")) {
        setFilters({ marca: fold(f.marca) === fold(t.getAttribute("data-marca")) ? "" : t.getAttribute("data-marca") });
      } else if (t.hasAttribute("data-disp")) {
        setFilters({ disp: !f.disp, suc: f.disp ? "" : f.suc });
      } else if (t.hasAttribute("data-suc")) {
        var id = t.getAttribute("data-suc");
        if (f.suc === id) setFilters({ suc: "" });
        else setFilters({ suc: id, disp: true });
      } else if (t.hasAttribute("data-remove")) {
        var w = t.getAttribute("data-remove");
        setFilters(w === "marca" ? { marca: "" } : { disp: false, suc: "" });
      } else if (t.hasAttribute("data-clear")) {
        setFilters({ marca: "", disp: false, suc: "" });
      }
    });
    empty.addEventListener("click", function (e) {
      if (e.target.closest("[data-clear]")) setFilters({ marca: "", disp: false, suc: "" });
    });
    select.addEventListener("change", function () { setFilters({ orden: select.value }); });

    /* phone bottom sheet (focus trapped, Escape / backdrop / Listo close) */
    var sheetOpener = null;
    function sheetOpen() { return panel.classList.contains("is-sheet"); }
    function openSheet() {
      sheetOpener = document.activeElement;
      panel.classList.add("is-sheet");
      sheetBack.classList.add("is-open");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", "filters-title");
      document.documentElement.classList.add("no-scroll");
      done.focus();
    }
    function closeSheet() {
      if (!sheetOpen()) return;
      panel.classList.remove("is-sheet");
      sheetBack.classList.remove("is-open");
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      panel.removeAttribute("aria-labelledby");
      document.documentElement.classList.remove("no-scroll");
      if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus();
    }
    openBtn.addEventListener("click", openSheet);
    done.addEventListener("click", closeSheet);
    sheetBack.addEventListener("click", closeSheet);
    panel.addEventListener("keydown", function (e) {
      if (!sheetOpen()) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
      trapTab(e, panel);
    });

    sync(false);
    return res;
  }

  /* ----- product ----- */

  function galleryPhotos(p, v) {
    var arr = p.photos.slice();
    if (v && v.image) arr = [v.image].concat(arr.filter(function (u) { return u !== v.image; }));
    return arr;
  }

  function buildGallery(photos, name) {
    var wrap = el("div", "gallery");
    var stage = el("div", "g-stage");
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-label", "Fotos de " + name);
    var n = photos.length;
    if (!n) {
      var ph = el("div", "g-slide is-empty");
      ph.appendChild(R.makeImg("", "product", "", { w: 1200, h: 1200, eager: true }));
      stage.appendChild(ph);
    }
    photos.forEach(function (u, i) {
      var slide = el("button", "g-slide");
      slide.type = "button";
      slide.setAttribute("aria-label", "Ampliar foto " + (i + 1) + " de " + n);
      slide.setAttribute("data-i", String(i));
      slide.appendChild(R.makeImg(u, "product", n > 1 ? name + " — foto " + (i + 1) + " de " + n : name, { w: 1200, h: 1200, eager: i === 0, size: 1200 }));
      stage.appendChild(slide);
    });
    wrap.appendChild(stage);
    if (n > 1) {
      var thumbs = el("div", "g-thumbs");
      var dots = el("div", "g-dots");
      dots.setAttribute("aria-hidden", "true");
      photos.forEach(function (u, i) {
        var t = el("button", "g-thumb");
        t.type = "button";
        t.setAttribute("aria-label", "Foto " + (i + 1) + " de " + n);
        t.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        t.setAttribute("data-i", String(i));
        t.appendChild(R.makeImg(u, "product", "", { w: 120, h: 120, size: 200 }));
        thumbs.appendChild(t);
        dots.appendChild(el("span", "g-dot" + (i === 0 ? " is-on" : "")));
      });
      wrap.appendChild(thumbs);
      wrap.appendChild(dots);
      var raf = 0;
      stage.addEventListener("scroll", function () {
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = 0;
          var i = Math.round(stage.scrollLeft / Math.max(stage.clientWidth, 1));
          R.qsa(".g-thumb", thumbs).forEach(function (b, k) { b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
          R.qsa(".g-dot", dots).forEach(function (d, k) { d.classList.toggle("is-on", k === i); });
        });
      }, { passive: true });
      thumbs.addEventListener("click", function (e) {
        var t = e.target.closest(".g-thumb");
        if (!t) return;
        var i = Number(t.getAttribute("data-i"));
        stage.scrollTo({ left: i * stage.clientWidth, behavior: "smooth" });
      });
    }
    stage.addEventListener("click", function (e) {
      var s = e.target.closest(".g-slide[data-i]");
      if (s) openLightbox(photos, Number(s.getAttribute("data-i")), name);
    });
    return wrap;
  }

  /* lightbox (13.2): native <dialog>, Escape / backdrop / Cerrar */
  function openLightbox(photos, start, name) {
    var i = start;
    if (!lightbox) {
      lightbox = el("dialog", "lightbox");
      lightbox.setAttribute("aria-label", "Foto ampliada");
      lightbox.fig = el("div", "lb-fig");
      lightbox.count = el("p", "lb-count");
      lightbox.close_ = el("button", "lb-close", "Cerrar");
      lightbox.close_.type = "button";
      lightbox.prev = el("button", "lb-nav lb-prev", "‹");
      lightbox.next = el("button", "lb-nav lb-next", "›");
      lightbox.prev.type = lightbox.next.type = "button";
      lightbox.prev.setAttribute("aria-label", "Foto anterior");
      lightbox.next.setAttribute("aria-label", "Foto siguiente");
      [lightbox.close_, lightbox.fig, lightbox.prev, lightbox.next, lightbox.count].forEach(function (n) { lightbox.appendChild(n); });
      document.body.appendChild(lightbox);
      lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lightbox.close(); });
      lightbox.close_.addEventListener("click", function () { lightbox.close(); });
      lightbox.addEventListener("close", function () { document.documentElement.classList.remove("lb-open"); });
      lightbox.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") lightbox.step(-1);
        else if (e.key === "ArrowRight") lightbox.step(1);
        else trapTab(e, lightbox);
      });
      lightbox.prev.addEventListener("click", function () { lightbox.step(-1); });
      lightbox.next.addEventListener("click", function () { lightbox.step(1); });
    }
    function paint() {
      clear(lightbox.fig);
      lightbox.fig.appendChild(R.makeImg(photos[i], "product", photos.length > 1 ? name + " — foto " + (i + 1) + " de " + photos.length : name, { w: 1200, h: 1200, eager: true, size: 1200 }));
      lightbox.count.textContent = photos.length > 1 ? (i + 1) + " / " + photos.length : "";
      lightbox.prev.hidden = lightbox.next.hidden = photos.length < 2;
    }
    lightbox.step = function (d) { i = (i + d + photos.length) % photos.length; paint(); };
    paint();
    document.documentElement.classList.add("lb-open");
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
  }

  function parseSpecs(lns) {
    return lns.map(function (line) {
      var i = line.indexOf(":");
      if (i < 1) return { single: line.trim() };
      return { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    }).filter(function (r) { return r.single || r.label; });
  }

  function usageNodes(text) {
    var frag = document.createDocumentFragment();
    var para = [], bullets = null;
    function flushPara() {
      if (para.length) { frag.appendChild(el("p", "usage-p", para.join("\n"))); para = []; }
    }
    function flushBullets() {
      if (bullets) { frag.appendChild(bullets); bullets = null; }
    }
    lines(text).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flushPara(); flushBullets(); return; }
      if (/^-\s+/.test(line)) {
        flushPara();
        if (!bullets) bullets = el("ul", "usage-list");
        bullets.appendChild(el("li", "", line.replace(/^-\s+/, "")));
      } else {
        flushBullets();
        para.push(line);
      }
    });
    flushPara();
    flushBullets();
    return frag;
  }

  function pdpSection(id, title) {
    var sec = el("section", "pdp-sec");
    sec.id = id;
    sec.appendChild(el("h2", "view-h2", title));
    return sec;
  }

  function relatedProducts(p) {
    var out = [], seen = {};
    seen[p.id] = true;
    p.relatedProducts.forEach(function (id) {
      var x = idx.prodById[id];
      if (x && !seen[x.id] && out.length < 4) { seen[x.id] = true; out.push(x); }
    });
    if (out.length < 3) {
      (idx.prodsByCat[p.categoryId] || []).forEach(function (x) {
        if (!seen[x.id] && out.length < 4) { seen[x.id] = true; out.push(x); }
      });
    }
    return out;
  }

  function viewProduct() {
    var p = idx.prodBySlug[route.id] || idx.prodById[route.id];
    if (!p) return viewNotFound();
    var site = content.site;
    var cat = idx.catById[p.categoryId];
    var vars = idx.varsByProd[p.id] || [];
    var branches = content.branches || [];

    /* variant selection: hidden / unknown `v` falls back to the first visible variant */
    var want = route.v || ui.pendingV;
    var variant = null;
    vars.forEach(function (x) { if (x.id === want) variant = x; });
    if (want && !variant) {
      variant = vars[0] || null;
      if (route.v) {
        ui.pendingV = route.v; // remembered: a newer content layer may know it
        route.v = "";
        replaceRoute();
        if (ui.warnedV !== ui.pendingV) {
          ui.warnedV = ui.pendingV;
          R.announce("Esa presentación ya no está disponible; te mostramos otra.");
        }
      }
    } else if (variant) {
      if (ui.pendingV) { route.v = variant.id; replaceRoute(); }
      ui.pendingV = "";
    } else {
      variant = vars[0] || null;
    }

    var box = el("article", "pdp");
    var galleryCol = el("div", "pdp-gallery");
    var buy = el("div", "pdp-buy");
    var galleryKey = "";
    var galleryNode = null;

    function renderGallery() {
      var photos = galleryPhotos(p, variant);
      var key = photos.join("|");
      if (key === galleryKey && galleryNode) return;
      galleryKey = key;
      var next = buildGallery(photos, p.name);
      if (galleryNode) galleryCol.replaceChild(next, galleryNode); else galleryCol.appendChild(next);
      galleryNode = next;
    }

    /* buy column */
    if (p.brand) buy.appendChild(el("p", "pdp-brand seal-label", p.brand));
    var title = el("h1", "pdp-title", p.name);
    title.tabIndex = -1;
    if (R.isExample(p)) {
      title.appendChild(document.createTextNode(" "));
      title.appendChild(el("span", "ej-tag ej-inline", "Ejemplo"));
    }
    buy.appendChild(title);
    if (str(p.summary).trim()) buy.appendChild(el("p", "pdp-summary", p.summary));

    var descText = str(p.description).trim();
    if (descText) {
      var d = el("div", "pdp-desc desc-desktop");
      var dp = el("p", descText.length > 300 ? "is-clamped" : "", descText);
      d.appendChild(dp);
      if (descText.length > 300) {
        var more = el("button", "linklike", "Leer más");
        more.type = "button";
        more.setAttribute("aria-expanded", "false");
        more.addEventListener("click", function () {
          var open = more.getAttribute("aria-expanded") !== "true";
          more.setAttribute("aria-expanded", open ? "true" : "false");
          more.textContent = open ? "Leer menos" : "Leer más";
          dp.classList.toggle("is-clamped", !open);
        });
        d.appendChild(more);
      }
      buy.appendChild(d);
    }

    /* variant chips */
    var chipsBox = null;
    if (vars.length > 1) {
      var vg = el("div", "vgroup");
      var vl = el("span", "vgroup-label", site.variantLabel || "Presentación");
      vl.id = "vlabel";
      vg.appendChild(vl);
      chipsBox = el("div", "vchips");
      chipsBox.setAttribute("role", "radiogroup");
      chipsBox.setAttribute("aria-labelledby", "vlabel");
      vars.forEach(function (x) {
        var soldOut = branches.length > 0 && branches.every(function (b) { return (x.availability || {})[b.id] === "agotado"; });
        var c = el("button", "vchip" + (soldOut ? " is-soldout" : ""));
        c.type = "button";
        c.setAttribute("role", "radio");
        c.setAttribute("data-vid", x.id);
        c.appendChild(el("span", "vchip-dot")).setAttribute("aria-hidden", "true");
        c.appendChild(el("span", "", x.name));
        if (soldOut) c.appendChild(el("span", "sr-only", " (agotado)"));
        chipsBox.appendChild(c);
      });
      vg.appendChild(chipsBox);
      buy.appendChild(vg);
    }

    /* shelf tag (13.2): the signature element */
    var tag = el("div", "shelf-tag");
    tag.setAttribute("role", "group");
    tag.setAttribute("aria-label", "Precio y disponibilidad");
    var tagBody = el("div", "st-body");
    tagBody.setAttribute("aria-live", "polite");
    tagBody.setAttribute("aria-atomic", "true");
    tag.appendChild(tagBody);
    buy.appendChild(tag);

    function renderTag() {
      clear(tagBody);
      var info = variant ? R.priceInfo([variant]) : { kind: "none", text: "Precio a cotizar", unit: "" };
      var row = el("div", "st-row");
      var price = el("p", "st-price" + (info.kind === "none" ? " is-quote" : ""));
      price.appendChild(el("span", "st-amount", info.text));
      if (info.unit) price.appendChild(el("span", "st-unit", " / " + info.unit));
      row.appendChild(price);
      if (variant) row.appendChild(el("p", "st-variant", variant.name));
      tagBody.appendChild(row);
      if (variant && variant.sku) tagBody.appendChild(el("p", "st-sku", "SKU " + variant.sku));
      var note = info.kind === "none" ? site.priceToQuoteNote : site.priceNote;
      if (str(note).trim()) tagBody.appendChild(el("p", "st-note", note));
      var ul = el("ul", "avail");
      branches.forEach(function (b) {
        var st = variant && variant.availability ? variant.availability[b.id] || "" : "";
        var li = el("li", "av av-" + (st || "none"));
        li.appendChild(R.dot(st));
        li.appendChild(el("span", "av-branch", b.name));
        li.appendChild(el("span", "av-state", R.availLabel(st)));
        ul.appendChild(li);
      });
      if (branches.length) tagBody.appendChild(ul);
      if (str(site.availabilityNote).trim() && branches.length) tagBody.appendChild(el("p", "st-avnote", site.availabilityNote));
    }

    /* quantity + add */
    var buyRow = el("div", "buy-row");
    var step = el("div", "stepper");
    step.setAttribute("role", "group");
    step.setAttribute("aria-label", "Cantidad");
    var minus = el("button", "step-btn", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Quitar uno");
    var qty = document.createElement("input");
    qty.type = "text";
    qty.inputMode = "numeric";
    qty.className = "step-input";
    qty.value = String(ui.qty);
    qty.setAttribute("aria-label", "Cantidad");
    qty.setAttribute("min", "1");
    qty.setAttribute("max", "999");
    var plus = el("button", "step-btn", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Agregar uno");
    step.appendChild(minus);
    step.appendChild(qty);
    step.appendChild(plus);
    var addBtn = el("button", "btn btn-gold add-btn", "Agregar a mi cotización");
    addBtn.type = "button";
    buyRow.appendChild(step);
    buyRow.appendChild(addBtn);
    buy.appendChild(buyRow);
    var added = el("p", "added-line");
    added.hidden = true;
    var viewList = el("button", "linklike", "Ver mi cotización");
    viewList.type = "button";
    viewList.setAttribute("data-qlist-open", "");
    added.appendChild(viewList);
    buy.appendChild(added);

    var waBox = el("div", "pdp-wa");
    waBox.appendChild(el("span", "pdp-wa-label", "¿Prefieres escribirnos?"));
    var waRow = el("div", "wa-row");
    branches.forEach(function (b) {
      var a = el("a", "btn btn-outline");
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("data-branch-id", b.id);
      a.appendChild(R.icon("whatsapp"));
      a.appendChild(el("span", "", "WhatsApp " + b.name));
      waRow.appendChild(a);
    });
    if (waRow.firstChild) { waBox.appendChild(waRow); buy.appendChild(waBox); }

    function updateWa() {
      R.qsa("a[data-branch-id]", waRow).forEach(function (a) {
        var b = branches.filter(function (x) { return x.id === a.getAttribute("data-branch-id"); })[0];
        var text = "Hola Baristop " + b.name + ", me interesa: " + p.name + (variant ? " · " + variant.name : "") + " · " + ui.qty + " pza(s). ¿Me pueden cotizar?";
        a.href = R.waLink(b.whatsapp, text) || "#";
      });
    }

    function setQty(n) {
      n = Math.floor(Number(n));
      ui.qty = n >= 1 ? Math.min(n, 999) : 1;
      qty.value = String(ui.qty);
      updateWa();
    }
    minus.addEventListener("click", function () { setQty(ui.qty - 1); });
    plus.addEventListener("click", function () { setQty(ui.qty + 1); });
    qty.addEventListener("change", function () { setQty(qty.value); });
    qty.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); setQty(qty.value); } });

    /* sticky phone bar */
    var bar = el("div", "buy-bar");
    var barPrice = el("p", "bb-price");
    var barBtn = el("button", "btn btn-gold add-btn", "Agregar a mi cotización");
    barBtn.type = "button";
    bar.appendChild(barPrice);
    bar.appendChild(barBtn);

    function renderBar() {
      var info = variant ? R.priceInfo([variant]) : { kind: "none", text: "Precio a cotizar", unit: "" };
      barPrice.textContent = info.text + (info.unit ? " / " + info.unit : "");
      barPrice.classList.toggle("is-quote", info.kind === "none");
    }

    var resetTimer = 0;
    function add() {
      var res = QL ? QL.add(p.id, variant ? variant.id : "", ui.qty) : { ok: false };
      if (!res.ok) {
        R.announce(res.reason === "full" ? "Tu lista ya tiene 40 productos. Quita alguno para agregar más." : "No pudimos agregar el producto.");
        return;
      }
      R.announce(p.name + (variant ? " · " + variant.name : "") + " agregado a tu cotización");
      [addBtn, barBtn].forEach(function (b) { b.textContent = "Agregado ✓"; });
      added.hidden = false;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        [addBtn, barBtn].forEach(function (b) { b.textContent = "Agregar a mi cotización"; });
      }, 1600);
    }
    addBtn.addEventListener("click", add);
    barBtn.addEventListener("click", add);

    /* variant switching */
    function syncChips() {
      if (!chipsBox) return;
      R.qsa(".vchip", chipsBox).forEach(function (c) {
        var on = !!variant && c.getAttribute("data-vid") === variant.id;
        c.setAttribute("aria-checked", on ? "true" : "false");
        c.tabIndex = on ? 0 : -1;
        c.classList.toggle("is-on", on);
      });
    }
    function pick(btn) {
      var id = btn.getAttribute("data-vid");
      var next = vars.filter(function (x) { return x.id === id; })[0];
      if (!next || next === variant) return;
      variant = next;
      ui.pendingV = "";
      route.v = variant.id;
      replaceRoute();
      renderGallery();
      renderTag();
      renderBar();
      syncChips();
      updateWa();
    }
    if (chipsBox) {
      if (QF) QF.wireRadioGroup(chipsBox, pick);
      else chipsBox.addEventListener("click", function (e) { var c = e.target.closest(".vchip"); if (c) pick(c); });
    }

    renderGallery();
    renderTag();
    renderBar();
    syncChips();
    updateWa();

    box.appendChild(galleryCol);
    box.appendChild(buy);

    /* below the fold */
    var below = el("div", "pdp-below");
    if (descText) {
      var dm = el("div", "pdp-desc desc-mobile");
      dm.appendChild(el("p", "", descText));
      below.appendChild(dm);
    }
    var specs = parseSpecs(p.specs);
    if (specs.length) {
      var ss = pdpSection("especificaciones", "Especificaciones");
      var table = el("table", "specs-table");
      var tb = el("tbody");
      specs.forEach(function (r) {
        var tr = el("tr");
        if (r.single) {
          var td0 = el("td", "", r.single);
          td0.colSpan = 2;
          tr.appendChild(td0);
        } else {
          var th = el("th", "", r.label);
          th.scope = "row";
          tr.appendChild(th);
          tr.appendChild(el("td", /^por definir$/i.test(r.value) ? "is-missing" : "", r.value));
        }
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      ss.appendChild(table);
      below.appendChild(ss);
    }
    if (str(p.usage).trim()) {
      var us = pdpSection("uso", "Guía de uso");
      var ub = el("div", "usage");
      ub.appendChild(usageNodes(p.usage));
      us.appendChild(ub);
      below.appendChild(us);
    }
    var recipes = p.relatedRecipes.map(function (id) { return idx.recipeById[id]; }).filter(Boolean);
    if (recipes.length) {
      var rs = pdpSection("recetas", "Recetas con este producto");
      var rg = el("div", "rgrid");
      recipes.forEach(function (r) { rg.appendChild(R.recipeCard(r)); });
      rs.appendChild(rg);
      below.appendChild(rs);
    }
    var related = relatedProducts(p);
    if (related.length) {
      var rl = pdpSection("relacionados", "También te puede interesar");
      rl.appendChild(productGrid(related));
      below.appendChild(rl);
    }
    box.appendChild(below);
    box.appendChild(bar);

    var crumbs = crumbBase();
    if (cat) {
      crumbs.push({ label: R.groupLabel(site, cat.group), href: R.link("catalogo?g=" + cat.group) });
      crumbs.push({ label: cat.name, href: R.link("catalogo?c=" + cat.id) });
    }
    crumbs.push({ label: p.name });
    var desc = str(p.summary).trim() || descText;
    return {
      node: box, h1: title, title: p.name + " · Baristop",
      description: desc.length > 160 ? desc.slice(0, 157).trim() + "…" : desc,
      crumbs: crumbs
    };
  }

  /* ----- search ----- */

  function searchProducts(q) {
    var tokens = fold(q).split(/\s+/).filter(Boolean);
    var hits = [];
    idx.products.forEach(function (p, i) {
      var cat = idx.catById[p.categoryId];
      var vnames = (idx.varsByProd[p.id] || []).map(function (v) { return v.name; }).join(" ");
      var hay = fold([p.name, p.brand, p.summary, cat ? cat.name : "", vnames].join(" "));
      var nameHay = fold(p.name);
      var all = tokens.every(function (t) { return hay.indexOf(t) !== -1; });
      if (!all) return;
      hits.push({ p: p, i: i, inName: tokens.every(function (t) { return nameHay.indexOf(t) !== -1; }) });
    });
    hits.sort(function (a, b) { return a.inName === b.inName ? a.i - b.i : (a.inName ? -1 : 1); });
    return hits.map(function (h) { return h.p; });
  }

  function viewSearch() {
    var q = route.q;
    if (q.length < 2) {
      var r = viewIndex(true);
      r.title = "Buscar · Baristop";
      r.focusSearch = true;
      return r;
    }
    var hits = searchProducts(q);
    var box = el("div", "view-search");
    var title = h1("Resultados para \"" + q + "\"");
    box.appendChild(title);
    var count = el("p", "view-count", plural(hits.length, "producto", "productos"));
    count.setAttribute("role", "status");
    box.appendChild(count);
    if (hits.length) {
      box.appendChild(productGrid(hits, { crumb: true }));
    } else {
      var empty = el("section", "empty-band");
      empty.appendChild(el("p", "", "No encontramos \"" + q + "\". Prueba con otra palabra o escríbenos y te lo conseguimos."));
      empty.appendChild(waButtons(function (b) { return "Hola Baristop " + b.name + ", busco: " + q + ". ¿Me pueden ayudar?"; }, "btn btn-gold"));
      empty.appendChild(link("btn btn-outline", "Ver el catálogo", R.link("catalogo")));
      box.appendChild(empty);
    }
    return {
      node: box, h1: title, title: "Resultados para \"" + q + "\" · Baristop",
      description: "Resultados de búsqueda en el catálogo Baristop.",
      crumbs: crumbBase().concat([{ label: "Búsqueda" }])
    };
  }

  function viewNotFound() {
    var box = el("div", "view-notfound");
    var title = h1("No encontramos esa página del catálogo.");
    box.appendChild(title);
    box.appendChild(el("p", "view-intro", "Puede que el producto ya no esté publicado."));
    var row = el("div", "nf-actions");
    row.appendChild(link("btn btn-wine", "Ir al catálogo", R.link("catalogo")));
    row.appendChild(link("btn btn-outline", "Ir al inicio", R.link("")));
    box.appendChild(row);
    return { node: box, h1: title, title: "No encontrado · Baristop", description: "", crumbs: crumbBase(), notFound: true };
  }

  function viewLoading() {
    var box = el("div", "view-loading");
    var title = h1("Catálogo");
    box.appendChild(title);
    var grid = el("div", "pgrid");
    grid.setAttribute("aria-busy", "true");
    for (var i = 0; i < 6; i++) {
      var sk = el("div", "skel");
      sk.setAttribute("aria-hidden", "true");
      grid.appendChild(sk);
    }
    box.appendChild(grid);
    return { node: box, h1: title, title: "Catálogo · Baristop", description: "", crumbs: [crumbBase()[0], { label: "Catálogo" }] };
  }

  /* ---------- frame: crumbs, meta, search box ---------- */

  function setCrumbs(items) {
    var ol = document.getElementById("crumbs");
    if (!ol) return;
    clear(ol);
    items.forEach(function (c, i) {
      var li = el("li");
      if (c.href && i < items.length - 1) {
        li.appendChild(link("", c.label, c.href));
      } else {
        var s = el("span", "", c.label);
        if (i === items.length - 1) s.setAttribute("aria-current", "page");
        li.appendChild(s);
      }
      ol.appendChild(li);
    });
  }

  function setMeta(title, description) {
    document.title = title;
    var m = document.querySelector('meta[name="description"]');
    if (m && description) m.setAttribute("content", description);
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) {
      try {
        // Canonical is always the clean form (no slash, no index.html), without demo/nocache.
        var q = routeQuery(route || { view: "index", filters: {} });
        canon.setAttribute("href", window.location.origin + S.rootLink("catalogo" + q, { pathname: "/clean" }, window.BARISTOP_ROOT));
      } catch (e) { /* ignore */ }
    }
  }

  function syncSearchBox(focus) {
    var box = document.getElementById("buscar");
    if (!box) return;
    if (route && route.view === "search") box.value = route.q;
    else if (document.activeElement !== box) box.value = "";
    if (focus) box.focus();
  }

  /* ---------- render ---------- */

  function routeKey(r) { return r.view + "|" + r.id; }

  // opts: { nav: true } after a pushState (scroll top, focus h1), { keepScroll: true } on a content layer.
  function renderRoute(opts) {
    opts = opts || {};
    route = parseRoute(window.location.search);
    renderedSearch = window.location.search;
    var key = routeKey(route);
    if (key !== lastKey) { ui = { qty: 1, pendingV: "", warnedV: "" }; lastKey = key; }
    var y = window.scrollY;

    var res;
    if (!content) {
      if (route.view === "index" && !opts.nav && view.firstElementChild && !view.querySelector(".view-loading")) {
        setMeta("Catálogo · Baristop", "");
        syncSearchBox(false);
        return; // the inline index is the first paint
      }
      res = viewLoading();
    } else {
      idx = R.catalogIndex(content);
      switch (route.view) {
        case "product": res = viewProduct(); break;
        case "category":
          var cat = idx.catById[route.id];
          res = cat ? viewCategory(cat) : viewNotFound();
          break;
        case "group": res = viewGroup(route.id); break;
        case "search": res = viewSearch(); break;
        case "notfound": res = viewNotFound(); break;
        default: res = viewIndex(false);
      }
    }
    clear(view);
    view.appendChild(res.node);
    view.setAttribute("aria-busy", content ? "false" : "true");
    setCrumbs(res.crumbs);
    setMeta(res.title, res.description);
    syncSearchBox(!!res.focusSearch);

    if (opts.nav) {
      var hash = window.location.hash;
      var target = hash && hash !== "#lista" ? document.getElementById(hash.slice(1)) : null;
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      if (res.focusSearch) return;
      res.h1.focus({ preventScroll: true });
    } else if (opts.keepScroll) {
      window.scrollTo(0, y);
    } else if (opts.initialHash) {
      var t2 = document.getElementById(opts.initialHash.slice(1));
      if (t2) t2.scrollIntoView();
    }
  }

  /* ---------- navigation ---------- */

  function samePath(a, b) { return a.replace(/\/$/, "") === b.replace(/\/$/, ""); }

  function navigate(href) {
    var u = new URL(href, window.location.href);
    var target = u.pathname + u.search + u.hash;
    var current = window.location.pathname + window.location.search;
    try {
      window.history.replaceState(Object.assign({}, window.history.state || {}, { scrollY: window.scrollY }), "");
      if (u.pathname + u.search !== current) window.history.pushState({ scrollY: 0 }, "", target);
    } catch (e) { window.location.href = target; return; }
    renderRoute({ nav: true });
  }

  function go(href) {
    if (QL && QL.isOpen()) QL.close({ then: function () { navigate(href); } });
    else navigate(href);
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a[href]");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var u;
    try { u = new URL(a.href, window.location.href); } catch (err) { return; }
    if (u.origin !== window.location.origin || !samePath(u.pathname, window.location.pathname)) return;
    if (u.search === window.location.search && u.hash) return; // in-page anchor: native behaviour
    e.preventDefault();
    go(u.pathname + u.search + u.hash);
  });

  window.addEventListener("popstate", function () {
    if (window.location.search === renderedSearch) return; // hash / drawer-only change
    var st = window.history.state;
    renderRoute({});
    if (st && typeof st.scrollY === "number") window.scrollTo(0, st.scrollY); else window.scrollTo(0, 0);
  });

  var searchForm = document.getElementById("cat-search");
  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var box = document.getElementById("buscar");
      go(R.link("catalogo?q=" + enc(cleanText(box ? box.value : ""))));
    });
  }

  window.BaristopCatalog = { go: go, parseRoute: parseRoute };

  /* ---------- boot ---------- */

  try { window.history.scrollRestoration = "manual"; } catch (e) { /* ignore */ }

  var first = true;
  document.addEventListener("baristop:rendered", function (e) {
    content = e.detail.content;
    renderRoute(first ? { initialHash: window.location.hash !== "#lista" ? window.location.hash : "" } : { keepScroll: true });
    if (first) {
      first = false;
      if (QL) QL.openFromHash();
    }
  });

  // Before any content layer: show the inline index, or a skeleton for deeper routes.
  renderRoute({});
})();
