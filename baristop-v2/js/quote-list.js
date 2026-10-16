/*
 * Baristop v2 — quote list ("Mi cotización") (spec 15).
 *
 * A cart without checkout: ids + quantities in localStorage, a slide-over drawer on every
 * page, and the round-1 quote form mounted inside it. Lines are rehydrated from the
 * content on every render, so prices and names are never stored client-side.
 *
 * Exposes window.BaristopQuoteList = { get, add, setQty, remove, clear, count, lines,
 * validLines, open, close, isOpen } and dispatches "baristop:list" on change.
 *
 * History contract (15.1): open pushes {qlist:true} + "#lista"; close pops that entry only
 * when history.state says WE pushed it, otherwise it strips the hash in place (a page opened
 * directly on #lista has no entry of ours; back() would leave the site).
 */
(function () {
  "use strict";

  var R = window.BaristopRender;
  var C = window.BaristopContent;
  var QF = window.BaristopQuoteForm;
  if (!R) return;

  var KEY = "baristop-v2:quote-list";
  var MAX_LINES = 40;
  var ID_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  var el = R.el, clear = R.clear;
  var items = [];
  var memoryOnly = false;
  var drawer = null, backdrop = null, parts = {};
  var lastFocus = null;
  var pendingThen = null;
  var sent = false;
  var confirming = false;
  var formCtl = null;

  /* ---------- storage ---------- */

  function sanitize(arr) {
    var seen = {}, out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (it) {
      if (!it || typeof it !== "object" || out.length >= MAX_LINES) return;
      var p = typeof it.p === "string" ? it.p : "", v = typeof it.v === "string" ? it.v : "";
      var q = Math.floor(Number(it.q));
      if (!ID_RE.test(p) || (v !== "" && !ID_RE.test(v)) || !(q >= 1)) return;
      var key = p + "|" + v;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ p: p, v: v, q: Math.min(q, 999), t: Number(it.t) || Date.now() });
    });
    return out;
  }

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      var d = JSON.parse(raw);
      return d && d.v === 1 ? sanitize(d.items) : [];
    } catch (e) {
      return [];
    }
  }

  function write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: 1, items: items }));
      memoryOnly = false;
    } catch (e) {
      memoryOnly = true; // blocked / private mode: the list lives in memory for this page
    }
  }

  function probeStorage() {
    try {
      window.localStorage.setItem(KEY + ":probe", "1");
      window.localStorage.removeItem(KEY + ":probe");
      memoryOnly = false;
    } catch (e) {
      memoryOnly = true;
    }
  }

  /* ---------- model ---------- */

  function find(p, v) {
    for (var i = 0; i < items.length; i++) if (items[i].p === p && items[i].v === v) return items[i];
    return null;
  }

  function changed() {
    updateBadges();
    if (drawer) renderBody();
    document.dispatchEvent(new CustomEvent("baristop:list"));
  }

  function clampQty(q) {
    q = Math.floor(Number(q));
    return q >= 1 ? Math.min(q, 999) : 1;
  }

  // Returns { ok, reason }.
  function add(productId, variantId, qty) {
    var p = String(productId || ""), v = String(variantId || "");
    if (!ID_RE.test(p) || (v !== "" && !ID_RE.test(v))) return { ok: false, reason: "invalid" };
    var line = find(p, v);
    if (line) {
      line.q = Math.min(999, line.q + clampQty(qty));
    } else {
      if (items.length >= MAX_LINES) return { ok: false, reason: "full" };
      items.push({ p: p, v: v, q: clampQty(qty), t: Date.now() });
    }
    sent = false;
    write();
    changed();
    return { ok: true };
  }

  function setQty(productId, variantId, qty) {
    var line = find(productId, variantId || "");
    if (!line) return;
    line.q = clampQty(qty);
    write();
    changed();
  }

  function remove(productId, variantId) {
    var before = items.length;
    items = items.filter(function (it) { return !(it.p === productId && it.v === (variantId || "")); });
    if (items.length === before) return;
    write();
    changed();
  }

  function clearAll() {
    if (!items.length) return;
    items = [];
    write();
    changed();
  }

  function money(n) { return window.BaristopSchema.formatMoney(n); }

  // Rehydrates the stored ids against the content. Unknown / hidden lines are flagged, not dropped.
  function lines(content) {
    content = content || R.getContent();
    var idx = content ? R.catalogIndex(content) : null;
    return items.map(function (it) {
      var p = idx ? idx.prodById[it.p] : null;
      var v = null;
      if (p && it.v) {
        (idx.varsByProd[p.id] || []).forEach(function (x) { if (x.id === it.v) v = x; });
      }
      var found = !!p && (it.v === "" || !!v);
      return {
        key: it.p + "|" + it.v,
        productId: it.p, variantId: it.v, qty: it.q,
        found: found,
        product: p, variant: v,
        name: p ? p.name : it.p,
        brand: p ? p.brand : "",
        variantName: v ? v.name : "",
        sku: v ? v.sku : "",
        unit: v ? v.unit : "",
        price: v && typeof v.price === "number" ? v.price : null,
        image: (v && v.image) || (p && p.photos[0]) || ""
      };
    });
  }

  function validLines(content) {
    return lines(content).filter(function (l) { return l.found; });
  }

  /* ---------- badges ---------- */

  function updateBadges() {
    var n = items.length;
    var title = (R.getSite().quoteListTitle || "Mi cotización");
    R.qsa("[data-qlist-badge]").forEach(function (b) {
      b.textContent = String(n);
      b.hidden = n === 0;
    });
    R.qsa("[data-qlist-count]").forEach(function (b) { b.textContent = n ? "(" + n + ")" : ""; });
    R.qsa("[data-qlist-open]").forEach(function (b) {
      if (b.classList.contains("qitems-edit")) return;
      b.setAttribute("aria-label", title + (n ? ", " + n + (n === 1 ? " producto" : " productos") : ""));
    });
  }

  /* ---------- drawer markup ---------- */

  function build() {
    drawer = el("aside", "qlist");
    drawer.id = "qlist";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-labelledby", "qlist-title");
    drawer.tabIndex = -1;

    var head = el("div", "qlist-head");
    var title = el("h2", "", "Mi cotización");
    title.id = "qlist-title";
    title.tabIndex = -1;
    title.setAttribute("data-text", "site.quoteListTitle");
    var close = el("button", "qlist-close", "Cerrar");
    close.type = "button";
    close.setAttribute("data-qlist-close", "");
    head.appendChild(title);
    head.appendChild(close);
    drawer.appendChild(head);

    var scroll = el("div", "qlist-scroll");
    parts.sub = el("p", "qlist-sub");
    parts.intro = el("p", "qlist-intro");
    parts.empty = el("div", "qlist-empty");
    parts.empty.hidden = true;
    parts.empty.appendChild(el("strong", "", "Tu cotización está vacía."));
    parts.empty.appendChild(el("p", "", "Agrega productos desde el catálogo y envíanos la lista en un solo paso."));
    var go = el("a", "btn btn-wine", "Ver catálogo");
    go.setAttribute("data-qlist-go", "");
    go.href = R.link("catalogo");
    parts.empty.appendChild(go);
    parts.list = el("ul", "qlines");
    parts.summary = el("div", "qsummary");
    parts.storage = el("p", "qlist-storage", "Tu navegador no guarda la lista entre visitas.");
    parts.storage.hidden = true;
    parts.formWrap = el("div", "qlist-form");
    parts.clear = el("div", "qlist-clear");
    parts.success = el("div", "qlist-success");
    parts.success.tabIndex = -1;
    parts.success.hidden = true;
    [parts.sub, parts.intro, parts.empty, parts.list, parts.summary, parts.storage, parts.formWrap, parts.clear, parts.success]
      .forEach(function (n) { scroll.appendChild(n); });
    drawer.appendChild(scroll);

    backdrop = el("div", "qlist-backdrop");
    backdrop.setAttribute("data-qlist-close", "");
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // The form is mounted once; line changes never rebuild it (typed text survives).
    if (QF) {
      formCtl = QF.mount(parts.formWrap, {
        mode: "drawer", withItems: true, idPrefix: "ql-",
        onSuccess: function () { showSuccess(); }
      });
      R.refreshBranchSelectors();
    }
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function lineNode(l) {
    var li = el("li", "qline" + (l.found ? "" : " is-stale"));
    li.setAttribute("data-key", l.key);
    var img = el("span", "ql-img");
    img.appendChild(R.makeImg(l.image, "product", l.found ? l.name : "", { w: 120, h: 120, size: 200 }));
    li.appendChild(img);
    var main = el("div", "ql-main");
    var name;
    if (l.found) {
      name = el("a", "ql-name", l.name);
      name.href = R.productLink(l.product);
      name.setAttribute("data-qlist-go", "");
    } else {
      name = el("span", "ql-name", l.name);
    }
    main.appendChild(name);
    var meta = [l.brand, l.variantName, l.sku ? "SKU " + l.sku : ""].filter(Boolean).join(" · ");
    if (meta) main.appendChild(el("p", "ql-meta", meta));
    if (!l.found) {
      main.appendChild(el("p", "ql-stale", "Ya no está disponible"));
    } else if (l.price != null) {
      main.appendChild(el("p", "ql-price", money(l.price) + (l.unit ? " / " + l.unit : "")));
    } else {
      main.appendChild(el("p", "ql-price is-quote", "Precio a cotizar"));
    }
    li.appendChild(main);

    var ctl = el("div", "ql-ctl");
    if (l.found) {
      var step = el("div", "stepper");
      step.setAttribute("role", "group");
      step.setAttribute("aria-label", "Cantidad de " + l.name);
      var minus = el("button", "step-btn", "−");
      minus.type = "button";
      minus.setAttribute("data-act", "minus");
      minus.setAttribute("aria-label", "Quitar uno");
      minus.disabled = l.qty <= 1;
      var qty = document.createElement("input");
      qty.type = "text";
      qty.inputMode = "numeric";
      qty.className = "step-input";
      qty.value = String(l.qty);
      qty.setAttribute("aria-label", "Cantidad");
      qty.setAttribute("data-act", "qty");
      var plus = el("button", "step-btn", "+");
      plus.type = "button";
      plus.setAttribute("data-act", "plus");
      plus.setAttribute("aria-label", "Agregar uno");
      step.appendChild(minus);
      step.appendChild(qty);
      step.appendChild(plus);
      ctl.appendChild(step);
    }
    var rm = el("button", "ql-remove", "Quitar");
    rm.type = "button";
    rm.setAttribute("data-act", "remove");
    rm.setAttribute("aria-label", "Quitar " + l.name + (l.variantName ? " · " + l.variantName : ""));
    ctl.appendChild(rm);
    li.appendChild(ctl);
    return li;
  }

  function renderSummary(ls) {
    clear(parts.summary);
    var priced = ls.filter(function (l) { return l.found && l.price != null; });
    var unpriced = ls.filter(function (l) { return l.found && l.price == null; });
    var site = R.getSite();
    if (priced.length) {
      var total = 0;
      priced.forEach(function (l) { total += l.price * l.qty; });
      var line = "Subtotal estimado: " + money(total);
      if (unpriced.length) line += " · " + plural(unpriced.length, "producto", "productos") + " a cotizar";
      parts.summary.appendChild(el("p", "qs-total", line));
      if (site.priceNote) parts.summary.appendChild(el("p", "qs-note", site.priceNote));
    } else if (ls.some(function (l) { return l.found; }) && site.priceToQuoteNote) {
      parts.summary.appendChild(el("p", "qs-note", site.priceToQuoteNote));
    }
  }

  function renderClear(n) {
    clear(parts.clear);
    parts.clear.hidden = n === 0;
    if (!n) { confirming = false; return; }
    if (!confirming) {
      var b = el("button", "linklike", "Vaciar lista");
      b.type = "button";
      b.setAttribute("data-act", "clear");
      parts.clear.appendChild(b);
      return;
    }
    var box = el("div", "qconfirm");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Confirmar");
    box.appendChild(el("p", "", "¿Vaciar tu cotización? Se quitarán " + plural(n, "producto", "productos") + "."));
    var yes = el("button", "btn btn-outline", "Vaciar");
    yes.type = "button";
    yes.setAttribute("data-act", "clear-yes");
    var no = el("button", "btn btn-wine", "Conservar");
    no.type = "button";
    no.setAttribute("data-act", "clear-no");
    box.appendChild(yes);
    box.appendChild(no);
    parts.clear.appendChild(box);
    no.focus();
  }

  function renderBody() {
    var site = R.getSite();
    var hadFocusIn = parts.list.contains(document.activeElement);
    var focusKey = hadFocusIn && document.activeElement.closest("li") ? document.activeElement.closest("li").getAttribute("data-key") : "";
    var focusAct = hadFocusIn ? document.activeElement.getAttribute("data-act") : "";
    var n = items.length;

    parts.success.hidden = !sent;
    if (sent) {
      parts.sub.hidden = parts.intro.hidden = parts.empty.hidden = parts.list.hidden = parts.summary.hidden = true;
      parts.formWrap.hidden = parts.clear.hidden = parts.storage.hidden = true;
      return;
    }
    parts.sub.hidden = false;
    parts.list.hidden = parts.summary.hidden = false;
    parts.sub.textContent = n
      ? plural(n, "producto", "productos") + " · " + (n === 1 ? "se cotiza" : "se cotizan") + " sin compromiso"
      : "";
    parts.sub.hidden = !n;
    parts.intro.textContent = site.quoteListIntro || "";
    parts.intro.hidden = !site.quoteListIntro || n === 0;
    parts.empty.hidden = n !== 0;
    parts.formWrap.hidden = n === 0;
    parts.storage.hidden = !memoryOnly || n === 0;

    clear(parts.list);
    if (n && !R.hasContent()) {
      parts.list.appendChild(el("li", "qline-loading", "Cargando tu lista…"));
      parts.summary.hidden = true;
    } else {
      var ls = lines();
      ls.forEach(function (l) { parts.list.appendChild(lineNode(l)); });
      renderSummary(ls);
      // Keep the keyboard where it was after a +/- re-render.
      if (focusKey && focusAct) {
        var again = parts.list.querySelector('li[data-key="' + focusKey + '"] [data-act="' + focusAct + '"]');
        if (again && !again.disabled) again.focus();
        else {
          var fallback = parts.list.querySelector("li [data-act]");
          (fallback || parts.empty.querySelector("a") || drawer.querySelector("#qlist-title")).focus();
        }
      } else if (hadFocusIn) {
        drawer.querySelector("#qlist-title").focus();
      }
    }
    renderClear(n);
  }

  function showSuccess() {
    sent = true;
    clear(parts.success);
    parts.success.appendChild(el("p", "qs-ok", R.getSite().quoteListSuccess || "¡Listo! Recibimos tu lista. Te respondemos en horario de atención."));
    renderBody();
    parts.success.focus();
  }

  /* ---------- open / close / history ---------- */

  function isOpen() { return !!drawer && drawer.classList.contains("is-open"); }

  function show(opener) {
    if (!drawer || isOpen()) return;
    lastFocus = opener || document.activeElement;
    if (items.length) sent = false;
    renderBody();
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.documentElement.classList.add("no-scroll", "ql-open");
    if (formCtl) { R.refreshBranchSelectors(); formCtl.update(); }
    var target = !items.length ? parts.empty.querySelector("a") : drawer.querySelector("#qlist-title");
    (sent ? parts.success : target).focus({ preventScroll: true });
  }

  function hide() {
    if (!isOpen()) return;
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.documentElement.classList.remove("no-scroll", "ql-open");
    var back = lastFocus && lastFocus.isConnected ? lastFocus : document.querySelector("[data-qlist-open]");
    lastFocus = null;
    if (back && typeof back.focus === "function") back.focus({ preventScroll: true });
  }

  function runPending() {
    var fn = pendingThen;
    pendingThen = null;
    if (fn) fn();
  }

  function open(opener) {
    if (!drawer || isOpen()) return;
    try {
      window.history.pushState({ qlist: true }, "", window.location.pathname + window.location.search + "#lista");
    } catch (e) { /* ignore */ }
    show(opener);
  }

  // opts.then runs once the drawer is gone (used to navigate after closing without leaving a stale entry).
  function close(opts) {
    if (opts && typeof opts.then === "function") pendingThen = opts.then;
    if (!isOpen()) { runPending(); return; }
    if (window.history.state && window.history.state.qlist === true) {
      window.history.back(); // popstate hides the drawer
      window.setTimeout(function () { // safety net if the browser never fires popstate
        if (isOpen()) { hide(); runPending(); }
      }, 700);
      return;
    }
    try {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    } catch (e) { /* ignore */ }
    hide();
    runPending();
  }

  window.addEventListener("popstate", function () {
    var want = window.location.hash === "#lista" && !!window.history.state && window.history.state.qlist === true;
    if (want && !isOpen()) show(null);
    else if (!want && isOpen()) { hide(); runPending(); }
  });

  // Page opened directly on #lista (shared link, reload, bookmark): open without touching history.
  function openFromHash() {
    if (window.location.hash === "#lista" && !isOpen()) show(null);
  }

  /* ---------- events ---------- */

  function onDrawerClick(e) {
    var t = e.target;
    if (t.closest("[data-qlist-close]")) { close(); return; }
    var go = t.closest("a[data-qlist-go]");
    if (go && !e.defaultPrevented) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      // Same-page navigations are handled by the catalog router; anything else is a normal
      // link that simply unloads the page.
      return;
    }
    var act = t.closest("[data-act]");
    if (!act || !drawer.contains(act)) return;
    var li = act.closest("li.qline");
    var key = li ? li.getAttribute("data-key") : "";
    var parts2 = key.split("|");
    var line = key ? find(parts2[0], parts2[1]) : null;
    switch (act.getAttribute("data-act")) {
      case "plus": if (line) setQty(line.p, line.v, line.q + 1); break;
      case "minus": if (line && line.q > 1) setQty(line.p, line.v, line.q - 1); break;
      case "remove": if (line) { remove(line.p, line.v); R.announce("Quitado de tu cotización"); } break;
      case "clear": confirming = true; renderClear(items.length); break;
      case "clear-no": confirming = false; renderClear(items.length); parts.clear.querySelector("button").focus(); break;
      case "clear-yes":
        confirming = false;
        clearAll();
        R.announce("Lista vacía");
        break;
      default: break;
    }
  }

  var applyingQty = false;

  function onDrawerChange(e) {
    var inp = e.target.closest('input[data-act="qty"]');
    if (!inp) return;
    var li = inp.closest("li.qline");
    if (!li) return;
    // Removing a focused input during the re-render makes the browser fire a second native
    // "change" on blur; handling it re-entrantly would re-render mid-removal and throw.
    if (applyingQty) return;
    applyingQty = true;
    try {
      var p = li.getAttribute("data-key").split("|");
      setQty(p[0], p[1], inp.value);
    } finally {
      applyingQty = false;
    }
  }

  function onDrawerKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Enter" && e.target.matches('input[data-act="qty"]')) { e.preventDefault(); e.target.blur(); return; }
    if (e.key !== "Tab") return;
    var nodes = R.qsa(FOCUSABLE, drawer).filter(function (n) { return n.offsetParent !== null; });
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function init() {
    probeStorage();
    items = read();
    build();
    drawer.addEventListener("click", onDrawerClick);
    drawer.addEventListener("change", onDrawerChange);
    drawer.addEventListener("keydown", onDrawerKeydown);
    backdrop.addEventListener("click", function () { close(); });
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-qlist-open]");
      if (!t || e.defaultPrevented) return;
      e.preventDefault();
      open(t);
    });
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY && e.key !== null) return;
      items = read();
      changed();
    });
    document.addEventListener("baristop:rendered", function () {
      updateBadges();
      if (drawer) {
        renderBody();
        if (formCtl) formCtl.update();
      }
    });
    updateBadges();
  }

  window.BaristopQuoteList = {
    get: function () { return items.map(function (it) { return { p: it.p, v: it.v, q: it.q }; }); },
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clearAll,
    count: function () { return items.length; },
    lines: lines,
    validLines: validLines,
    open: open,
    close: close,
    isOpen: isOpen,
    openFromHash: openFromHash
  };

  init();
  // Home page: open on #lista once the first content layer is rendered (the shell calls openFromHash itself).
  if (!document.getElementById("view")) {
    document.addEventListener("baristop:rendered", function once() {
      document.removeEventListener("baristop:rendered", once);
      openFromHash();
    });
  }
})();
