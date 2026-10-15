/* Baristop admin — application (design spec §4).
 * Vanilla JS. All data coming from the Sheet is rendered with createElement / textContent. */
(function () {
  "use strict";

  var ui = window.AdminUI;
  var api = window.AdminApi;
  var S = window.AdminSections;
  var IMG = window.AdminImages;
  var el = ui.el;

  var DEMO_KEY = "baristop-v2:demo-content";
  var CACHE_KEY = "baristop-v2:cache";
  var HELP_PREFIX = "baristop-v2:help:";
  var SECTION_KEY = "baristop-v2:admin-section";
  var LIST_KEYS = ["social", "branches", "heroImages", "machineryCategories", "machines", "insumos", "recipes", "alliances", "announcements", "promos"];
  var DEMO = api.isDemo();

  var state = {
    content: null,
    defaults: null,
    section: null,        // section id
    draft: null,          // { contentKey: rows | siteObject }
    snapshot: null,       // { contentKey: JSON string }
    status: null,         // { kind: "ok" | "err", text, retry }
    saving: false,
    fieldErrors: {},      // Textos: { key: message }
    errorBox: [],         // [{ text }]
    errorRows: {},        // list sections: { rowIndex: true }
    machineryCat: null    // category id being viewed, or "__none"
  };

  var $ = function (id) { return document.getElementById(id); };
  var dom = {};
  var bar = null; // current save bar refs

  /* ============================================================
   * Helpers
   * ============================================================ */
  function sectionById(id) {
    return S.SECTIONS.filter(function (s) { return s.id === id; })[0] || null;
  }

  function showView(name) {
    ["login", "loading", "shell"].forEach(function (v) { dom["view-" + v].hidden = v !== name; });
  }

  function resolveImg(v) {
    if (!v || typeof v !== "string") return null;
    if (/^(https:|data:image\/|blob:)/i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
    return "../" + v.replace(/^\/+/, "");
  }

  function placeholderSrc(name) { return "../assets/placeholders/" + name; }

  function cmpItems(a, b) {
    var ao = typeof a.order === "number" ? a.order : parseInt(a.order, 10) || 0;
    var bo = typeof b.order === "number" ? b.order : parseInt(b.order, 10) || 0;
    if (ao !== bo) return ao - bo;
    return String(a.id).localeCompare(String(b.id));
  }

  function normalizeContent(raw) {
    var c = ui.clone(raw) || {};
    c.site = c.site && typeof c.site === "object" && !Array.isArray(c.site) ? c.site : {};
    LIST_KEYS.forEach(function (k) {
      var arr = Array.isArray(c[k]) ? c[k] : [];
      arr = arr.filter(function (x) { return x && typeof x === "object"; });
      arr.sort(cmpItems);
      arr.forEach(function (it) {
        it.visible = it.visible === true || it.visible === "TRUE" || it.visible === "true";
        var def = S.DEFS[k];
        def.fields.forEach(function (fd) {
          if (fd.type === "emails" || fd.type === "recipients" || fd.type === "linesArray") {
            if (typeof it[fd.key] === "string") it[fd.key] = it[fd.key].split(/[,\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
            if (!Array.isArray(it[fd.key])) it[fd.key] = [];
          } else if (it[fd.key] == null) {
            it[fd.key] = "";
          } else if (typeof it[fd.key] !== "string") {
            it[fd.key] = String(it[fd.key]);
          }
        });
      });
      c[k] = arr;
    });
    if (state.defaults && state.defaults.site) {
      Object.keys(state.defaults.site).forEach(function (k) {
        if (c.site[k] == null) c.site[k] = state.defaults.site[k];
      });
    }
    S.SITE_GROUPS.forEach(function (g) {
      g.fields.forEach(function (fd) { if (c.site[fd.key] == null) c.site[fd.key] = ""; });
    });
    return c;
  }

  function loadDefaults() {
    if (state.defaults) return Promise.resolve(state.defaults);
    return fetch("../data/default-content.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) { state.defaults = j; return j; });
  }

  function stripPrivate(content) {
    var c = ui.clone(content);
    if (c.site) { delete c.site.quoteAlwaysTo; delete c.site.quoteFallbackTo; }
    (c.branches || []).forEach(function (b) { b.quoteRecipients = []; });
    return c;
  }

  /* ============================================================
   * Login
   * ============================================================ */
  function showLogin(infoMsg) {
    state.content = null;
    state.draft = null;
    bar = null;
    showView("login");
    dom["login-error"].hidden = true;
    dom["login-info"].hidden = !infoMsg;
    dom["login-info"].textContent = infoMsg || "";
    dom["login-password"].value = "";
    dom["login-submit"].disabled = false;
    dom["login-submit"].textContent = "Entrar";
    dom["login-password"].focus();
  }

  function onLoginSubmit(ev) {
    ev.preventDefault();
    var pw = dom["login-password"].value;
    if (!pw) {
      showLoginError("Escribe la contraseña.", false);
      dom["login-password"].focus();
      return;
    }
    dom["login-error"].hidden = true;
    dom["login-info"].hidden = true;
    dom["login-submit"].disabled = true;
    dom["login-submit"].textContent = "Entrando…";
    api.login(pw).then(function () {
      dom["login-password"].value = "";
      loadLive();
    }, function (e) {
      dom["login-submit"].disabled = false;
      dom["login-submit"].textContent = "Entrar";
      showLoginError(e.message, e.retryable);
      dom["login-password"].focus();
      dom["login-password"].select();
    });
  }

  function showLoginError(msg, retry) {
    var box = dom["login-error"];
    ui.clear(box);
    box.appendChild(document.createTextNode(msg));
    if (retry) {
      box.appendChild(el("button", { cls: "btn-link", text: "Reintentar", attrs: { type: "button" }, on: { click: function () {
        dom["login-form"].requestSubmit ? dom["login-form"].requestSubmit() : onLoginSubmit({ preventDefault: function () {} });
      } } }));
    }
    box.hidden = false;
  }

  /* ============================================================
   * Loading content
   * ============================================================ */
  function showLoading(text) {
    showView("loading");
    dom["loading-text"].textContent = text || "Cargando contenido… (la primera carga puede tardar unos segundos)";
    dom["loading-box"].hidden = false;
    dom["load-error"].hidden = true;
  }

  function showLoadError(msg, retryFn) {
    showView("loading");
    dom["loading-box"].hidden = true;
    dom["load-error"].hidden = false;
    dom["load-error-text"].textContent = msg;
    dom["load-retry"].onclick = retryFn;
  }

  function loadLive() {
    showLoading();
    loadDefaults().catch(function () { /* optional: only used to fill missing keys */ }).then(function () {
      return api.getContent(true);
    }).then(function (content) {
      init(content);
    }, function (e) {
      if (e && e.code === "UNAUTHORIZED") return; // onUnauthorized already moved to login
      showLoadError(e.message || "No pudimos cargar el contenido.", loadLive);
    });
  }

  function loadDemo() {
    showLoading("Cargando demo…");
    loadDefaults().then(function (defaults) {
      var stored = ui.ls.get(DEMO_KEY);
      var content = defaults;
      if (stored) {
        try { content = JSON.parse(stored); } catch (e) { content = defaults; }
      }
      init(content);
    }, function () {
      showLoadError("No pudimos cargar el contenido de ejemplo (data/default-content.json).", loadDemo);
    });
  }

  /* ============================================================
   * Shell and navigation
   * ============================================================ */
  function init(content) {
    state.content = normalizeContent(content);
    buildNav();
    showView("shell");
    dom["demo-badge"].hidden = !DEMO;
    dom["reset-demo"].hidden = !DEMO;
    dom["logout-btn"].hidden = DEMO;
    var saved = ui.ls.get(SECTION_KEY);
    var first = sectionById(state.section) || sectionById(saved) || S.SECTIONS[0];
    state.section = null;
    enterSection(first.id);
  }

  function buildNav() {
    ui.clear(dom["side-nav-list"]);
    ui.clear(dom["nav-select"]);
    S.SECTIONS.forEach(function (s) {
      var b = el("button", { text: s.label, attrs: { type: "button", "data-section": s.id }, on: { click: function () { requestSection(s.id); } } });
      dom["side-nav-list"].appendChild(el("li", null, b));
      dom["nav-select"].appendChild(el("option", { text: s.label, props: { value: s.id } }));
    });
  }

  function syncNav() {
    var btns = dom["side-nav-list"].querySelectorAll("button");
    Array.prototype.forEach.call(btns, function (b) {
      if (b.getAttribute("data-section") === state.section) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    dom["nav-select"].value = state.section;
  }

  function requestSection(id) {
    if (id === state.section) { syncNav(); return; }
    if (!isDirty()) { enterSection(id); return; }
    ui.confirm("Tienes cambios sin guardar. Si sales ahora se perderán.", {
      title: "Cambios sin guardar", confirmLabel: "Salir sin guardar", cancelLabel: "Seguir editando", danger: true
    }).then(function (ok) {
      if (ok) enterSection(id); else syncNav();
    });
  }

  function enterSection(id) {
    var sec = sectionById(id);
    state.section = id;
    ui.ls.set(SECTION_KEY, id);
    state.status = null;
    state.fieldErrors = {};
    state.errorBox = [];
    state.errorRows = {};
    state.machineryCat = null;
    state.saving = false;
    buildDraft(sec);
    syncNav();
    render();
    window.scrollTo(0, 0);
  }

  function buildDraft(sec) {
    state.draft = {};
    state.snapshot = {};
    sec.contents.forEach(function (k) {
      state.draft[k] = ui.clone(state.content[k]);
      state.snapshot[k] = JSON.stringify(state.draft[k]);
    });
  }

  function dirtyKeys() {
    if (!state.draft) return [];
    return Object.keys(state.draft).filter(function (k) { return JSON.stringify(state.draft[k]) !== state.snapshot[k]; });
  }
  function isDirty() { return dirtyKeys().length > 0; }

  function markDirty() {
    if (state.status && state.status.kind === "ok") state.status = null;
    refreshBar();
  }

  /* ============================================================
   * Render
   * ============================================================ */
  function render(focusKey) {
    var sec = sectionById(state.section);
    var y = window.scrollY;
    var main = dom["content"];
    ui.clear(main);

    var title = sec.label;
    if (sec.kind === "machinery" && state.machineryCat) title = "Maquinaria";
    main.appendChild(el("div", { cls: "section-head" }, el("h2", { text: title, attrs: { id: "section-title" } })));
    main.appendChild(buildHelp(sec));

    var errBox = el("div", { cls: "errors-box", attrs: { role: "alert", tabindex: "-1", id: "errors-box" } });
    if (state.errorBox.length) {
      errBox.appendChild(el("strong", { text: "Hay campos por corregir:" }));
      var ul = el("ul");
      state.errorBox.forEach(function (m) { ul.appendChild(el("li", { text: m })); });
      errBox.appendChild(ul);
    } else {
      errBox.hidden = true;
    }
    main.appendChild(errBox);

    if (sec.kind === "site") main.appendChild(renderSite(sec));
    else if (sec.kind === "list") main.appendChild(renderList(S.DEFS[sec.def], state.draft[sec.contents[0]], null));
    else main.appendChild(renderMachinery());

    main.appendChild(buildBar());
    refreshBar();
    window.scrollTo(0, y);
    if (focusKey) refocus(focusKey);
  }

  function refocus(key) {
    var node = dom["content"].querySelector('[data-fk="' + key + '"]');
    if (node && node.disabled) {
      var alt = key.indexOf("up:") === 0 ? "down:" + key.slice(3) : key.indexOf("down:") === 0 ? "up:" + key.slice(5) : null;
      node = alt ? dom["content"].querySelector('[data-fk="' + alt + '"]') : null;
    }
    if (node && !node.disabled) node.focus({ preventScroll: true });
  }

  function buildHelp(sec) {
    var stored = ui.ls.get(HELP_PREFIX + sec.id);
    var det = el("details", { cls: "help" });
    if (stored !== "closed") det.open = true;
    det.appendChild(el("summary", { text: "Cómo llenar esta sección" }));
    var body = el("div", { cls: "help-body" });
    body.appendChild(el("p", { text: sec.help }));
    if (sec.helpAfter) body.appendChild(el("p", { text: sec.helpAfter }));
    if (sec.specs.length) {
      var list = el("ul");
      sec.specs.forEach(function (sp) {
        list.appendChild(el("li", { cls: "spec" }, (sp.label || "") + sp.text));
      });
      body.appendChild(list);
      if (DEMO) body.appendChild(el("p", { text: "En modo demo las imágenes se guardan en este navegador." }));
    }
    det.appendChild(body);
    det.addEventListener("toggle", function () { ui.ls.set(HELP_PREFIX + sec.id, det.open ? "open" : "closed"); });
    return det;
  }

  /* ---------- Textos ---------- */
  function renderSite(sec) {
    var wrap = el("div");
    var site = state.draft.site;
    // Each "site" section shows only its own groups (see QUOTE_GROUP in sections.js).
    var groups = S.SITE_GROUPS.filter(function (g) {
      var isQuote = g.title === S.QUOTE_GROUP;
      return sec && sec.id === "correos" ? isQuote : !isQuote;
    });
    groups.forEach(function (g, gi) {
      var det = el("details", { cls: "group" });
      if (gi === 0) det.open = true;
      det.appendChild(el("summary", { text: g.title }));
      var body = el("div", { cls: "group-body" });
      if (g.help) body.appendChild(el("p", { cls: "group-help", text: g.help }));
      g.fields.forEach(function (fd) {
        var id = ui.uid("site");
        var hintId = id + "-hint";
        var errId = id + "-err";
        var input;
        if (fd.long) {
          input = el("textarea", { attrs: { id: id, rows: "3" } });
        } else {
          input = el("input", { attrs: { id: id, type: "text", autocomplete: "off" } });
          if (fd.type === "digits") input.setAttribute("inputmode", "numeric");
          if (fd.type === "emails") { input.setAttribute("inputmode", "email"); input.setAttribute("spellcheck", "false"); }
        }
        input.value = site[fd.key] == null ? "" : site[fd.key];
        var errEl = el("p", { cls: "field-error", attrs: { id: errId }, props: { hidden: !state.fieldErrors[fd.key] } }, state.fieldErrors[fd.key] || "");
        if (state.fieldErrors[fd.key]) input.setAttribute("aria-invalid", "true");
        var described = [];
        if (fd.help) described.push(hintId);
        described.push(errId);
        input.setAttribute("aria-describedby", described.join(" "));
        if (fd.key === "quoteAlwaysTo") input.setAttribute("aria-required", "true");
        input.addEventListener("input", function () {
          site[fd.key] = input.value;
          if (state.fieldErrors[fd.key]) {
            delete state.fieldErrors[fd.key];
            errEl.hidden = true; errEl.textContent = "";
            input.removeAttribute("aria-invalid");
          }
          markDirty();
        });
        var label = el("label", { attrs: { for: id } }, [fd.label, fd.key === "quoteAlwaysTo" ? el("span", { cls: "req", text: "*", attrs: { "aria-hidden": "true" } }) : null]);
        body.appendChild(el("div", { cls: "field" }, [
          label, input,
          fd.help ? el("p", { cls: "hint", text: fd.help, attrs: { id: hintId } }) : null,
          errEl
        ]));
      });
      det.appendChild(body);
      wrap.appendChild(det);
    });
    return wrap;
  }

  /* ---------- list sections ---------- */
  function visibleSubset(list, filterFn) { return filterFn ? list.filter(filterFn) : list.slice(); }

  /* opts: { filter, extraDefaults, extraActions(item) -> [nodes], addLabel, onDelete(item) -> Promise<bool>|undefined, itemBadge(item) } */
  function renderList(def, list, opts) {
    opts = opts || {};
    var wrap = el("div");
    var items = visibleSubset(list, opts.filter);
    var atMax = !!def.maxRows && list.length >= def.maxRows;
    var tool = el("div", { cls: "list-toolbar" });
    var addBtn = el("button", {
      cls: "btn btn-primary", text: opts.addLabel || def.addLabel,
      attrs: { type: "button" },
      props: { disabled: atMax },
      on: { click: function () { openForm(def, list, null, opts.extraDefaults); } }
    });
    tool.appendChild(addBtn);
    if (atMax) {
      tool.appendChild(el("p", { cls: "note", text: "La portada tiene exactamente 4 imágenes. Edita o reemplaza una de las existentes." }));
    }
    wrap.appendChild(tool);

    if (!items.length) {
      wrap.appendChild(el("div", { cls: "empty", text: opts.emptyText || def.emptyText || "Todavía no hay nada aquí. Usa el botón \"" + (opts.addLabel || def.addLabel) + "\" para empezar." }));
      return wrap;
    }

    var ul = el("ul", { cls: "card-list" });
    items.forEach(function (item, i) {
      ul.appendChild(buildCard(def, list, item, items, i, opts));
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function buildThumb(def, item) {
    if (!def.imageKey) return null;
    var spec = S.IMAGE_SPECS[def.imageSpec];
    // Small slot: use the icon-only placeholder so no unreadable text shows.
    var thumbPh = spec && spec.placeholder === "machine-4x3.svg" ? "machine-4x3-sm.svg" : spec && spec.placeholder;
    var src = resolveImg(item[def.imageKey]);
    var contain = def.imageKey === "logo" || def.content === "machines";
    var img = el("img", { cls: "thumb" + (contain ? " contain" : ""), attrs: { alt: "", width: "72", height: "72", loading: "lazy" } });
    var triedPlaceholder = false;
    img.addEventListener("error", function () {
      if (!triedPlaceholder && spec) {
        triedPlaceholder = true;
        img.src = placeholderSrc(thumbPh);
      } else {
        var empty = el("div", { cls: "thumb thumb-empty", text: "Sin imagen" });
        if (img.parentNode) img.parentNode.replaceChild(empty, img);
      }
    });
    img.src = src || (spec ? placeholderSrc(thumbPh) : "");
    return img;
  }

  function buildCard(def, list, item, subset, idx, opts) {
    var li = el("li", { cls: "item-card" + (item.visible ? "" : " is-hidden") });
    var main = el("div", { cls: "item-main" });
    var thumb = buildThumb(def, item);
    if (thumb) main.appendChild(thumb);
    var text = el("div", { cls: "item-text" });
    text.appendChild(el("div", { cls: "item-title", text: def.title(item) }));
    var sub = def.subtitle(item);
    if (sub) text.appendChild(el("div", { cls: "item-sub", text: sub }));
    if (!item.visible) text.appendChild(el("span", { cls: "badge", text: "Oculto" }));
    if (opts.itemBadge) {
      var b = opts.itemBadge(item);
      if (b) text.appendChild(el("span", { cls: "badge", text: b }));
    }
    if (state.errorRows[def.content + ":" + item.id]) text.appendChild(el("span", { cls: "badge badge-warn", text: "Revisar" }));
    main.appendChild(text);
    li.appendChild(main);

    var actions = el("div", { cls: "item-actions" });
    var name = def.title(item);
    var reorder = el("div", { cls: "reorder", attrs: { role: "group", "aria-label": "Mover " + name } }, [
      el("button", { cls: "icon-btn", text: "▲", attrs: { type: "button", "aria-label": "Subir " + name, "data-fk": "up:" + item.id }, props: { disabled: idx === 0 },
        on: { click: function () { move(list, subset, idx, -1); render("up:" + item.id); } } }),
      el("button", { cls: "icon-btn", text: "▼", attrs: { type: "button", "aria-label": "Bajar " + name, "data-fk": "down:" + item.id }, props: { disabled: idx === subset.length - 1 },
        on: { click: function () { move(list, subset, idx, 1); render("down:" + item.id); } } })
    ]);
    actions.appendChild(reorder);

    var sw = el("button", { cls: "switch", attrs: { type: "button", role: "switch", "aria-checked": item.visible ? "true" : "false", "aria-label": "Visible: " + name, "data-fk": "vis:" + item.id },
      on: { click: function () { item.visible = !item.visible; markDirty(); render("vis:" + item.id); } } },
      [el("span", { cls: "track", attrs: { "aria-hidden": "true" } }), el("span", { text: "Visible" })]);
    actions.appendChild(sw);

    if (opts.extraActions) opts.extraActions(item).forEach(function (n) { actions.appendChild(n); });

    actions.appendChild(el("button", { cls: "btn btn-secondary btn-small", text: "Editar", attrs: { type: "button", "aria-label": "Editar " + name },
      on: { click: function () { openForm(def, list, item, null); } } }));
    actions.appendChild(el("button", { cls: "btn btn-danger btn-small", text: "Eliminar", attrs: { type: "button", "aria-label": "Eliminar " + name },
      on: { click: function () { removeItem(def, list, item, opts); } } }));
    li.appendChild(actions);
    return li;
  }

  function move(list, subset, idx, dir) {
    var a = subset[idx];
    var b = subset[idx + dir];
    if (!a || !b) return;
    var ia = list.indexOf(a);
    var ib = list.indexOf(b);
    list[ia] = b;
    list[ib] = a;
    markDirty();
  }

  function removeItem(def, list, item, opts) {
    var name = def.title(item);
    var msg = "¿Eliminar «" + name + "»? Desaparecerá del sitio cuando guardes los cambios.";
    var machinesOf = [];
    if (def.content === "machineryCategories") {
      machinesOf = state.draft.machines.filter(function (m) { return m.categoryId === item.id; });
      if (machinesOf.length) msg = "Esta categoría tiene " + machinesOf.length + (machinesOf.length === 1 ? " equipo" : " equipos") + ". Se eliminarán también. Desaparecerán del sitio cuando guardes los cambios.";
    }
    ui.confirm(msg, { title: "Eliminar", confirmLabel: "Eliminar", danger: true }).then(function (ok) {
      if (!ok) return;
      list.splice(list.indexOf(item), 1);
      if (machinesOf.length) {
        state.draft.machines = state.draft.machines.filter(function (m) { return m.categoryId !== item.id; });
      }
      markDirty();
      render();
    });
  }

  /* ---------- Maquinaria (two levels) ---------- */
  function renderMachinery() {
    var cats = state.draft.machineryCategories;
    var machines = state.draft.machines;
    var wrap = el("div");
    var catIds = cats.map(function (c) { return c.id; });

    if (!state.machineryCat) {
      var counts = {};
      machines.forEach(function (m) { counts[m.categoryId] = (counts[m.categoryId] || 0) + 1; });
      wrap.appendChild(el("p", { cls: "note", text: "Categorías. Abre una para ver y editar sus equipos." }));
      wrap.appendChild(renderList(S.DEFS.machineryCategories, cats, {
        itemBadge: function (it) { var n = counts[it.id] || 0; return n + (n === 1 ? " equipo" : " equipos"); },
        extraActions: function (it) {
          return [el("button", { cls: "btn btn-primary btn-small", text: "Ver equipos →", attrs: { type: "button", "aria-label": "Ver equipos de " + (it.name || "categoría") },
            on: { click: function () { state.machineryCat = it.id; render(); window.scrollTo(0, 0); } } })];
        }
      }));
      var orphans = machines.filter(function (m) { return catIds.indexOf(m.categoryId) === -1; });
      if (orphans.length) {
        wrap.appendChild(el("div", { cls: "item-card" }, [
          el("div", { cls: "item-text" }, [
            el("div", { cls: "item-title", text: "Sin categoría" }),
            el("div", { cls: "item-sub", text: orphans.length + (orphans.length === 1 ? " equipo" : " equipos") + " sin una categoría válida. Ábrelos para asignarles una." })
          ]),
          el("div", { cls: "item-actions" }, el("button", { cls: "btn btn-secondary btn-small", text: "Ver equipos →", attrs: { type: "button" },
            on: { click: function () { state.machineryCat = "__none"; render(); window.scrollTo(0, 0); } } }))
        ]));
      }
      return wrap;
    }

    var isNone = state.machineryCat === "__none";
    var cat = cats.filter(function (c) { return c.id === state.machineryCat; })[0];
    var catName = isNone ? "Sin categoría" : (cat ? cat.name : "Categoría");
    wrap.appendChild(el("div", { cls: "crumbs" }, [
      el("button", { cls: "btn btn-secondary btn-small", text: "← Categorías", attrs: { type: "button" }, on: { click: function () { state.machineryCat = null; render(); } } }),
      el("h3", { text: catName })
    ]));
    wrap.appendChild(renderList(S.DEFS.machines, machines, {
      filter: function (m) { return isNone ? catIds.indexOf(m.categoryId) === -1 : m.categoryId === state.machineryCat; },
      extraDefaults: isNone ? {} : { categoryId: state.machineryCat },
      addLabel: "+ Agregar equipo",
      emptyText: "Esta categoría todavía no tiene equipos. Usa \"+ Agregar equipo\"."
    }));
    return wrap;
  }

  /* ============================================================
   * Item edit form (modal)
   * ============================================================ */
  function newId(def, list) {
    var base = def.content.toLowerCase();
    var id;
    do {
      id = base + "-" + Date.now().toString(36) + (Math.random() < 0.5 ? "" : Math.floor(Math.random() * 36).toString(36));
    } while (list.some(function (x) { return x.id === id; }));
    return id.slice(0, 40);
  }

  function emptyItem(def, list, extra) {
    var it = { id: newId(def, list), order: (list.length + 1) * 10, visible: true };
    def.fields.forEach(function (fd) {
      it[fd.key] = (fd.type === "emails" || fd.type === "recipients" || fd.type === "linesArray") ? [] : "";
    });
    if (extra) Object.keys(extra).forEach(function (k) { it[k] = extra[k]; });
    return it;
  }

  function openForm(def, list, item, extraDefaults) {
    var isNew = !item;
    var work = isNew ? emptyItem(def, list, extraDefaults) : ui.clone(item);
    var busy = 0;
    var controls = {}; // key -> { errEl, input }
    var form = el("form", { attrs: { novalidate: "novalidate" }, on: { submit: function (e) { e.preventDefault(); } } });
    var formError = el("p", { cls: "field-error", attrs: { role: "alert" }, props: { hidden: true } });

    def.fields.forEach(function (fd) {
      var c = buildControl(def, fd, work, function (d) { busy += d; });
      controls[fd.key] = c;
      form.appendChild(c.wrap);
    });
    form.appendChild(formError);

    function normalizeWork() {
      def.fields.forEach(function (fd) {
        var v = work[fd.key];
        if (typeof v === "string") work[fd.key] = fd.type === "digits" ? S.normalizeDigits(v) : (fd.type === "textarea" || fd.type === "lines" ? v.replace(/\s+$/, "") : v.trim());
        if (fd.type === "emails" || fd.type === "recipients") {
          work[fd.key] = (v || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
        }
        if (fd.type === "linesArray") {
          work[fd.key] = (v || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
        }
      });
    }

    form.appendChild(el("p", { cls: "note", text: "Al pulsar Listo, el cambio queda en la lista. Se publica en el sitio cuando pulses «Guardar cambios»." }));

    ui.modal({
      title: (isNew ? "Agregar " : "Editar ") + def.noun,
      body: form,
      wide: true,
      actions: [
        { label: "Cancelar", kind: "secondary" },
        { label: "Listo", kind: "primary", onClick: function () {
          if (busy > 0) {
            formError.textContent = "Espera a que termine de subirse la imagen.";
            formError.hidden = false;
            return false;
          }
          normalizeWork();
          var ctx = { categoryIds: state.draft.machineryCategories ? state.draft.machineryCategories.map(function (c) { return c.id; }) : [] };
          var errs = S.validateItem(def.content, work, ctx);
          var keys = Object.keys(errs);
          // refresh inputs that were normalised (digits, trimmed text)
          def.fields.forEach(function (fd) { if (controls[fd.key].sync) controls[fd.key].sync(); });
          def.fields.forEach(function (fd) { controls[fd.key].setError(errs[fd.key] || ""); });
          if (keys.length) {
            formError.textContent = "Revisa los campos marcados en rojo.";
            formError.hidden = false;
            var firstKey = def.fields.filter(function (fd) { return errs[fd.key]; })[0].key;
            controls[firstKey].focus();
            return false;
          }
          if (isNew) {
            list.push(work);
          } else {
            var target = list.indexOf(item);
            list[target] = work;
          }
          delete state.errorRows[def.content + ":" + work.id];
          markDirty();
          render();
          return true;
        } }
      ]
    });
  }

  /* Builds one labelled control. Returns { wrap, setError, focus, sync }. */
  function buildControl(def, fd, work, busyFn) {
    var id = ui.uid("f");
    var errId = id + "-err";
    var hintId = id + "-hint";
    var errEl = el("p", { cls: "field-error", attrs: { id: errId }, props: { hidden: true } });
    var hint = fd.help ? el("p", { cls: "hint", text: fd.help, attrs: { id: hintId } }) : null;
    var wrap = el("div", { cls: "field" });
    var control;
    var focusNode;
    var syncFn = null;
    var invalidTargets = [];

    function describe(node) {
      var ids = [];
      if (hint) ids.push(hintId);
      ids.push(errId);
      node.setAttribute("aria-describedby", ids.join(" "));
    }

    var labelContent = [fd.label];
    if (fd.required) labelContent.push(el("span", { cls: "req", text: "*", attrs: { "aria-hidden": "true" } }));

    switch (fd.type) {
      case "textarea":
      case "lines": {
        control = el("textarea", { attrs: { id: id, rows: fd.type === "lines" ? "4" : "3" } });
        control.value = work[fd.key] || "";
        control.addEventListener("input", function () { work[fd.key] = control.value; });
        describe(control);
        if (fd.required) control.setAttribute("aria-required", "true");
        focusNode = control; invalidTargets = [control];
        syncFn = function () { control.value = work[fd.key] || ""; };
        wrap.appendChild(el("label", { attrs: { for: id } }, labelContent));
        wrap.appendChild(control);
        break;
      }
      case "linesArray": {
        control = el("textarea", { attrs: { id: id, rows: "3" } });
        control.value = (work[fd.key] || []).join("\n");
        control.addEventListener("input", function () { work[fd.key] = control.value.split("\n"); });
        describe(control);
        focusNode = control; invalidTargets = [control];
        syncFn = function () { control.value = (work[fd.key] || []).join("\n"); };
        wrap.appendChild(el("label", { attrs: { for: id } }, labelContent));
        wrap.appendChild(control);
        break;
      }
      case "emails":
      case "recipients": {
        var listWrap = el("div", { cls: "list-editor", attrs: { role: "group", "aria-labelledby": id + "-lbl" } });
        var rows = [];
        var addBtn;
        var rebuild = function (focusLast) {
          ui.clear(listWrap);
          rows = [];
          var vals = work[fd.key];
          var n = Math.max(vals.length, 1);
          for (var i = 0; i < n; i++) (function (i) {
            var inp = el("input", { attrs: { type: "text", inputmode: "email", spellcheck: "false", autocomplete: "off", "aria-label": fd.label + " " + (i + 1), placeholder: "correo@ejemplo.com" } });
            inp.value = vals[i] || "";
            inp.addEventListener("input", function () { work[fd.key][i] = inp.value; });
            describe(inp);
            rows.push(inp);
            listWrap.appendChild(el("div", { cls: "list-row" }, [
              inp,
              el("button", { cls: "icon-btn", text: "×", attrs: { type: "button", "aria-label": "Quitar correo " + (i + 1) },
                on: { click: function () { work[fd.key].splice(i, 1); rebuild(); } } })
            ]));
          })(i);
          addBtn = el("button", { cls: "btn btn-secondary btn-small", text: "+ otro correo", attrs: { type: "button" },
            on: { click: function () { while (work[fd.key].length < rows.length) work[fd.key].push(""); work[fd.key].push(""); rebuild(true); } } });
          listWrap.appendChild(addBtn);
          if (focusLast) rows[rows.length - 1].focus();
          invalidTargets = rows;
        };
        rebuild();
        focusNode = { focus: function () { (rows[0] || addBtn).focus(); } };
        wrap.appendChild(el("div", { cls: "label", text: fd.label, attrs: { id: id + "-lbl" } }));
        wrap.appendChild(listWrap);
        syncFn = function () { rebuild(); };
        break;
      }
      case "category": {
        control = el("select", { attrs: { id: id } });
        var cats = state.draft.machineryCategories || [];
        control.appendChild(el("option", { text: "Elige una categoría…", props: { value: "" } }));
        cats.forEach(function (c) { control.appendChild(el("option", { text: c.name || c.id, props: { value: c.id } })); });
        control.value = work[fd.key] || "";
        if (control.value !== (work[fd.key] || "")) control.value = "";
        control.addEventListener("change", function () { work[fd.key] = control.value; });
        describe(control);
        control.setAttribute("aria-required", "true");
        focusNode = control; invalidTargets = [control];
        wrap.appendChild(el("label", { attrs: { for: id } }, labelContent));
        wrap.appendChild(control);
        break;
      }
      case "image": {
        var ic = buildImageControl(def, fd, work, id, busyFn);
        wrap.appendChild(el("div", { cls: "label", text: fd.label, attrs: { id: id + "-lbl" } }));
        wrap.appendChild(ic.node);
        focusNode = ic;
        break;
      }
      default: { // text, url, digits, date
        control = el("input", { attrs: { id: id, type: fd.type === "date" ? "date" : "text", autocomplete: "off" } });
        if (fd.type === "url") { control.setAttribute("inputmode", "url"); control.setAttribute("spellcheck", "false"); control.setAttribute("placeholder", "https://"); }
        if (fd.type === "digits") { control.setAttribute("inputmode", "numeric"); }
        if (fd.ph) control.setAttribute("placeholder", fd.ph);
        if (fd.max) control.setAttribute("maxlength", String(fd.max));
        control.value = work[fd.key] || "";
        control.addEventListener("input", function () { work[fd.key] = control.value; });
        if (fd.type === "digits") {
          control.addEventListener("blur", function () {
            var n = S.normalizeDigits(control.value);
            control.value = n; work[fd.key] = n;
          });
        }
        describe(control);
        if (fd.required) control.setAttribute("aria-required", "true");
        focusNode = control; invalidTargets = [control];
        syncFn = function () { control.value = work[fd.key] || ""; };
        wrap.appendChild(el("label", { attrs: { for: id } }, labelContent));
        wrap.appendChild(control);
      }
    }
    if (hint && fd.type !== "image") wrap.appendChild(hint);
    wrap.appendChild(errEl);

    return {
      wrap: wrap,
      focus: function () { if (focusNode && focusNode.focus) focusNode.focus(); },
      sync: syncFn,
      setError: function (msg) {
        errEl.textContent = msg;
        errEl.hidden = !msg;
        (fd.type === "emails" || fd.type === "recipients" ? invalidTargets : invalidTargets).forEach(function (n) {
          if (msg) n.setAttribute("aria-invalid", "true"); else n.removeAttribute("aria-invalid");
        });
      }
    };
  }

  /* ---------- image field ---------- */
  function buildImageControl(def, fd, work, id, busyFn) {
    var spec = S.IMAGE_SPECS[def.content + "." + fd.key];
    var node = el("div", { cls: "image-field" });
    var previewBox = el("div", { cls: "image-preview" });
    var img = el("img", { attrs: { alt: "Vista previa de la imagen" } });
    previewBox.appendChild(img);
    var status = el("p", { cls: "image-status", attrs: { role: "status", "aria-live": "polite" } });
    var fileInput = el("input", { attrs: { type: "file", accept: spec.allowSvg ? "image/*,.svg" : "image/*", id: id, "aria-label": fd.label + ": elegir archivo", tabindex: "-1" }, props: { hidden: true } });
    var uploadBtn = el("button", { cls: "btn btn-secondary btn-small", attrs: { type: "button", "aria-describedby": id + "-spec" } });
    var removeBtn = el("button", { cls: "btn btn-secondary btn-small", text: "Quitar", attrs: { type: "button" } });
    var retryBtn = el("button", { cls: "btn btn-primary btn-small", text: "Reintentar", attrs: { type: "button" }, props: { hidden: true } });
    var actions = el("div", { cls: "image-actions" }, [uploadBtn, removeBtn, retryBtn]);
    var specLine = el("p", { cls: "hint", text: spec.help, attrs: { id: id + "-spec" } });
    var localPreview = null; // object URL of the freshly processed file
    var pending = null;      // processed result waiting for a (re)try of the upload
    var token = 0;

    function setStatus(kind, text) {
      status.className = "image-status" + (kind ? " " + kind : "");
      status.textContent = text || "";
    }

    function refresh() {
      var cur = work[fd.key];
      var src = localPreview || resolveImg(cur);
      img.onerror = function () {
        img.onerror = null;
        img.src = placeholderSrc(spec.placeholder);
      };
      img.src = src || placeholderSrc(spec.placeholder);
      uploadBtn.textContent = cur ? "Cambiar foto" : "Elegir foto";
      removeBtn.hidden = !cur;
    }

    function revokeLocal() {
      if (localPreview) { URL.revokeObjectURL(localPreview); localPreview = null; }
    }

    function doUpload(res, myToken) {
      busyFn(1);
      retryBtn.hidden = true;
      setStatus("", "Subiendo…");
      return IMG.toDataUrl(res.blob).then(function (enc) {
        if (!api.hasBackend() || DEMO) {
          return { url: enc.dataUrl };
        }
        return api.uploadImage({
          section: def.content, itemId: work.id, field: fd.key,
          name: res.baseName + "." + res.ext, mime: res.mime, dataBase64: enc.base64
        });
      }).then(function (data) {
        if (myToken !== token) { busyFn(-1); return; }
        work[fd.key] = data.url;
        pending = null;
        busyFn(-1);
        var dims = res.svg ? "SVG" : res.width + " × " + res.height;
        var info = "Imagen lista · " + dims + " · " + ui.formatKb(res.bytes) + (DEMO ? " (guardada en este navegador)" : "");
        if (res.aspectWarning) setStatus("warn", info + ". La imagen se verá recortada en el sitio.");
        else setStatus("ok", info);
        refresh();
      }, function (e) {
        if (myToken !== token) { busyFn(-1); return; }
        // Stay busy (the +1 from the start is kept) until the user retries or removes the image.
        pending = res;
        pending.busyHeld = true;
        setStatus("err", e.message || "No pudimos subir la imagen.");
        retryBtn.hidden = !(e.retryable !== false);
      });
    }

    uploadBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (pending && pending.busyHeld) { busyFn(-1); pending = null; }
      token += 1;
      var myToken = token;
      revokeLocal();
      retryBtn.hidden = true;
      setStatus("", "Procesando imagen…");
      busyFn(1);
      IMG.process(file, spec).then(function (res) {
        busyFn(-1);
        if (myToken !== token) return;
        localPreview = URL.createObjectURL(res.blob);
        img.src = localPreview;
        return doUpload(res, myToken);
      }, function (e) {
        busyFn(-1);
        if (myToken !== token) return;
        setStatus("err", e.message);
      });
    });
    retryBtn.addEventListener("click", function () {
      if (!pending) return;
      var res = pending;
      if (res.busyHeld) { busyFn(-1); res.busyHeld = false; }
      token += 1;
      doUpload(res, token);
    });
    removeBtn.addEventListener("click", function () {
      if (pending && pending.busyHeld) { busyFn(-1); }
      pending = null;
      token += 1;
      revokeLocal();
      work[fd.key] = "";
      retryBtn.hidden = true;
      setStatus("", "");
      refresh();
      uploadBtn.focus();
    });

    node.appendChild(previewBox);
    node.appendChild(actions);
    node.appendChild(fileInput);
    node.appendChild(status);
    node.appendChild(specLine);
    refresh();
    return { node: node, focus: function () { uploadBtn.focus(); } };
  }

  /* ============================================================
   * Saving
   * ============================================================ */
  function buildBar() {
    var msg = el("div", { cls: "save-msg", attrs: { role: "status", "aria-live": "polite" } });
    var discard = el("button", { cls: "btn btn-secondary", text: "Descartar cambios", attrs: { type: "button" }, on: { click: discardChanges } });
    var save = el("button", { cls: "btn btn-primary", text: "Guardar cambios", attrs: { type: "button" }, on: { click: save_ } });
    var root = el("div", { cls: "save-bar" }, el("div", { cls: "save-inner" }, [msg, el("div", { cls: "save-actions" }, [discard, save])]));
    bar = { root: root, msg: msg, discard: discard, save: save };
    return root;
  }

  function refreshBar() {
    if (!bar) return;
    var dirty = isDirty();
    var st = state.status;
    bar.root.hidden = !(dirty || state.saving || st);
    bar.msg.className = "save-msg";
    if (state.saving) {
      bar.msg.textContent = "Guardando…";
    } else if (st) {
      bar.msg.textContent = st.text;
      bar.msg.className = "save-msg " + (st.kind === "ok" ? "ok" : "err");
    } else if (dirty) {
      bar.msg.textContent = "Cambios sin publicar — pulsa «Guardar cambios» para que se vean en el sitio.";
    } else {
      bar.msg.textContent = "";
    }
    bar.save.disabled = state.saving || (!dirty && !(st && st.retry));
    bar.save.textContent = state.saving ? "Guardando…" : (st && st.retry ? "Reintentar" : "Guardar cambios");
    bar.discard.hidden = !dirty || state.saving;
    // Pulse the save button once when the bar first becomes dirty.
    if (dirty && !bar.wasDirty) {
      bar.root.classList.add("is-new");
      setTimeout(function () { bar.root.classList.remove("is-new"); }, 700);
    }
    bar.wasDirty = dirty;
  }

  function discardChanges() {
    ui.confirm("¿Descartar todos los cambios sin guardar de esta sección?", { title: "Descartar cambios", confirmLabel: "Descartar", danger: true }).then(function (ok) {
      if (!ok) return;
      var cat = state.machineryCat;
      buildDraft(sectionById(state.section));
      state.status = null; state.fieldErrors = {}; state.errorBox = []; state.errorRows = {};
      state.machineryCat = cat;
      render();
    });
  }

  function rewriteOrder(rows) {
    return rows.map(function (r, i) {
      var c = ui.clone(r);
      c.order = (i + 1) * 10;
      return c;
    });
  }

  function validateDraft(sec) {
    var msgs = [];
    state.fieldErrors = {};
    state.errorRows = {};
    if (sec.kind === "site") {
      var errs = S.validateSite(state.draft.site);
      state.fieldErrors = errs;
      S.SITE_GROUPS.forEach(function (g) {
        g.fields.forEach(function (fd) { if (errs[fd.key]) msgs.push(fd.label + ": " + errs[fd.key]); });
      });
      return msgs;
    }
    var catIds = (state.draft.machineryCategories || state.content.machineryCategories).map(function (c) { return c.id; });
    sec.contents.forEach(function (k) {
      var list = state.draft[k];
      var res = S.validateRows(k, list, { categoryIds: catIds });
      res.forEach(function (r) {
        var line = (r.label ? "\"" + r.label + "\" — " : "") + (r.fieldLabel ? r.fieldLabel + ": " : "") + r.message;
        msgs.push(line);
        if (r.row >= 0 && list[r.row]) state.errorRows[k + ":" + list[r.row].id] = true;
      });
    });
    return msgs;
  }

  function save_() {
    if (state.saving) return;
    var sec = sectionById(state.section);
    var msgs = validateDraft(sec);
    if (msgs.length) {
      state.errorBox = msgs;
      state.status = { kind: "err", text: "No se guardó: revisa los campos marcados.", retry: false };
      render();
      var box = $("errors-box");
      if (box && !box.hidden) { box.scrollIntoView({ block: "center" }); box.focus({ preventScroll: true }); }
      return;
    }
    state.errorBox = [];
    state.status = null;
    state.saving = true;
    refreshBar();

    var job = DEMO ? saveDemo(sec) : saveLive(sec);
    job.then(function (content) {
      state.content = normalizeContent(content);
      if (!DEMO) {
        ui.ls.set(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), content: stripPrivate(content) }));
      }
      var cat = state.machineryCat;
      buildDraft(sec);
      state.machineryCat = cat;
      state.saving = false;
      state.status = { kind: "ok", text: "Guardado · " + ui.timeHm() + " · Ya está en el sitio (puede tardar hasta 5 min en verse).", retry: false };
      render();
    }, function (e) {
      state.saving = false;
      if (e && e.code === "UNAUTHORIZED") return;
      state.status = { kind: "err", text: e.message || "No pudimos guardar. Intenta de nuevo.", retry: !!(e && e.retryable) };
      refreshBar();
    });
  }

  function sectionPayload(k) {
    if (k === "site") {
      var out = {};
      Object.keys(state.draft.site).forEach(function (key) {
        if (key.charAt(0) === "_") return;
        var v = state.draft.site[key];
        out[key] = typeof v === "string" ? v.trim() : v;
      });
      return out;
    }
    return rewriteOrder(state.draft[k]);
  }

  function saveLive(sec) {
    var steps = [];
    var dk = dirtyKeys();
    if (sec.kind === "machinery") {
      var catsDirty = dk.indexOf("machineryCategories") !== -1;
      var machDirty = dk.indexOf("machines") !== -1;
      var origCats = state.content.machineryCategories;
      var finalIds = state.draft.machineryCategories.map(function (c) { return c.id; });
      var removed = origCats.filter(function (c) { return finalIds.indexOf(c.id) === -1; });
      var origIds = origCats.map(function (c) { return c.id; });
      var added = finalIds.filter(function (id) { return origIds.indexOf(id) === -1; });
      var catsFinal = sectionPayload("machineryCategories");
      if (catsDirty) {
        if (removed.length) {
          // New categories must exist before machines reference them, and removed ones
          // must outlive the machines that still point at them: union first, final last.
          if (added.length) steps.push({ section: "machineryCategories", rows: catsFinal.concat(rewriteOrder(removed)).map(function (r, i) { r.order = (i + 1) * 10; return r; }) });
        } else {
          steps.push({ section: "machineryCategories", rows: catsFinal });
        }
      }
      if (machDirty) steps.push({ section: "machines", rows: sectionPayload("machines") });
      if (catsDirty && removed.length) steps.push({ section: "machineryCategories", rows: catsFinal });
    } else {
      steps.push({ section: sec.contents[0], rows: sectionPayload(sec.contents[0]) });
    }
    var last = null;
    return steps.reduce(function (p, step) {
      return p.then(function () {
        return api.saveSection(step.section, step.rows).then(function (c) { last = c; });
      });
    }, Promise.resolve()).then(function () {
      return last || state.content;
    });
  }

  function saveDemo(sec) {
    return new Promise(function (resolve, reject) {
      var content = ui.clone(state.content);
      sec.contents.forEach(function (k) { content[k] = sectionPayload(k); });
      content.updatedAt = new Date().toISOString();
      if (!ui.ls.set(DEMO_KEY, JSON.stringify(content))) {
        var err = new Error("No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Prueba con imágenes más pequeñas.");
        err.retryable = false;
        reject(err);
        return;
      }
      resolve(content);
    });
  }

  /* ============================================================
   * Boot
   * ============================================================ */
  function collectDom() {
    ["view-login", "view-loading", "view-shell", "login-form", "login-password", "login-error", "login-info", "login-submit",
      "loading-box", "loading-text", "load-error", "load-error-text", "load-retry", "demo-badge", "nav-select", "side-nav-list",
      "content", "preview-link", "logout-btn", "reset-demo"].forEach(function (id) { dom[id] = $(id); });
  }

  function logout() {
    var go = function () { api.clearToken(); showLogin(); };
    if (isDirty()) {
      ui.confirm("Tienes cambios sin guardar. Si sales ahora se perderán.", { title: "Salir del panel", confirmLabel: "Salir sin guardar", cancelLabel: "Seguir editando", danger: true })
        .then(function (ok) { if (ok) go(); });
    } else {
      go();
    }
  }

  function boot() {
    collectDom();
    var previewUrl = new URL("../?nocache=1", document.baseURI);
    if (DEMO) previewUrl.searchParams.set("demo", "1");
    dom["preview-link"].href = previewUrl.href;

    dom["login-form"].addEventListener("submit", onLoginSubmit);
    dom["logout-btn"].addEventListener("click", logout);
    dom["nav-select"].addEventListener("change", function () { requestSection(dom["nav-select"].value); });
    dom["reset-demo"].addEventListener("click", function () {
      ui.confirm("Se borrarán todos los cambios de la demo y se volverá al contenido de ejemplo.", { title: "Restablecer demo", confirmLabel: "Restablecer", danger: true }).then(function (ok) {
        if (!ok) return;
        ui.ls.remove(DEMO_KEY);
        state.draft = null;
        loadDemo();
      });
    });
    window.addEventListener("beforeunload", function (e) {
      if (isDirty()) { e.preventDefault(); e.returnValue = ""; }
    });

    api.onUnauthorized(function () {
      state.draft = null;
      showLogin("Tu sesión terminó. Vuelve a entrar.");
    });

    if (DEMO) loadDemo();
    else if (api.getToken()) loadLive();
    else showLogin();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
