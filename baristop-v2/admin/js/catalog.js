/* Baristop admin — Catálogo (design spec §17).
 *
 * Three levels: Líneas (categories) -> Productos -> product editor with nested
 * Presentaciones (variants), plus the "Lista de precios" bulk table. The module owns
 * the catalog views, the client validation that mirrors Shared.validateSection and the
 * dependency-ordered save (§17.4). admin.js hands it a context (draft, content, helpers).
 * Everything that carries Sheet data is built with createElement / textContent. */
(function () {
  "use strict";

  var ui = window.AdminUI;
  var S = window.AdminSections;
  var IMG = window.AdminImages;
  var api = window.AdminApi;
  var el = ui.el;
  var SC = window.BaristopSchema || {};

  var ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
  var AV_STATES = SC.AVAILABILITY_STATES || ["disponible", "pocas", "pedido", "agotado"];
  var AV_LABELS = SC.AVAILABILITY_LABELS || { disponible: "Disponible", pocas: "Pocas piezas", pedido: "Bajo pedido", agotado: "Agotado" };
  var GROUPS = [{ value: "maquinaria", label: "Maquinaria" }, { value: "insumos", label: "Insumos" }];
  var MAX_PHOTOS = 6;
  var MAX_SPECS = 20;
  var MAX_RELATED = 10;
  var MAX_ROWS = { categories: 300, products: 300, variants: 500 };
  var MAX_PRICE = 9999999;
  var KEYS = ["categories", "products", "variants"];
  var NAMES = { categories: "Líneas", products: "Productos", variants: "Presentaciones" };
  var SAVED_PHRASE = { categories: "las líneas", products: "los productos", variants: "las presentaciones" };

  /* ============================================================
   * Pure helpers (fall back to local copies when schema.js predates them)
   * ============================================================ */
  function fold(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function slugify(name) {
    if (typeof SC.slugify === "function") return SC.slugify(name);
    return fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  }

  function formatMoney(n) {
    if (typeof SC.formatMoney === "function") return SC.formatMoney(n);
    var fixed = (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
    return "$" + fixed.replace(/\B(?=(\d{3})+(?!\d))/g, function (m, off, str) {
      return str.indexOf(".") !== -1 && off > str.indexOf(".") ? "" : ",";
    });
  }

  /* Card-style price text for a list of variants: "$1,250", "Desde $890" or "Precio a cotizar". */
  function priceLabel(variants) {
    var priced = variants.filter(function (v) { return typeof v.price === "number"; }).map(function (v) { return v.price; });
    if (!priced.length) return "Precio a cotizar";
    var min = Math.min.apply(null, priced);
    var max = Math.max.apply(null, priced);
    if (typeof SC.priceSummary === "function") {
      var r = SC.priceSummary(variants);
      if (r && r.kind === "none") return "Precio a cotizar";
      if (r && r.kind === "single") return formatMoney(r.min);
      if (r && r.kind === "from") return "Desde " + formatMoney(r.min);
    }
    return min === max && priced.length === variants.length ? formatMoney(min) : "Desde " + formatMoney(min);
  }

  /* Text typed in a price box -> { ok, value } (value null = empty = "Precio a cotizar"). */
  function parseMoney(text) {
    var t = String(text == null ? "" : text).replace(/[\s$]/g, "");
    if (t === "") return { ok: true, value: null };
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false };
    var n = Number(t);
    if (!isFinite(n) || n < 0 || n > MAX_PRICE) return { ok: false };
    return { ok: true, value: n };
  }

  function parseSpec(line) {
    var s = String(line == null ? "" : line);
    var i = s.indexOf(":");
    if (i < 0) return { label: "", value: s.trim() };
    return { label: s.slice(0, i).trim(), value: s.slice(i + 1).trim() };
  }

  function composeSpec(label, value) {
    var l = String(label || "").replace(/:/g, " ").replace(/\s+/g, " ").trim();
    var v = String(value || "").trim();
    if (!l && !v) return "";
    if (!l) return v;
    return v ? l + ": " + v : l + ":";
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function isExample(name) { return /\(ejemplo\)\s*$/i.test(String(name || "")); }
  function groupLabel(g) { return g === "maquinaria" ? "Maquinaria" : g === "insumos" ? "Insumos" : "Sin grupo"; }
  function rand36(n) { var s = ""; while (s.length < n) s += Math.floor(Math.random() * 36).toString(36); return s; }

  function genId(prefix, list) {
    var base = (slugify(prefix) || "item").slice(0, 30).replace(/-+$/, "");
    var id;
    do { id = base + "-" + rand36(4); } while (list.some(function (x) { return x.id === id; }));
    return id;
  }

  function uniqueFrom(base, takenFn) {
    var b = base;
    var n = 2;
    while (takenFn(b)) { b = base.slice(0, 56) + "-" + n; n += 1; }
    return b;
  }

  function branchAbbr(b) {
    var id = String(b.id || "");
    if (id === "durango") return "DGO";
    return (id.length <= 4 ? id : id.slice(0, 3)).toUpperCase();
  }

  /* ============================================================
   * Content normalisation (called by admin.js after the generic list pass)
   * ============================================================ */
  function asBool(v) { return v === true || v === "TRUE" || v === "true"; }
  function asStr(v) { return v == null ? "" : typeof v === "string" ? v : String(v); }
  function asArr(v, sep) {
    if (Array.isArray(v)) return v.map(asStr).map(function (x) { return x.trim(); }).filter(Boolean);
    if (typeof v === "string") return v.split(sep).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }
  function cmp(a, b) {
    var ao = typeof a.order === "number" ? a.order : parseInt(a.order, 10) || 0;
    var bo = typeof b.order === "number" ? b.order : parseInt(b.order, 10) || 0;
    return ao !== bo ? ao - bo : String(a.id).localeCompare(String(b.id));
  }

  function normalizeCatalog(c) {
    var imported = false;
    var hasLegacy = ["machineryCategories", "insumos", "machines"].some(function (k) { return Array.isArray(c[k]) && c[k].length; });
    var noCats = !Array.isArray(c.categories) || !c.categories.length;
    if (noCats && hasLegacy && typeof SC.legacyToCatalog === "function") {
      var derived = SC.legacyToCatalog(JSON.parse(JSON.stringify(c)));
      if (derived && derived.categories && derived.categories.length) {
        c.categories = derived.categories;
        c.products = derived.products || [];
        c.variants = derived.variants || [];
        imported = true;
      }
    }
    KEYS.forEach(function (k) {
      c[k] = (Array.isArray(c[k]) ? c[k] : []).filter(function (x) { return x && typeof x === "object"; });
    });
    c.categories.forEach(function (x) {
      x.visible = asBool(x.visible);
      ["id", "group", "name", "tagline", "description", "image"].forEach(function (k) { x[k] = asStr(x[k]); });
    });
    c.products.forEach(function (x) {
      x.visible = asBool(x.visible);
      x.featured = asBool(x.featured);
      ["id", "categoryId", "brand", "name", "slug", "summary", "description", "usage"].forEach(function (k) { x[k] = asStr(x[k]); });
      x.photos = asArr(x.photos, /\n+/);
      x.specs = asArr(x.specs, /\n+/);
      x.relatedRecipes = asArr(x.relatedRecipes, /[,\n]+/);
      x.relatedProducts = asArr(x.relatedProducts, /[,\n]+/);
    });
    c.variants.forEach(function (x) {
      x.visible = asBool(x.visible);
      ["id", "productId", "name", "sku", "unit", "image"].forEach(function (k) { x[k] = asStr(x[k]); });
      var pr = x.price;
      x.price = pr === "" || pr == null ? null : (typeof pr === "number" ? pr : Number(pr));
      if (x.price !== null && !isFinite(x.price)) x.price = null;
      var av = x.availability;
      if (typeof av === "string") {
        var m = {};
        av.split(";").forEach(function (pair) {
          var i = pair.indexOf("=");
          if (i > 0) m[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
        });
        av = m;
      }
      var clean = {};
      if (av && typeof av === "object" && !Array.isArray(av)) {
        Object.keys(av).forEach(function (k) {
          if (ID_RE.test(k) && AV_STATES.indexOf(av[k]) !== -1) clean[k] = av[k];
        });
      }
      x.availability = clean;
    });
    KEYS.forEach(function (k) { c[k].sort(cmp); });
    return { imported: imported };
  }

  /* ============================================================
   * Factory: one instance per admin session, bound to admin.js state
   * ============================================================ */
  function create(ctx) {
    var state = ctx.state;
    var DEMO = ctx.DEMO;

    function D() { return state.draft; }
    function byId(list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
    function variantsOf(pid) { return D().variants.filter(function (v) { return v.productId === pid; }); }
    function catIds() { return D().categories.map(function (c) { return c.id; }); }
    function catName(id) { var c = byId(D().categories, id); return c ? (c.name || "Sin nombre") : "Sin línea"; }
    function branches() { return (state.content.branches || []).filter(function (b) { return b.visible !== false; }); }
    function errKey(kind, id, field) { return kind + ":" + id + ":" + field; }
    function errOf(kind, id, field) { return state.catErrors[errKey(kind, id, field)] || ""; }
    function dirty() { ctx.markDirty(); }

    function isSafeImageRef(v) {
      if (typeof v !== "string" || !v) return false;
      if (/^data:image\//i.test(v)) return DEMO;
      if (/^https:/i.test(v)) return S.isSafeHttpsUrl(v);
      if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false;
      return !/(^|\/)\.\.(\/|$)/.test(v) && v.charAt(0) !== "/";
    }

    /* ---------------- small UI builders ---------------- */
    function focusIn(root, fk) {
      if (!fk) return;
      var n = root.querySelector('[data-fk="' + fk + '"]');
      if (n && n.disabled) {
        var alt = fk.indexOf("up:") === 0 ? "down:" + fk.slice(3) : fk.indexOf("down:") === 0 ? "up:" + fk.slice(5) : null;
        n = alt ? root.querySelector('[data-fk="' + alt + '"]') : null;
      }
      if (n && !n.disabled) n.focus({ preventScroll: true });
    }

    /* A labelled text input / textarea bound to obj[key]. */
    function textField(o) {
      var id = ui.uid("c");
      var hintId = id + "-hint";
      var errId = id + "-err";
      var obj = o.obj;
      var control = o.long ? el("textarea", { attrs: { id: id, rows: String(o.rows || 3) } }) : el("input", { attrs: { id: id, type: "text", autocomplete: "off" } });
      if (o.inputmode) control.setAttribute("inputmode", o.inputmode);
      if (o.ph) control.setAttribute("placeholder", o.ph);
      if (o.max) control.setAttribute("maxlength", String(o.max));
      if (o.spellcheck === false) control.setAttribute("spellcheck", "false");
      control.value = obj[o.key] == null ? "" : obj[o.key];
      if (o.required) control.setAttribute("aria-required", "true");
      var ids = [];
      if (o.hint) ids.push(hintId);
      if (o.counter) ids.push(id + "-count");
      ids.push(errId);
      control.setAttribute("aria-describedby", ids.join(" "));
      var msg = o.errKind ? errOf(o.errKind, obj.id, o.key) : "";
      var errEl = el("p", { cls: "field-error", attrs: { id: errId }, props: { hidden: !msg } }, msg);
      if (msg) control.setAttribute("aria-invalid", "true");
      var count = o.counter ? el("p", { cls: "hint counter", attrs: { id: id + "-count" } }) : null;
      function updateCount() { if (count) count.textContent = control.value.length + " / " + o.max; }
      control.addEventListener("input", function () {
        obj[o.key] = control.value;
        if (o.errKind && state.catErrors[errKey(o.errKind, obj.id, o.key)]) {
          delete state.catErrors[errKey(o.errKind, obj.id, o.key)];
          errEl.hidden = true; errEl.textContent = "";
          control.removeAttribute("aria-invalid");
        }
        updateCount();
        if (o.onInput) o.onInput(control.value);
        dirty();
      });
      if (o.onBlur) control.addEventListener("blur", function () { o.onBlur(control); });
      updateCount();
      var labelKids = [o.label];
      if (o.required) labelKids.push(el("span", { cls: "req", text: "*", attrs: { "aria-hidden": "true" } }));
      var wrap = el("div", { cls: "field" + (o.cls ? " " + o.cls : "") }, [
        el("label", { attrs: { for: id } }, labelKids),
        control,
        o.hint ? el("p", { cls: "hint", text: o.hint, attrs: { id: hintId } }) : null,
        count,
        errEl
      ]);
      return { wrap: wrap, input: control };
    }

    function toggle(label, getVal, setVal, fk) {
      var b = el("button", { cls: "switch", attrs: { type: "button", role: "switch", "aria-checked": getVal() ? "true" : "false", "data-fk": fk || null } },
        [el("span", { cls: "track", attrs: { "aria-hidden": "true" } }), el("span", { text: label })]);
      b.addEventListener("click", function () {
        var nv = !getVal();
        setVal(nv);
        b.setAttribute("aria-checked", nv ? "true" : "false");
        dirty();
      });
      return b;
    }

    function thumbFor(src, size) {
      var s = size || 72;
      var img = el("img", { cls: "thumb", attrs: { alt: "", width: String(s), height: String(s), loading: "lazy" } });
      var stage = 0;
      img.addEventListener("error", function () {
        stage += 1;
        if (stage === 1) { img.src = ctx.placeholderSrc("product-1x1.svg"); return; }
        var empty = el("div", { cls: "thumb thumb-empty", text: "Sin foto" });
        if (img.parentNode) img.parentNode.replaceChild(empty, img);
      });
      img.src = src || ctx.placeholderSrc("product-1x1.svg");
      return img;
    }

    function reorderBtns(label, idx, count, fk, onMove) {
      return el("div", { cls: "reorder", attrs: { role: "group", "aria-label": "Mover " + label } }, [
        el("button", { cls: "icon-btn", text: "▲", attrs: { type: "button", "aria-label": "Subir " + label, "data-fk": "up:" + fk }, props: { disabled: idx === 0 }, on: { click: function () { onMove(-1); } } }),
        el("button", { cls: "icon-btn", text: "▼", attrs: { type: "button", "aria-label": "Bajar " + label, "data-fk": "down:" + fk }, props: { disabled: idx === count - 1 }, on: { click: function () { onMove(1); } } })
      ]);
    }

    function swap(list, i, j) { var t = list[i]; list[i] = list[j]; list[j] = t; }

    /* ---------------- price + availability controls (shared by editor and price list) ---------------- */
    function priceInput(v, labelText, opts) {
      opts = opts || {};
      var raw = state.priceRaw[v.id];
      var input = el("input", { attrs: { type: "text", inputmode: "decimal", autocomplete: "off", placeholder: opts.ph || "A cotizar" } });
      if (labelText) input.setAttribute("aria-label", labelText);
      input.value = raw !== undefined ? raw : (v.price == null ? "" : String(v.price));
      var msg = errOf("variants", v.id, "price");
      if (msg) input.setAttribute("aria-invalid", "true");
      input.addEventListener("input", function () {
        var r = parseMoney(input.value);
        if (r.ok) { v.price = r.value; delete state.priceRaw[v.id]; input.removeAttribute("aria-invalid"); delete state.catErrors[errKey("variants", v.id, "price")]; }
        else state.priceRaw[v.id] = input.value;
        if (opts.errEl && r.ok) { opts.errEl.hidden = true; opts.errEl.textContent = ""; }
        dirty();
      });
      input.addEventListener("blur", function () {
        if (state.priceRaw[v.id] !== undefined) {
          input.setAttribute("aria-invalid", "true");
          if (opts.errEl) { opts.errEl.textContent = "Escribe un precio válido, por ejemplo 1250 o 1250.50."; opts.errEl.hidden = false; }
        } else if (typeof v.price === "number") {
          input.value = String(v.price);
        }
      });
      return input;
    }

    function availSelect(v, branch, labelText) {
      var sel = el("select", { attrs: { "aria-label": labelText } });
      sel.appendChild(el("option", { text: "—", props: { value: "" } }));
      AV_STATES.forEach(function (st) { sel.appendChild(el("option", { text: AV_LABELS[st] || st, props: { value: st } })); });
      sel.value = v.availability && v.availability[branch.id] ? v.availability[branch.id] : "";
      sel.addEventListener("change", function () {
        if (!v.availability || typeof v.availability !== "object") v.availability = {};
        if (sel.value) v.availability[branch.id] = sel.value; else delete v.availability[branch.id];
        dirty();
      });
      return sel;
    }

    function newVariant(p, name) {
      return { id: genId(p.id, D().variants), order: (D().variants.length + 1) * 10, visible: true, productId: p.id, name: name || "", sku: "", price: null, unit: "", availability: {}, image: "" };
    }

    /* ============================================================
     * Level 1 — Líneas
     * ============================================================ */
    function filterRow() {
      var cur = state.cat.group;
      var row = el("div", { cls: "chip-row", attrs: { role: "group", "aria-label": "Filtrar líneas por grupo" } });
      [["all", "Todas"], ["maquinaria", "Maquinaria"], ["insumos", "Insumos"]].forEach(function (o) {
        row.appendChild(el("button", { cls: "chip", text: o[1], attrs: { type: "button", "aria-pressed": cur === o[0] ? "true" : "false" },
          on: { click: function () { state.cat.group = o[0]; ctx.rerender(); } } }));
      });
      return row;
    }

    function renderLines() {
      var wrap = el("div");
      var cats = D().categories;
      var counts = {};
      D().products.forEach(function (p) { counts[p.categoryId] = (counts[p.categoryId] || 0) + 1; });
      var g = state.cat.group;
      wrap.appendChild(el("p", { cls: "note", text: "Líneas. Abre una para ver y editar sus productos." }));
      wrap.appendChild(filterRow());
      wrap.appendChild(ctx.renderList(S.DEFS.categories, cats, {
        filter: g === "all" ? null : function (c) { return c.group === g; },
        extraDefaults: g === "all" ? {} : { group: g },
        addLabel: "+ Agregar línea",
        emptyText: g !== "all" && cats.length ? "No hay líneas en este grupo. Usa \"+ Agregar línea\"." : null,
        itemBadges: function (it) { return [groupLabel(it.group), plural(counts[it.id] || 0, "producto", "productos")]; },
        extraActions: function (it) {
          return [el("button", { cls: "btn btn-primary btn-small", text: "Abrir productos →", attrs: { type: "button", "aria-label": "Abrir productos de " + (it.name || "la línea") },
            on: { click: function () { ctx.go({ catId: it.id }); } } })];
        },
        onDelete: removeCategory
      }));
      var ids = catIds();
      var orphans = D().products.filter(function (p) { return ids.indexOf(p.categoryId) === -1; });
      if (orphans.length) {
        wrap.appendChild(el("div", { cls: "item-card" }, [
          el("div", { cls: "item-text" }, [
            el("div", { cls: "item-title", text: "Sin línea" }),
            el("div", { cls: "item-sub", text: plural(orphans.length, "producto sin una línea válida", "productos sin una línea válida") + ". Ábrelos para asignarles una." })
          ]),
          el("div", { cls: "item-actions" }, el("button", { cls: "btn btn-secondary btn-small", text: "Abrir productos →", attrs: { type: "button" },
            on: { click: function () { ctx.go({ catId: "__none" }); } } }))
        ]));
      }
      return wrap;
    }

    function removeCategory(item) {
      var prods = D().products.filter(function (p) { return p.categoryId === item.id; });
      var msg = prods.length
        ? "Esta línea tiene " + plural(prods.length, "producto", "productos") + ". ¿Eliminar la línea, sus productos y presentaciones?"
        : "¿Eliminar «" + (item.name || "Sin nombre") + "»? Desaparecerá del sitio cuando guardes los cambios.";
      ui.confirm(msg, { title: "Eliminar línea", confirmLabel: "Eliminar", danger: true }).then(function (ok) {
        if (!ok) return;
        var gone = prods.map(function (p) { return p.id; });
        D().categories.splice(D().categories.indexOf(item), 1);
        purgeProducts(gone);
        dirty();
        ctx.rerender();
      });
    }

    /* Removes products by id from the draft together with their variants and any link to them. */
    function purgeProducts(ids) {
      if (!ids.length) return;
      D().products = D().products.filter(function (p) { return ids.indexOf(p.id) === -1; });
      D().variants = D().variants.filter(function (v) { return ids.indexOf(v.productId) === -1; });
      D().products.forEach(function (p) {
        p.relatedProducts = (p.relatedProducts || []).filter(function (x) { return ids.indexOf(x) === -1; });
      });
    }

    /* ============================================================
     * Level 2 — Productos de una línea
     * ============================================================ */
    function renderProducts() {
      var v = state.cat;
      var isNone = v.catId === "__none";
      var cat = isNone ? null : byId(D().categories, v.catId);
      if (!isNone && !cat) { v.catId = null; return renderLines(); }
      var wrap = el("div");
      var ids = catIds();
      var title = isNone ? "Sin línea" : (cat.name || "Sin nombre");
      wrap.appendChild(el("div", { cls: "crumbs" }, [
        el("button", { cls: "btn btn-secondary btn-small", text: "← Líneas", attrs: { type: "button" }, on: { click: function () { ctx.go({ catId: null }); } } }),
        el("h3", { text: "Productos de " + title })
      ]));
      var list = D().products;
      var items = list.filter(function (p) { return isNone ? ids.indexOf(p.categoryId) === -1 : p.categoryId === v.catId; });
      var atMax = list.length >= MAX_ROWS.products;
      if (!isNone) {
        var tool = el("div", { cls: "list-toolbar" });
        tool.appendChild(el("button", { cls: "btn btn-primary", text: "+ Agregar producto", attrs: { type: "button" }, props: { disabled: atMax },
          on: { click: function () { addProduct(cat); } } }));
        if (atMax) tool.appendChild(el("p", { cls: "note", text: "Llegaste al máximo de " + MAX_ROWS.products + " productos." }));
        wrap.appendChild(tool);
      }
      if (!items.length) {
        wrap.appendChild(el("div", { cls: "empty", text: isNone ? "No hay productos sin línea." : "Esta línea todavía no tiene productos. Usa \"+ Agregar producto\"." }));
        return wrap;
      }
      var ul = el("ul", { cls: "card-list" });
      items.forEach(function (p, i) { ul.appendChild(productCard(p, items, i)); });
      wrap.appendChild(ul);
      return wrap;
    }

    function addProduct(cat) {
      var p = {
        id: genId("prod", D().products), order: (D().products.length + 1) * 10, visible: true, categoryId: cat.id,
        brand: "", name: "", slug: "", summary: "", description: "", photos: [], specs: [], usage: "",
        relatedRecipes: [], relatedProducts: [], featured: false
      };
      D().products.push(p);
      dirty();
      ctx.go({ productId: p.id, focusName: true });
    }

    function productCard(p, items, idx) {
      var vars = variantsOf(p.id);
      var li = el("li", { cls: "item-card prod-card" + (p.visible ? "" : " is-hidden") });
      var main = el("div", { cls: "item-main" });
      main.appendChild(thumbFor(ctx.resolveImg(p.photos[0])));
      var text = el("div", { cls: "item-text" });
      text.appendChild(el("div", { cls: "item-title", text: p.name || "Producto sin nombre" }));
      if (p.brand) text.appendChild(el("div", { cls: "item-sub", text: p.brand }));
      var badges = el("div", { cls: "badges" });
      badges.appendChild(el("span", { cls: "badge", text: plural(vars.length, "presentación", "presentaciones") }));
      badges.appendChild(el("span", { cls: "badge badge-price", text: priceLabel(vars) }));
      if (p.featured) badges.appendChild(el("span", { cls: "badge badge-star", text: "★ Destacado" }));
      if (isExample(p.name)) badges.appendChild(el("span", { cls: "badge badge-gold", text: "Ejemplo" }));
      if (!p.visible) badges.appendChild(el("span", { cls: "badge", text: "Oculto" }));
      if (state.errorRows["products:" + p.id]) badges.appendChild(el("span", { cls: "badge badge-warn", text: "Revisar" }));
      text.appendChild(badges);
      main.appendChild(text);
      li.appendChild(main);

      var name = p.name || "producto";
      var actions = el("div", { cls: "item-actions" });
      actions.appendChild(reorderBtns(name, idx, items.length, p.id, function (dir) {
        var a = items[idx];
        var b = items[idx + dir];
        if (!a || !b) return;
        swap(D().products, D().products.indexOf(a), D().products.indexOf(b));
        dirty();
        ctx.rerender(dir < 0 ? "up:" + p.id : "down:" + p.id);
      }));
      actions.appendChild(el("button", { cls: "switch", attrs: { type: "button", role: "switch", "aria-checked": p.visible ? "true" : "false", "aria-label": "Visible: " + name, "data-fk": "vis:" + p.id },
        on: { click: function () { p.visible = !p.visible; dirty(); ctx.rerender("vis:" + p.id); } } },
        [el("span", { cls: "track", attrs: { "aria-hidden": "true" } }), el("span", { text: "Visible" })]));
      actions.appendChild(el("button", { cls: "btn btn-primary btn-small", text: "Editar", attrs: { type: "button", "aria-label": "Editar " + name },
        on: { click: function () { ctx.go({ productId: p.id }); } } }));
      actions.appendChild(el("button", { cls: "btn btn-secondary btn-small", text: "Duplicar", attrs: { type: "button", "aria-label": "Duplicar " + name },
        on: { click: function () { duplicateProduct(p); } } }));
      actions.appendChild(el("button", { cls: "btn btn-secondary btn-small", text: "Mover a otra línea", attrs: { type: "button", "aria-label": "Mover " + name + " a otra línea" },
        on: { click: function () { moveProduct(p); } } }));
      actions.appendChild(el("button", { cls: "btn btn-danger btn-small", text: "Eliminar", attrs: { type: "button", "aria-label": "Eliminar " + name },
        on: { click: function () { removeProduct(p); } } }));
      li.appendChild(actions);
      return li;
    }

    function duplicateProduct(p) {
      if (D().products.length >= MAX_ROWS.products) return;
      var copy = ui.clone(p);
      copy.id = genId("prod", D().products);
      copy.name = (p.name || "Producto") + " (copia)";
      copy.slug = "";
      D().products.splice(D().products.indexOf(p) + 1, 0, copy);
      variantsOf(p.id).forEach(function (v) {
        var c = ui.clone(v);
        c.productId = copy.id;
        c.id = genId(copy.id, D().variants);
        D().variants.push(c);
      });
      dirty();
      ctx.rerender("up:" + copy.id);
    }

    function moveProduct(p) {
      var others = D().categories.filter(function (c) { return c.id !== p.categoryId; });
      if (!others.length) {
        ui.confirm("Primero crea otra línea para poder mover este producto.", { title: "Mover a otra línea", confirmLabel: "Entendido", cancelLabel: "Cerrar" });
        return;
      }
      var id = ui.uid("mv");
      var sel = el("select", { attrs: { id: id } });
      others.forEach(function (c) { sel.appendChild(el("option", { text: c.name || c.id, props: { value: c.id } })); });
      var body = el("div", { cls: "field" }, [el("label", { attrs: { for: id }, text: "Nueva línea de «" + (p.name || "producto") + "»" }), sel]);
      ui.modal({
        title: "Mover a otra línea", body: body,
        actions: [
          { label: "Cancelar", kind: "secondary" },
          { label: "Mover", kind: "primary", onClick: function () { p.categoryId = sel.value; dirty(); ctx.rerender(); } }
        ]
      });
    }

    function removeProduct(p, thenBack) {
      var n = variantsOf(p.id).length;
      var msg = "¿Eliminar \"" + (p.name || "Producto sin nombre") + "\" y sus " + plural(n, "presentación", "presentaciones") + "? Esta acción no se puede deshacer.";
      if (n === 1) msg = "¿Eliminar \"" + (p.name || "Producto sin nombre") + "\" y su 1 presentación? Esta acción no se puede deshacer.";
      ui.confirm(msg, { title: "Eliminar producto", confirmLabel: "Eliminar", danger: true }).then(function (ok) {
        if (!ok) return;
        purgeProducts([p.id]);
        dirty();
        if (thenBack) ctx.go({ productId: null }); else ctx.rerender();
      });
    }

    /* ============================================================
     * Level 3 — Editor de producto
     * ============================================================ */
    function siteLink(p) {
      var saved = byId(state.content.products, p.id);
      if (!saved) return null;
      var path = "catalogo?p=" + encodeURIComponent(saved.slug || saved.id) + "&nocache=1" + (DEMO ? "&demo=1" : "");
      var root = new URL("../", document.baseURI).href;
      var loc = { pathname: location.pathname.replace(/\/admin(\/index\.html|\/)?$/, function (m, g) { return g === "/" ? "/" : g ? "/index.html" : ""; }) };
      if (typeof SC.rootLink === "function") return SC.rootLink(path, loc, root);
      return new URL(path, root).href;
    }

    function group(title, id, kids, o) {
      o = o || {};
      var sec = el("section", { cls: "ed-group", attrs: { "aria-labelledby": id } });
      sec.appendChild(el("h3", { text: title, attrs: { id: id } }));
      if (o.help) sec.appendChild(el("p", { cls: "hint", text: o.help }));
      kids.forEach(function (k) { if (k) sec.appendChild(k); });
      return sec;
    }

    function renderEditor(p) {
      var wrap = el("div", { cls: "editor" });
      var cat = byId(D().categories, p.categoryId);
      var isNewInSession = !byId(state.content.products, p.id);
      var slugTouched = p.slug !== "" && p.slug !== slugify(p.name);
      var heading = el("h3", { cls: "ed-title", text: p.name || "Producto nuevo" });

      // --- header
      var backLabel = cat ? "← Productos de " + (cat.name || "la línea") : "← Líneas";
      var head = el("div", { cls: "ed-head" });
      head.appendChild(el("button", { cls: "btn btn-secondary btn-small", text: backLabel, attrs: { type: "button" }, on: { click: leaveEditor } }));
      var link = siteLink(p);
      var headActions = el("div", { cls: "ed-head-actions" });
      headActions.appendChild(toggle("Visible", function () { return p.visible; }, function (v) { p.visible = v; }));
      if (link) {
        headActions.appendChild(el("a", { cls: "btn btn-secondary btn-small", text: "Ver en el sitio ↗", attrs: { href: link, target: "_blank", rel: "noopener" } }));
      } else {
        headActions.appendChild(el("span", { cls: "btn btn-secondary btn-small is-disabled", text: "Ver en el sitio ↗", attrs: { "aria-disabled": "true", title: "Guarda el producto para verlo en el sitio." } }));
      }
      head.appendChild(headActions);
      wrap.appendChild(head);
      wrap.appendChild(heading);
      if (!link) wrap.appendChild(el("p", { cls: "note", text: "Guarda los cambios para poder verlo en el sitio." }));

      // --- Datos
      var catField = (function () {
        var id = ui.uid("c");
        var sel = el("select", { attrs: { id: id, "aria-required": "true", "aria-describedby": id + "-err" } });
        sel.appendChild(el("option", { text: "Elige una línea…", props: { value: "" } }));
        D().categories.forEach(function (c) { sel.appendChild(el("option", { text: (c.name || c.id) + " · " + groupLabel(c.group), props: { value: c.id } })); });
        sel.value = p.categoryId || "";
        if (sel.value !== (p.categoryId || "")) sel.value = "";
        var msg = errOf("products", p.id, "categoryId");
        var errEl = el("p", { cls: "field-error", attrs: { id: id + "-err" }, props: { hidden: !msg } }, msg);
        if (msg) sel.setAttribute("aria-invalid", "true");
        sel.addEventListener("change", function () {
          p.categoryId = sel.value; errEl.hidden = true; sel.removeAttribute("aria-invalid"); dirty();
        });
        return el("div", { cls: "field" }, [el("label", { attrs: { for: id } }, ["Línea", el("span", { cls: "req", text: "*", attrs: { "aria-hidden": "true" } })]), sel, errEl]);
      })();

      var slugField;
      var nameField = textField({
        obj: p, key: "name", label: "Nombre", required: true, errKind: "products", ph: "Nombre del producto",
        onInput: function (val) {
          heading.textContent = val.trim() || "Producto nuevo";
          if (isNewInSession && !slugTouched) {
            var base = slugify(val);
            var next = base ? uniqueFrom(base, function (s) { return D().products.some(function (o) { return o !== p && (o.slug || "") === s; }); }) : "";
            p.slug = next;
            slugField.input.value = next;
          }
        }
      });
      slugField = textField({
        obj: p, key: "slug", label: "Slug", errKind: "products", ph: "se-llena-con-el-nombre", spellcheck: false, max: 60,
        hint: "Es la parte final del enlace del producto. Solo minúsculas, números y guiones.",
        onInput: function (val) { slugTouched = val !== ""; },
        onBlur: function (inp) {
          if (inp.value && !SLUG_RE.test(inp.value)) { inp.value = slugify(inp.value); p.slug = inp.value; dirty(); }
        }
      });
      wrap.appendChild(group("Datos", "ed-datos", [
        catField,
        nameField.wrap,
        textField({ obj: p, key: "brand", label: "Marca", errKind: "products", ph: "Marca (opcional)" }).wrap,
        slugField.wrap,
        textField({ obj: p, key: "summary", label: "Resumen", errKind: "products", max: 160, counter: true, hint: "Una línea con el beneficio principal. Se ve en las tarjetas." }).wrap,
        textField({ obj: p, key: "description", label: "Descripción", errKind: "products", long: true, rows: 5 }).wrap,
        el("div", { cls: "field" }, toggle("Destacado en la portada", function () { return p.featured; }, function (v) { p.featured = v; }))
      ]));

      wrap.appendChild(group("Fotos", "ed-fotos", [photosField(p)], { help: "Primera = principal." }));
      wrap.appendChild(group("Especificaciones", "ed-specs", [specsField(p)]));
      wrap.appendChild(group("Guía de uso / sugerencia", "ed-uso", [
        textField({ obj: p, key: "usage", label: "Guía de uso / sugerencia", errKind: "products", long: true, rows: 6,
          hint: "Para quién es, dosis o gramos por bebida, con qué se combina. Una idea por línea; empieza con \"- \" para viñetas." }).wrap
      ]));
      wrap.appendChild(variantsGroup(p));
      wrap.appendChild(group("Relacionados", "ed-rel", [recipesField(p), relatedProductsField(p)]));

      var foot = el("div", { cls: "ed-foot" }, [
        el("button", { cls: "btn btn-secondary", text: "Duplicar", attrs: { type: "button" }, on: { click: function () { duplicateProduct(p); ctx.go({ productId: null }); } } }),
        el("button", { cls: "btn btn-danger", text: "Eliminar", attrs: { type: "button" }, on: { click: function () { removeProduct(p, true); } } })
      ]);
      wrap.appendChild(foot);

      if (state.cat.focusName) {
        state.cat.focusName = false;
        setTimeout(function () { nameField.input.focus(); }, 0);
      }
      return wrap;
    }

    function leaveEditor() {
      var p = byId(D().products, state.cat.productId);
      // A brand-new, untouched product is discarded instead of leaving an empty card behind.
      if (p && !byId(state.content.products, p.id) && !p.name.trim() && !p.photos.length && !p.specs.length && !variantsOf(p.id).length) {
        D().products.splice(D().products.indexOf(p), 1);
      }
      ctx.go({ productId: null });
    }

    /* ---------- fotos ---------- */
    function photosField(p) {
      var spec = S.IMAGE_SPECS["products.photos"];
      var box = el("div", { cls: "photos" });
      var list = el("ul", { cls: "photo-list" });
      var status = el("p", { cls: "image-status", attrs: { role: "status", "aria-live": "polite" } });
      var fileInput = el("input", { attrs: { type: "file", accept: "image/*", multiple: true, "aria-label": "Fotos del producto: elegir archivos", tabindex: "-1" }, props: { hidden: true } });
      var addBtn = el("button", { cls: "btn btn-secondary btn-small", text: "+ Agregar foto", attrs: { type: "button", "data-fk": "add-photo" } });
      var pending = [];
      var queue = Promise.resolve();
      var errMsg = errOf("products", p.id, "photos");
      var errEl = el("p", { cls: "field-error", props: { hidden: !errMsg } }, errMsg);

      function setStatus(kind, text) { status.className = "image-status" + (kind ? " " + kind : ""); status.textContent = text || ""; }

      function rebuild(fk) {
        ui.clear(list);
        p.photos.forEach(function (ref, i) {
          var label = "foto " + (i + 1);
          var li = el("li", { cls: "photo-item" });
          var img = el("img", { attrs: { alt: "Foto " + (i + 1) + " de " + p.photos.length, width: "96", height: "96", loading: "lazy" } });
          var stage = 0;
          img.addEventListener("error", function () {
            stage += 1;
            if (stage === 1) img.src = ctx.placeholderSrc(spec.placeholder);
          });
          img.src = ctx.resolveImg(ref) || ctx.placeholderSrc(spec.placeholder);
          li.appendChild(el("div", { cls: "photo-frame" }, img));
          var meta = el("div", { cls: "photo-meta" });
          if (i === 0) meta.appendChild(el("span", { cls: "badge badge-gold", text: "Principal" }));
          meta.appendChild(reorderBtns(label, i, p.photos.length, "ph" + i, function (dir) {
            swap(p.photos, i, i + dir);
            dirty();
            rebuild((dir < 0 ? "up:" : "down:") + "ph" + (i + dir));
          }));
          meta.appendChild(el("button", { cls: "btn btn-danger btn-small", text: "Quitar", attrs: { type: "button", "aria-label": "Quitar " + label },
            on: { click: function () { p.photos.splice(i, 1); dirty(); setStatus("", ""); rebuild("add-photo"); } } }));
          li.appendChild(meta);
          list.appendChild(li);
        });
        pending.forEach(function (name) {
          list.appendChild(el("li", { cls: "photo-item photo-pending" }, [el("div", { cls: "photo-frame" }, el("span", { text: "Subiendo…" })), el("div", { cls: "photo-meta" }, el("span", { cls: "note", text: name }))]));
        });
        var full = p.photos.length + pending.length >= MAX_PHOTOS;
        addBtn.disabled = full;
        hintMax.hidden = !full;
        focusIn(box, fk);
      }

      function uploadOne(file) {
        if (p.photos.length >= MAX_PHOTOS) { setStatus("err", "Máximo 6 fotos."); return Promise.resolve(); }
        pending.push(file.name);
        rebuild();
        ctx.busy(1);
        setStatus("", "Procesando imagen…");
        var res;
        return IMG.process(file, spec).then(function (r) {
          res = r;
          setStatus("", "Subiendo…");
          return IMG.toDataUrl(r.blob);
        }).then(function (enc) {
          if (!api.hasBackend() || DEMO) return { url: enc.dataUrl };
          return api.uploadImage({ section: "products", itemId: p.id, field: "photos", index: p.photos.length + 1, name: res.baseName + "." + res.ext, mime: res.mime, dataBase64: enc.base64 });
        }).then(function (data) {
          if (p.photos.length < MAX_PHOTOS) p.photos.push(data.url);
          var info = "Foto agregada · " + res.width + " × " + res.height + " · " + ui.formatKb(res.bytes) + (DEMO ? " (guardada en este navegador)" : "");
          if (res.aspectWarning) setStatus("warn", info + ". La imagen se verá recortada en el sitio.");
          else setStatus("ok", info);
          errEl.hidden = true;
          dirty();
        }, function (e) {
          setStatus("err", (e && e.message) || "No pudimos subir la foto.");
        }).then(function () {
          pending.splice(pending.indexOf(file.name), 1);
          ctx.busy(-1);
          rebuild();
        });
      }

      addBtn.addEventListener("click", function () { fileInput.click(); });
      fileInput.addEventListener("change", function () {
        var files = Array.prototype.slice.call(fileInput.files || []);
        fileInput.value = "";
        var room = MAX_PHOTOS - p.photos.length - pending.length;
        if (files.length > room) setStatus("err", "Máximo 6 fotos.");
        files.slice(0, Math.max(room, 0)).forEach(function (f) { queue = queue.then(function () { return uploadOne(f); }); });
      });

      var hintMax = el("p", { cls: "note", text: "Máximo 6 fotos." });
      box.appendChild(list);
      box.appendChild(el("div", { cls: "image-actions" }, [addBtn]));
      box.appendChild(fileInput);
      box.appendChild(hintMax);
      box.appendChild(status);
      box.appendChild(errEl);
      box.appendChild(el("p", { cls: "hint", text: spec.help }));
      rebuild();
      return box;
    }

    /* ---------- especificaciones ---------- */
    function specsField(p) {
      var rows = p.specs.map(parseSpec);
      var box = el("div", { cls: "specs-editor" });
      var list = el("div", { cls: "spec-rows" });
      var addBtn = el("button", { cls: "btn btn-secondary btn-small", text: "+ Agregar especificación", attrs: { type: "button", "data-fk": "add-spec" } });
      var errMsg = errOf("products", p.id, "specs");
      var errEl = el("p", { cls: "field-error", props: { hidden: !errMsg } }, errMsg);

      function sync() {
        p.specs = rows.map(function (r) { return composeSpec(r.label, r.value); }).filter(Boolean);
        if (!errEl.hidden) errEl.hidden = true;
        dirty();
      }

      function rebuild(fk) {
        ui.clear(list);
        rows.forEach(function (r, i) {
          var n = i + 1;
          var lab = el("input", { attrs: { type: "text", autocomplete: "off", placeholder: "Voltaje", "aria-label": "Etiqueta " + n, "data-fk": "label:" + i } });
          lab.value = r.label;
          lab.addEventListener("input", function () { r.label = lab.value; sync(); });
          var val = el("input", { attrs: { type: "text", autocomplete: "off", placeholder: "220 V", "aria-label": "Valor " + n } });
          val.value = r.value;
          val.addEventListener("input", function () { r.value = val.value; sync(); });
          list.appendChild(el("div", { cls: "spec-row" }, [
            el("div", { cls: "spec-inputs" }, [lab, val]),
            el("div", { cls: "row-actions" }, [
              reorderBtns("especificación " + n, i, rows.length, "sp" + i, function (dir) { swap(rows, i, i + dir); sync(); rebuild((dir < 0 ? "up:" : "down:") + "sp" + (i + dir)); }),
              el("button", { cls: "btn btn-secondary btn-small", text: "Quitar", attrs: { type: "button", "aria-label": "Quitar especificación " + n },
                on: { click: function () { rows.splice(i, 1); sync(); rebuild("add-spec"); } } })
            ])
          ]));
        });
        addBtn.disabled = rows.length >= MAX_SPECS;
        focusIn(box, fk);
      }

      addBtn.addEventListener("click", function () {
        rows.push({ label: "", value: "" });
        rebuild("label:" + (rows.length - 1));
      });
      var head = el("div", { cls: "spec-head", attrs: { "aria-hidden": "true" } }, [el("span", { text: "Etiqueta" }), el("span", { text: "Valor" })]);
      box.appendChild(head);
      box.appendChild(list);
      box.appendChild(el("div", { cls: "image-actions" }, [addBtn]));
      box.appendChild(el("p", { cls: "hint", text: "Ejemplo: Voltaje → 220 V. Escribe \"Por definir\" si aún no lo sabes." }));
      box.appendChild(errEl);
      rebuild();
      return box;
    }

    /* ---------- presentaciones ---------- */
    function variantsGroup(p) {
      var box = el("div", { cls: "variants" });
      var list = el("ul", { cls: "var-list" });
      var warn = el("p", { cls: "note warn", text: "Este producto no tiene presentaciones: se mostrará \"Precio a cotizar\"." });
      var addBtn = el("button", { cls: "btn btn-primary btn-small", text: "+ Agregar presentación", attrs: { type: "button", "data-fk": "add-var" } });
      var focusNew = null;

      function rebuild(fk) {
        ui.clear(list);
        var vs = variantsOf(p.id);
        warn.hidden = vs.length > 0;
        vs.forEach(function (v, i) { list.appendChild(variantRow(v, vs, i)); });
        addBtn.disabled = D().variants.length >= MAX_ROWS.variants;
        if (focusNew) { var n = list.querySelector('[data-fk="name:' + focusNew + '"]'); focusNew = null; if (n) n.focus(); }
        else focusIn(box, fk);
        ctx.refreshBar();
      }

      function variantRow(v, vs, i) {
        var n = i + 1;
        var li = el("li", { cls: "var-row" + (v.visible ? "" : " is-hidden") });
        li.appendChild(el("div", { cls: "var-head" }, [
          el("span", { cls: "var-num", text: "Presentación " + n }),
          el("button", { cls: "switch", attrs: { type: "button", role: "switch", "aria-checked": v.visible ? "true" : "false", "aria-label": "Visible: presentación " + n },
            on: { click: function () { v.visible = !v.visible; dirty(); rebuild(); } } },
            [el("span", { cls: "track", attrs: { "aria-hidden": "true" } }), el("span", { text: "Visible" })])
        ]));

        var nameF = textField({ obj: v, key: "name", label: "Nombre", required: true, errKind: "variants", ph: "1 kg, Vainilla 750 ml, 2 grupos", hint: "Cómo la verá el cliente: sabor, tamaño o modelo." });
        nameF.input.setAttribute("data-fk", "name:" + v.id);
        var skuF = textField({ obj: v, key: "sku", label: "SKU", errKind: "variants", max: 40, spellcheck: false, hint: "Código interno, opcional. Ayuda a ubicar la presentación en tu inventario." });
        // price
        var pid = ui.uid("c");
        var perr = errOf("variants", v.id, "price");
        var perrEl = el("p", { cls: "field-error", attrs: { id: pid + "-err" }, props: { hidden: !perr } }, perr);
        var pinput = priceInput(v, null, { errEl: perrEl });
        pinput.id = pid;
        pinput.setAttribute("aria-describedby", pid + "-hint " + pid + "-err");
        var priceF = el("div", { cls: "field" }, [
          el("label", { attrs: { for: pid }, text: "Precio" }),
          el("div", { cls: "input-prefix" }, [el("span", { text: "$", attrs: { "aria-hidden": "true" } }), pinput]),
          el("p", { cls: "hint", text: "Déjalo vacío para mostrar \"Precio a cotizar\".", attrs: { id: pid + "-hint" } }),
          perrEl
        ]);
        var unitF = textField({ obj: v, key: "unit", label: "Unidad", errKind: "variants", ph: "kg, pieza, botella", hint: "Cómo se vende: kg, pieza, botella, caja…" });
        li.appendChild(el("div", { cls: "var-grid" }, [nameF.wrap, skuF.wrap, priceF, unitF.wrap]));

        // availability per visible branch
        var fs = el("fieldset", { cls: "avail-fs" }, el("legend", { text: "Existencias por sucursal" }));
        var bs = branches();
        if (!bs.length) fs.appendChild(el("p", { cls: "note", text: "No hay sucursales visibles. Agrégalas en la sección Sucursales." }));
        var bgrid = el("div", { cls: "avail-grid" });
        bs.forEach(function (b) {
          var sid = ui.uid("c");
          var sel = availSelect(v, b, b.name + ": existencias de la presentación " + n);
          sel.id = sid;
          bgrid.appendChild(el("div", { cls: "field" }, [el("label", { attrs: { for: sid }, text: b.name || b.id }), sel]));
        });
        fs.appendChild(bgrid);
        li.appendChild(fs);

        // optional photo
        var det = el("details", { cls: "var-photo" });
        det.open = !!v.image;
        det.appendChild(el("summary", { text: "Foto (opcional)" }));
        var fd = { key: "image", label: "Foto de la presentación " + n };
        var holder = el("div", { cls: "field" });
        var ic = ctx.buildImageControl({ content: "variants" }, fd, v, ui.uid("f"), ctx.busy, function () { dirty(); });
        holder.appendChild(ic.node);
        det.appendChild(holder);
        li.appendChild(det);

        li.appendChild(el("div", { cls: "row-actions" }, [
          reorderBtns("presentación " + n, i, vs.length, v.id, function (dir) {
            var a = vs[i]; var b = vs[i + dir];
            swap(D().variants, D().variants.indexOf(a), D().variants.indexOf(b));
            dirty();
            rebuild((dir < 0 ? "up:" : "down:") + v.id);
          }),
          el("button", { cls: "btn btn-secondary btn-small", text: "Duplicar", attrs: { type: "button", "aria-label": "Duplicar presentación " + n },
            on: { click: function () {
              if (D().variants.length >= MAX_ROWS.variants) return;
              var c = ui.clone(v);
              c.id = genId(p.id, D().variants);
              c.name = (v.name || "Presentación") + " (copia)";
              c.sku = "";
              D().variants.splice(D().variants.indexOf(v) + 1, 0, c);
              dirty();
              focusNew = c.id;
              rebuild();
            } } }),
          el("button", { cls: "btn btn-danger btn-small", text: "Quitar", attrs: { type: "button", "aria-label": "Quitar presentación " + n },
            on: { click: function () {
              D().variants.splice(D().variants.indexOf(v), 1);
              delete state.priceRaw[v.id];
              dirty();
              rebuild("add-var");
            } } })
        ]));
        return li;
      }

      addBtn.addEventListener("click", function () {
        var v = newVariant(p, "");
        D().variants.push(v);
        dirty();
        focusNew = v.id;
        rebuild();
      });

      box.appendChild(warn);
      box.appendChild(list);
      box.appendChild(el("div", { cls: "image-actions" }, [addBtn]));
      rebuild();
      return group("Presentaciones", "ed-var", [box], { help: "Sabor, tamaño o modelo. Cada una tiene su precio, unidad y existencias por sucursal." });
    }

    /* ---------- relacionados ---------- */
    function recipesField(p) {
      var recipes = (state.content.recipes || []);
      var fs = el("fieldset", { cls: "rel-fs" }, el("legend", { text: "Recetas relacionadas" }));
      var known = recipes.map(function (r) { return r.id; });
      var extras = p.relatedRecipes.filter(function (id) { return known.indexOf(id) === -1; });
      if (!recipes.length && !extras.length) {
        fs.appendChild(el("p", { cls: "note", text: "Todavía no hay recetas. Agrégalas en la sección Recetas." }));
        return fs;
      }
      var grid = el("div", { cls: "check-grid" });
      function check(id, label) {
        var cid = ui.uid("c");
        var cb = el("input", { attrs: { type: "checkbox", id: cid } });
        cb.checked = p.relatedRecipes.indexOf(id) !== -1;
        cb.addEventListener("change", function () {
          var at = p.relatedRecipes.indexOf(id);
          if (cb.checked && at === -1) {
            if (p.relatedRecipes.length >= MAX_RELATED) { cb.checked = false; return; }
            p.relatedRecipes.push(id);
          } else if (!cb.checked && at !== -1) p.relatedRecipes.splice(at, 1);
          dirty();
        });
        grid.appendChild(el("label", { cls: "check", attrs: { for: cid } }, [cb, el("span", { text: label })]));
      }
      recipes.forEach(function (r) { check(r.id, (r.title || r.id) + (r.visible ? "" : " (oculta)")); });
      extras.forEach(function (id) { check(id, id + " (no existe)"); });
      fs.appendChild(grid);
      fs.appendChild(el("p", { cls: "hint", text: "Máximo " + MAX_RELATED + "." }));
      return fs;
    }

    function relatedProductsField(p) {
      var fs = el("fieldset", { cls: "rel-fs" }, el("legend", { text: "Productos relacionados" }));
      var sid = ui.uid("c");
      var input = el("input", { attrs: { type: "text", id: sid, autocomplete: "off", placeholder: "Buscar producto…", "aria-label": "Buscar producto…" } });
      var sugg = el("ul", { cls: "sugg", attrs: { "aria-label": "Resultados" } });
      var chips = el("ul", { cls: "chips" });
      var live = el("p", { cls: "sr-only", attrs: { role: "status", "aria-live": "polite" } });

      function chipsRebuild() {
        ui.clear(chips);
        p.relatedProducts.forEach(function (id) {
          var o = byId(D().products, id);
          var label = o ? ((o.brand ? o.brand + " · " : "") + (o.name || "Sin nombre")) : id + " (no existe)";
          chips.appendChild(el("li", { cls: "chip-item" }, [
            el("span", { text: label }),
            el("button", { cls: "chip-x", text: "×", attrs: { type: "button", "aria-label": "Quitar " + label },
              on: { click: function () { p.relatedProducts.splice(p.relatedProducts.indexOf(id), 1); dirty(); chipsRebuild(); suggest(); input.focus(); } } })
          ]));
        });
      }

      function suggest() {
        ui.clear(sugg);
        var q = fold(input.value.trim());
        if (!q) { live.textContent = ""; return; }
        var full = p.relatedProducts.length >= MAX_RELATED;
        var found = D().products.filter(function (o) {
          return o !== p && p.relatedProducts.indexOf(o.id) === -1 && fold((o.brand || "") + " " + (o.name || "") + " " + catName(o.categoryId)).indexOf(q) !== -1;
        }).slice(0, 8);
        if (full) { sugg.appendChild(el("li", { cls: "note", text: "Máximo " + MAX_RELATED + " productos relacionados." })); return; }
        if (!found.length) { sugg.appendChild(el("li", { cls: "note", text: "Sin resultados." })); live.textContent = "Sin resultados."; return; }
        live.textContent = plural(found.length, "resultado", "resultados") + ".";
        found.forEach(function (o) {
          sugg.appendChild(el("li", null, el("button", { cls: "sugg-btn", attrs: { type: "button" },
            on: { click: function () { p.relatedProducts.push(o.id); dirty(); input.value = ""; chipsRebuild(); suggest(); input.focus(); } } },
            [el("strong", { text: o.name || "Sin nombre" }), el("span", { cls: "note", text: (o.brand ? o.brand + " · " : "") + catName(o.categoryId) })])));
        });
      }

      input.addEventListener("input", suggest);
      fs.appendChild(input);
      fs.appendChild(live);
      fs.appendChild(sugg);
      fs.appendChild(chips);
      chipsRebuild();
      return fs;
    }

    /* ============================================================
     * Lista de precios (bulk table)
     * ============================================================ */
    function renderPrices() {
      var wrap = el("div", { cls: "prices" });
      wrap.appendChild(el("p", { cls: "note", text: "Edita precios, unidades y existencias de todas las presentaciones en un solo lugar. Los cambios se publican al pulsar «Guardar cambios». Deja el precio vacío para mostrar \"Precio a cotizar\"." }));
      var bs = branches();
      var cats = D().categories.slice();
      var ids = catIds();
      var orphans = D().products.filter(function (p) { return ids.indexOf(p.categoryId) === -1; });
      var groups = cats.map(function (c) { return { name: c.name || "Sin nombre", sub: groupLabel(c.group), products: D().products.filter(function (p) { return p.categoryId === c.id; }) }; });
      if (orphans.length) groups.push({ name: "Sin línea", sub: "", products: orphans });
      var any = false;
      groups.forEach(function (g, gi) {
        if (!g.products.length) return;
        any = true;
        var det = el("details", { cls: "group pl-group" });
        det.open = true;
        det.appendChild(el("summary", null, [g.name, el("span", { cls: "pl-sub", text: g.sub ? g.sub + " · " + plural(g.products.length, "producto", "productos") : plural(g.products.length, "producto", "productos") })]));
        det.appendChild(priceTable(g.products, bs));
        wrap.appendChild(det);
      });
      if (!any) wrap.appendChild(el("div", { cls: "empty", text: "Todavía no hay productos. Agrégalos desde la pestaña Líneas." }));
      return wrap;
    }

    function priceTable(products, bs) {
      var table = el("table", { cls: "pl-table" });
      var cap = el("caption", { cls: "sr-only", text: "Presentaciones, precios y existencias" });
      table.appendChild(cap);
      var thead = el("thead");
      var hr = el("tr");
      ["Producto", "Presentación", "SKU", "Precio", "Unidad"].forEach(function (h) { hr.appendChild(el("th", { text: h, attrs: { scope: "col" } })); });
      bs.forEach(function (b) { hr.appendChild(el("th", { text: branchAbbr(b), attrs: { scope: "col", title: b.name || b.id } })); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      products.forEach(function (p) {
        var vs = variantsOf(p.id);
        var pname = p.name || "Producto sin nombre";
        if (!vs.length) {
          var tr0 = el("tr", { cls: "pl-row pl-empty" });
          tr0.appendChild(el("th", { cls: "pl-prod", attrs: { scope: "row" }, text: pname }));
          var span = 4 + bs.length;
          tr0.appendChild(el("td", { attrs: { colspan: String(span) } }, [
            el("span", { cls: "note", text: "Sin presentaciones. " }),
            el("button", { cls: "btn btn-secondary btn-small", text: "+ Agregar presentación", attrs: { type: "button", "aria-label": "Agregar presentación a " + pname },
              on: { click: function () { var v = newVariant(p, ""); D().variants.push(v); dirty(); ctx.rerender(); } } })
          ]));
          tbody.appendChild(tr0);
          return;
        }
        vs.forEach(function (v, i) {
          var tr = el("tr", { cls: "pl-row" + (v.visible ? "" : " is-hidden") });
          var vlabel = v.name || "presentación " + (i + 1);
          var th = el("th", { cls: "pl-prod" + (i ? " rep" : ""), attrs: { scope: "row" }, text: pname });
          tr.appendChild(th);

          function cell(label, kids) { var td = el("td", { attrs: { "data-label": label } }, kids); tr.appendChild(td); return td; }
          function textCell(label, key, col, o) {
            var inp = el("input", { attrs: { type: "text", autocomplete: "off", "aria-label": label + " de " + pname + " (" + vlabel + ")", "data-col": String(col) } });
            if (o && o.ph) inp.setAttribute("placeholder", o.ph);
            if (o && o.max) inp.setAttribute("maxlength", String(o.max));
            inp.value = v[key] || "";
            if (errOf("variants", v.id, key)) inp.setAttribute("aria-invalid", "true");
            inp.addEventListener("input", function () { v[key] = inp.value; inp.removeAttribute("aria-invalid"); delete state.catErrors[errKey("variants", v.id, key)]; dirty(); });
            cell(label, inp);
          }
          textCell("Presentación", "name", 0, { ph: "1 kg" });
          textCell("SKU", "sku", 1, { max: 40 });
          var pin = priceInput(v, "Precio de " + pname + " (" + vlabel + ")", { ph: "A cotizar" });
          pin.setAttribute("data-col", "2");
          cell("Precio", el("div", { cls: "input-prefix" }, [el("span", { text: "$", attrs: { "aria-hidden": "true" } }), pin]));
          textCell("Unidad", "unit", 3, { ph: "kg" });
          bs.forEach(function (b) {
            cell(b.name || b.id, availSelect(v, b, (b.name || b.id) + ": existencias de " + pname + " (" + vlabel + ")"));
          });
          tbody.appendChild(tr);
        });
      });
      table.appendChild(tbody);
      // Enter moves down the same column (Tab keeps its native order).
      table.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
        var col = e.target.getAttribute("data-col");
        if (col == null) return;
        var all = Array.prototype.slice.call(table.querySelectorAll('input[data-col="' + col + '"]'));
        var next = all[all.indexOf(e.target) + 1];
        e.preventDefault();
        if (next) { next.focus(); if (next.select) next.select(); }
      });
      return el("div", { cls: "pl-wrap" }, table);
    }

    /* ============================================================
     * Tabs + top-level render
     * ============================================================ */
    function renderTabs() {
      var tabs = [["lines", "Líneas"], ["prices", "Lista de precios"]];
      var bar = el("div", { cls: "cat-tabs", attrs: { role: "tablist", "aria-label": "Vistas del catálogo" } });
      var btns = [];
      tabs.forEach(function (t, i) {
        var sel = state.cat.tab === t[0];
        var b = el("button", { cls: "cat-tab", text: t[1], attrs: { type: "button", role: "tab", "aria-selected": sel ? "true" : "false", tabindex: sel ? "0" : "-1", "data-fk": "tab:" + t[0] },
          on: { click: function () { ctx.go({ tab: t[0], catId: null }, { replace: true }); } } });
        b.addEventListener("keydown", function (e) {
          var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var to = tabs[(i + d + tabs.length) % tabs.length][0];
          ctx.go({ tab: to, catId: null }, { replace: true, focus: "tab:" + to });
        });
        btns.push(b);
        bar.appendChild(b);
      });
      return bar;
    }

    function render() {
      var v = state.cat;
      var wrap = el("div", { cls: "catalog" });
      if (state.catImported) {
        wrap.appendChild(el("div", { cls: "banner", attrs: { role: "status" },
          text: "Importamos tu catálogo anterior (maquinaria e insumos) para que lo edites aquí. Revisa las líneas y pulsa «Guardar cambios» para publicarlo en el nuevo catálogo." }));
      }
      var product = v.productId ? byId(D().products, v.productId) : null;
      if (v.productId && !product) v.productId = null;
      if (product) { wrap.appendChild(renderEditor(product)); return wrap; }
      if (!v.catId) wrap.appendChild(renderTabs());
      if (v.tab === "prices") wrap.appendChild(renderPrices());
      else if (v.catId) wrap.appendChild(renderProducts());
      else wrap.appendChild(renderLines());
      return wrap;
    }

    /* ============================================================
     * Validation (mirrors Shared.validateSection for the new types)
     * ============================================================ */
    function tidy() {
      var d = D();
      d.categories.forEach(function (c) { ["name", "tagline", "description", "image"].forEach(function (k) { c[k] = String(c[k] || "").trim(); }); });
      d.products.forEach(function (p) {
        ["brand", "name", "slug", "summary"].forEach(function (k) { p[k] = String(p[k] || "").trim(); });
        p.description = String(p.description || "").replace(/\s+$/, "");
        p.usage = String(p.usage || "").replace(/\s+$/, "");
        p.photos = p.photos.map(function (x) { return String(x).trim(); }).filter(Boolean);
        p.specs = p.specs.map(function (x) { return String(x).trim(); }).filter(Boolean);
        p.relatedRecipes = p.relatedRecipes.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        p.relatedProducts = p.relatedProducts.filter(function (x, i, a) { return x && a.indexOf(x) === i && x !== p.id; });
      });
      d.variants.forEach(function (v) {
        ["name", "sku", "unit", "image"].forEach(function (k) { v[k] = String(v[k] || "").trim(); });
        Object.keys(v.availability || {}).forEach(function (k) { if (!v.availability[k]) delete v.availability[k]; });
      });
    }

    /* Returns [{ key, id, label, field, fieldLabel, message }] and fills state.catErrors / errorRows. */
    function validate() {
      tidy();
      state.catErrors = {};
      var out = [];
      var d = D();
      var cids = catIds();
      var pids = d.products.map(function (p) { return p.id; });

      function add(key, item, field, fieldLabel, message, label) {
        var l = String(label || "");
        if (l.length > 40) l = l.slice(0, 40) + "…";
        out.push({ key: key, id: item.id, label: l, field: field, fieldLabel: fieldLabel, message: message });
        state.catErrors[errKey(key, item.id, field)] = message;
        state.errorRows[key + ":" + item.id] = true;
        if (key === "variants") state.errorRows["products:" + item.productId] = true;
      }
      function dupIds(list, key, label) {
        var seen = {};
        list.forEach(function (it) {
          if (seen[it.id]) add(key, it, "id", "Identificador", "Hay dos elementos con el mismo identificador.", label(it));
          seen[it.id] = true;
          if (!ID_RE.test(it.id)) add(key, it, "id", "Identificador", "El identificador no es válido.", label(it));
        });
      }
      KEYS.forEach(function (k) {
        if (d[k].length > MAX_ROWS[k]) {
          out.push({ key: k, id: "", label: "", field: "", fieldLabel: "", message: "Máximo " + MAX_ROWS[k] + " " + NAMES[k].toLowerCase() + "." });
        }
      });

      dupIds(d.categories, "categories", function (c) { return c.name || "Línea"; });
      d.categories.forEach(function (c) {
        var l = c.name || "Línea sin nombre";
        if (!c.name) add("categories", c, "name", "Nombre", S.MSG.required, l);
        if (GROUPS.every(function (g) { return g.value !== c.group; })) add("categories", c, "group", "Grupo", "Elige Maquinaria o Insumos.", l);
        if (c.image && !isSafeImageRef(c.image)) add("categories", c, "image", "Imagen", "La imagen no es válida. Quítala y vuelve a subirla.", l);
      });

      dupIds(d.products, "products", function (p) { return p.name || "Producto"; });
      var slugCount = {};
      d.products.forEach(function (p) { if (p.slug) slugCount[p.slug] = (slugCount[p.slug] || 0) + 1; });
      d.products.forEach(function (p) {
        var l = p.name || "Producto sin nombre";
        if (cids.indexOf(p.categoryId) === -1) add("products", p, "categoryId", "Línea", "Elige una línea.", l);
        if (!p.name) add("products", p, "name", "Nombre", S.MSG.required, l);
        if (p.slug) {
          if (!SLUG_RE.test(p.slug)) add("products", p, "slug", "Slug", "Usa solo minúsculas, números y guiones (de 2 a 60 caracteres).", l);
          else if (slugCount[p.slug] > 1) add("products", p, "slug", "Slug", "El slug ya lo usa otro producto.", l);
        }
        if (p.summary.length > 160) add("products", p, "summary", "Resumen", "Máximo 160 caracteres.", l);
        if (p.description.length > 2000) add("products", p, "description", "Descripción", "Máximo 2000 caracteres.", l);
        if (p.usage.length > 2000) add("products", p, "usage", "Guía de uso", "Máximo 2000 caracteres.", l);
        if (p.photos.length > MAX_PHOTOS) add("products", p, "photos", "Fotos", "Máximo 6 fotos.", l);
        else if (p.photos.some(function (x) { return !isSafeImageRef(x); })) add("products", p, "photos", "Fotos", "Una de las fotos no es válida. Quítala y vuelve a subirla.", l);
        if (p.specs.length > MAX_SPECS) add("products", p, "specs", "Especificaciones", "Máximo " + MAX_SPECS + " especificaciones.", l);
        else {
          for (var i = 0; i < p.specs.length; i++) {
            var line = p.specs[i];
            if (line.length > 160) { add("products", p, "specs", "Especificaciones", "Cada especificación admite máximo 160 caracteres.", l); break; }
            var sp = parseSpec(line);
            if (line.indexOf(":") !== -1 && (!sp.label || !sp.value)) {
              add("products", p, "specs", "Especificaciones", sp.label ? "Falta el valor de «" + sp.label + "». Escribe \"Por definir\" si aún no lo sabes." : "Hay una especificación sin etiqueta.", l);
              break;
            }
          }
        }
        if (p.relatedRecipes.length > MAX_RELATED || p.relatedProducts.length > MAX_RELATED) add("products", p, "relatedProducts", "Relacionados", "Máximo " + MAX_RELATED + " recetas y " + MAX_RELATED + " productos relacionados.", l);
        if (p.relatedRecipes.concat(p.relatedProducts).some(function (x) { return !ID_RE.test(x); })) add("products", p, "relatedProducts", "Relacionados", "Hay un producto o receta relacionada con un identificador no válido. Quítalo.", l);
      });

      dupIds(d.variants, "variants", function (v) { return v.name || "Presentación"; });
      d.variants.forEach(function (v) {
        var owner = byId(d.products, v.productId);
        var l = (owner && owner.name ? owner.name + " · " : "") + (v.name || "Presentación sin nombre");
        if (pids.indexOf(v.productId) === -1) add("variants", v, "productId", "Producto", "La presentación no pertenece a ningún producto.", l);
        if (!v.name) add("variants", v, "name", "Nombre", S.MSG.required, l);
        if (v.sku.length > 40) add("variants", v, "sku", "SKU", "Máximo 40 caracteres.", l);
        if (state.priceRaw[v.id] !== undefined) add("variants", v, "price", "Precio", "Escribe un precio válido, por ejemplo 1250 o 1250.50.", l);
        else if (v.price != null && (typeof v.price !== "number" || !isFinite(v.price) || v.price < 0 || v.price > MAX_PRICE || Math.round(v.price * 100) / 100 !== v.price)) {
          add("variants", v, "price", "Precio", "Escribe un precio válido, por ejemplo 1250 o 1250.50.", l);
        }
        if (v.image && !isSafeImageRef(v.image)) add("variants", v, "image", "Foto", "La foto no es válida. Quítala y vuelve a subirla.", l);
      });
      return out;
    }

    /* ============================================================
     * Saving (§17.4): dependency order, abort on first failure, resume from it
     * ============================================================ */
    function save() {
      var d = D();
      var dk = ctx.dirtyKeys().filter(function (k) { return KEYS.indexOf(k) !== -1; });
      var orig = state.content;
      function ids(list) { return list.map(function (x) { return x.id; }); }
      var origCats = ids(orig.categories);
      var origProds = ids(orig.products);
      var finalCats = ids(d.categories);
      var finalProds = ids(d.products);
      var removedCat = origCats.some(function (id) { return finalCats.indexOf(id) === -1; });
      var removedProd = origProds.some(function (id) { return finalProds.indexOf(id) === -1; });
      var anyRemoved = removedCat || removedProd;
      var finalRows = {};
      KEYS.forEach(function (k) { finalRows[k] = ctx.payload(k); });
      var steps = [];
      function push(key, rows, isFinal) { steps.push({ key: key, rows: rows, final: isFinal }); }
      function has(k) { return dk.indexOf(k) !== -1; }

      if (!anyRemoved) {
        // Adds / edits / reorders only: parents first, so a new product finds its new line.
        KEYS.forEach(function (k) { if (has(k)) push(k, finalRows[k], true); });
      } else {
        // Pass 1 keeps only rows whose parent already exists in the Sheet, so a child is never
        // posted against a parent that is not there yet; removed parents are left for the end.
        var revertedCat = false;
        var p1Products = d.products.filter(function (p) { return origProds.indexOf(p.id) !== -1; }).map(function (p) {
          if (origCats.indexOf(p.categoryId) === -1) {
            var o = byId(orig.products, p.id);
            var c = ui.clone(p);
            c.categoryId = o ? o.categoryId : p.categoryId;
            revertedCat = true;
            return c;
          }
          return p;
        });
        var p1ProdIds = ids(p1Products);
        var p1Variants = d.variants.filter(function (v) { return p1ProdIds.indexOf(v.productId) !== -1; });
        var sameP = p1Products.length === d.products.length && !revertedCat;
        var sameV = p1Variants.length === d.variants.length;
        if (sameP && sameV) {
          // Nothing depends on a new parent: one children-first pass.
          ["variants", "products", "categories"].forEach(function (k) { if (has(k)) push(k, finalRows[k], true); });
        } else {
          // Both removals and adds: children-first pass without the new rows, then the final lists parent-first.
          if (has("variants")) push("variants", ctx.payloadOf(p1Variants), sameV);
          if (has("products")) push("products", ctx.payloadOf(p1Products), sameP);
          KEYS.forEach(function (k) {
            if (!has(k)) return;
            if (k === "variants" && sameV) return;
            if (k === "products" && sameP) return;
            push(k, finalRows[k], true);
          });
        }
      }

      var done = [];
      var last = null;
      return steps.reduce(function (chain, st) {
        return chain.then(function () {
          return api.saveSection(st.key, st.rows).then(function (c) {
            last = c;
            var n = ctx.normalizeContent(c);
            state.content[st.key] = n[st.key];
            if (st.final) {
              state.snapshot[st.key] = JSON.stringify(state.draft[st.key]);
              if (done.indexOf(st.key) === -1) done.push(st.key);
            }
          }, function (e) {
            throw describeFailure(e, st.key, done);
          });
        });
      }, Promise.resolve()).then(function () {
        return last || state.content;
      });
    }

    /* "No se guardó Productos: <server message>. Las líneas sí se guardaron." */
    function describeFailure(e, failed, done) {
      if (!e || e.code === "UNAUTHORIZED") return e;
      var base = String((e && e.message) || "Intenta de nuevo.").replace(/[.\s]+$/, "");
      var saved = done.filter(function (k) { return k !== failed; }).map(function (k) { return SAVED_PHRASE[k]; });
      var tail = "";
      if (saved.length === 1) tail = " " + saved[0].charAt(0).toUpperCase() + saved[0].slice(1) + " sí se guardaron.";
      else if (saved.length > 1) tail = " Sí se guardaron " + saved.join(" y ") + ".";
      var err = new Error("No se guardó " + NAMES[failed] + ": " + base + "." + tail);
      err.code = e.code;
      err.retryable = true;
      return err;
    }

    /* The sticky save bar mentions a product that has no presentations. */
    function barNote() {
      var v = state.cat;
      if (!v.productId) return "";
      var p = byId(D().products, v.productId);
      if (p && !variantsOf(p.id).length) return "Este producto no tiene presentaciones: se mostrará \"Precio a cotizar\".";
      return "";
    }

    return { render: render, validate: validate, save: save, barNote: barNote };
  }

  window.AdminCatalog = { create: create, normalize: normalizeCatalog, KEYS: KEYS, slugify: slugify };
})();
