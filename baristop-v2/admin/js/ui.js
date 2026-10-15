/* Baristop admin — small DOM and UI helpers (vanilla, no dependencies).
 * Everything that carries data is built with createElement / textContent. */
(function () {
  "use strict";

  var uidCounter = 0;

  function uid(prefix) {
    uidCounter += 1;
    return (prefix || "id") + "-" + uidCounter;
  }

  /* el("div", { cls: "x", text: "hi", attrs: { role: "alert" }, props: { disabled: true },
   *             on: { click: fn } }, [child, "text", ...]) */
  function el(tag, opts, children) {
    var node = document.createElement(tag);
    opts = opts || {};
    if (opts.cls) node.className = opts.cls;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (k) {
        if (opts.attrs[k] != null && opts.attrs[k] !== false) node.setAttribute(k, opts.attrs[k] === true ? "" : opts.attrs[k]);
      });
    }
    if (opts.props) {
      Object.keys(opts.props).forEach(function (k) { node[k] = opts.props[k]; });
    }
    if (opts.on) {
      Object.keys(opts.on).forEach(function (k) { node.addEventListener(k, opts.on[k]); });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children == null) return node;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { append(node, c); return; }
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ---------- safe storage ---------- */
  function store(kind) {
    return {
      get: function (k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, v); return true; } catch (e) { return false; } },
      remove: function (k) { try { window[kind].removeItem(k); } catch (e) { /* ignore */ } }
    };
  }
  var ls = store("localStorage");
  var ss = store("sessionStorage");

  /* ---------- formatting ---------- */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function timeHm(d) { d = d || new Date(); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function formatKb(bytes) {
    var kb = bytes / 1024;
    return (kb >= 100 ? Math.round(kb) : Math.round(kb * 10) / 10) + " KB";
  }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  /* ---------- modal (div-based, works on every browser) ---------- */
  var modalStack = [];

  function focusables(root) {
    var list = root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }

  /* opts: { title, body (Node), actions: [{label, kind, onClick(close) -> may return false to keep open}],
   *         onClose, wide, role } */
  function modal(opts) {
    var previous = document.activeElement;
    var titleId = uid("modal-title");
    var backdrop = el("div", { cls: "modal-backdrop" });
    var dialog = el("div", {
      cls: "modal" + (opts.wide ? " modal-wide" : ""),
      attrs: { role: opts.role || "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabindex: "-1" }
    });
    var head = el("div", { cls: "modal-head" }, [
      el("h2", { cls: "modal-title", text: opts.title, attrs: { id: titleId } })
    ]);
    var closeBtn = el("button", { cls: "icon-btn", text: "×", attrs: { type: "button", "aria-label": "Cerrar" } });
    head.appendChild(closeBtn);
    var bodyWrap = el("div", { cls: "modal-body" }, opts.body);
    var foot = el("div", { cls: "modal-foot" });
    var closed = false;
    var buttons = [];

    function close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey, true);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      modalStack.pop();
      if (!modalStack.length) document.documentElement.classList.remove("modal-open");
      if (previous && previous.focus && document.contains(previous)) previous.focus();
      if (opts.onClose) opts.onClose(result);
    }

    (opts.actions || []).forEach(function (a) {
      var b = el("button", {
        cls: "btn " + (a.kind === "primary" ? "btn-primary" : a.kind === "danger" ? "btn-danger" : "btn-secondary"),
        text: a.label,
        attrs: { type: "button" }
      });
      b.addEventListener("click", function () {
        var r = a.onClick ? a.onClick(close, b) : undefined;
        if (r !== false) close(a.value);
      });
      buttons.push(b);
      foot.appendChild(b);
    });

    closeBtn.addEventListener("click", function () { close(undefined); });
    backdrop.addEventListener("mousedown", function (e) { if (e.target === backdrop) close(undefined); });

    function onKey(e) {
      if (modalStack[modalStack.length - 1] !== api) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        close(undefined);
      } else if (e.key === "Tab") {
        var items = focusables(dialog);
        if (!items.length) { e.preventDefault(); return; }
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }

    dialog.appendChild(head);
    dialog.appendChild(bodyWrap);
    if (buttons.length) dialog.appendChild(foot);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add("modal-open");
    var api = { close: close, root: dialog, body: bodyWrap, buttons: buttons };
    modalStack.push(api);
    document.addEventListener("keydown", onKey, true);

    var firstField = bodyWrap.querySelector("input:not([type=hidden]):not([type=file]), textarea, select");
    (opts.focusFirst === false ? dialog : (firstField || buttons[buttons.length - 1] || dialog)).focus();
    return api;
  }

  /* confirm(message, {title, confirmLabel, cancelLabel, danger}) -> Promise<boolean> */
  function confirm(message, o) {
    o = o || {};
    return new Promise(function (resolve) {
      var answered = false;
      function done(v) { if (!answered) { answered = true; resolve(v); } }
      modal({
        title: o.title || "Confirmar",
        role: "alertdialog",
        body: el("p", { cls: "confirm-text", text: message }),
        focusFirst: false,
        actions: [
          { label: o.cancelLabel || "Cancelar", kind: "secondary", onClick: function () { done(false); } },
          { label: o.confirmLabel || "Aceptar", kind: o.danger ? "danger" : "primary", onClick: function () { done(true); } }
        ],
        onClose: function () { done(false); }
      });
    });
  }

  window.AdminUI = {
    el: el, append: append, clear: clear, uid: uid, ls: ls, ss: ss,
    timeHm: timeHm, formatKb: formatKb, clone: clone,
    modal: modal, confirm: confirm
  };
})();
