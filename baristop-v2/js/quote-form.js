/*
 * Baristop v2 — quote form component (spec 14.4, 15.1, 15.5).
 *
 * The round-1 form lives in two places: the static #quote-form on the home page and a
 * second copy built here inside the quote-list drawer. mount(root, opts) wires behaviour
 * onto an existing form.qform (home) or builds one first (drawer). Fields are found by
 * name / class, never by id, so both copies work side by side.
 *
 *   BaristopQuoteForm.mount(root, { withItems, mode: "home" | "drawer", idPrefix, onSuccess })
 *   BaristopQuoteForm.wireRadioGroup(container, onPick)   // roving tabindex + arrow keys
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var C = window.BaristopContent;
  var R = window.BaristopRender;

  var LIST_NEED = "Lista de productos";

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- radio group keyboard (branch selector, variant chips) ---------- */

  function wireRadioGroup(group, onPick) {
    group.addEventListener("click", function (e) {
      var btn = e.target.closest('[role="radio"]');
      if (btn && group.contains(btn)) onPick(btn);
    });
    group.addEventListener("keydown", function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: "first", End: "last" };
      if (!(e.key in keys)) return;
      var btns = $all('[role="radio"]', group);
      if (!btns.length) return;
      var idx = btns.indexOf(document.activeElement);
      if (idx < 0) idx = 0;
      var step = keys[e.key];
      var next = step === "first" ? 0 : step === "last" ? btns.length - 1 : (idx + step + btns.length) % btns.length;
      e.preventDefault();
      onPick(btns[next]);
      btns[next].focus();
    });
  }

  /* ---------- markup for the drawer copy ---------- */

  function field(prefix, id, label, control) {
    var f = R.el("div", "field");
    var l = R.el("label", "", label);
    l.setAttribute("for", prefix + id);
    f.appendChild(l);
    control.id = prefix + id;
    f.appendChild(control);
    return f;
  }
  function input(name, ph, max, auto) {
    var i = document.createElement("input");
    i.type = "text";
    i.name = name;
    i.placeholder = ph;
    i.maxLength = max;
    i.autocomplete = auto;
    return i;
  }

  function build(prefix) {
    var form = R.el("form", "qform");
    form.noValidate = true;
    var seg = R.el("div", "field");
    var lab = R.el("span", "flabel", "¿Con qué sucursal quieres cotizar?");
    lab.id = prefix + "branch-label";
    seg.appendChild(lab);
    var group = R.el("div", "seg");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", lab.id);
    group.setAttribute("data-list", "quoteBranches");
    seg.appendChild(group);
    form.appendChild(seg);
    form.appendChild(R.el("p", "form-hint", "Solo necesitamos tu nombre y un teléfono o correo para responderte."));
    var name = input("nombre", "Tu nombre", 80, "name");
    name.required = true;
    form.appendChild(field(prefix, "name", "Nombre", name));
    form.appendChild(field(prefix, "biz", "Negocio (opcional)", input("negocio", "Tu cafetería o restaurante", 120, "organization")));
    var contact = input("contacto", "Para responderte", 120, "off");
    contact.required = true;
    form.appendChild(field(prefix, "contact", "Teléfono o correo", contact));
    var msg = document.createElement("textarea");
    msg.name = "mensaje";
    msg.rows = 3;
    msg.maxLength = 2000;
    msg.placeholder = "Cuéntanos qué preparas y qué necesitas";
    form.appendChild(field(prefix, "msg", "Mensaje (opcional)", msg));
    var hp = R.el("div", "hp");
    hp.setAttribute("aria-hidden", "true");
    var hl = R.el("label", "", "Sitio web");
    var hi = input("sitio_web", "", 200, "off");
    hi.tabIndex = -1;
    hl.appendChild(hi);
    hp.appendChild(hl);
    form.appendChild(hp);
    var actions = R.el("div", "form-actions");
    var send = R.el("button", "btn btn-gold send-btn", "Enviar mi cotización");
    send.type = "submit";
    actions.appendChild(send);
    var wa = R.el("a", "wa-fallback", "o envíala por WhatsApp");
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.hidden = true;
    actions.appendChild(wa);
    actions.appendChild(R.el("p", "demo-note", "Vista previa: cuando el sitio esté publicado, tus clientes enviarán su solicitud por correo desde aquí."));
    form.appendChild(actions);
    var status = R.el("p", "form-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);
    return form;
  }

  /* ---------- mount ---------- */

  function mount(root, opts) {
    opts = opts || {};
    var drawerMode = opts.mode === "drawer";
    var form = root.querySelector("form.qform");
    if (!form) { form = build(opts.idPrefix || "q-"); root.appendChild(form); }

    var f = form.elements;
    var needSel = f.busca || null;
    var sendBtn = form.querySelector(".send-btn");
    var waBtn = form.querySelector(".wa-fallback");
    var demoNote = form.querySelector(".demo-note");
    var statusEl = form.querySelector(".form-status");
    var seg = form.querySelector('[data-list="quoteBranches"]');
    var success = root.querySelector(".form-success");
    var openedAt = Date.now();
    var busy = false;

    // Line items (spec 14.4). The drawer always sends its list; the home form offers a checkbox.
    var items = null;       // { box, check, text, list }
    var includeList = true; // checkbox state
    var forcedNeed = null;  // previous select value while "Lista de productos" is forced

    function val(n) { return n ? String(n.value || "").trim() : ""; }
    function QL() { return window.BaristopQuoteList || null; }
    function lines() { var q = QL(); return q ? q.validLines() : []; }
    function sending() {
      if (drawerMode) return lines();
      return items && items.check.checked && !items.box.hidden ? lines() : [];
    }

    /* line-items block (home form) */
    function buildItems() {
      var box = R.el("div", "qitems");
      box.hidden = true;
      var label = R.el("label", "qitems-check");
      var check = document.createElement("input");
      check.type = "checkbox";
      check.checked = true;
      label.appendChild(check);
      var text = R.el("span", "qitems-text", "");
      label.appendChild(text);
      box.appendChild(label);
      var ul = R.el("ul", "qitems-list");
      box.appendChild(ul);
      var edit = R.el("button", "linklike qitems-edit", "Editar lista");
      edit.type = "button";
      edit.setAttribute("data-qlist-open", "");
      box.appendChild(edit);
      var anchor = f.mensaje ? f.mensaje.closest(".field") : null;
      if (anchor) anchor.parentNode.insertBefore(box, anchor); else form.insertBefore(box, form.firstChild);
      check.addEventListener("change", function () {
        includeList = check.checked;
        syncNeed();
        updateWhatsApp();
      });
      return { box: box, check: check, text: text, list: ul };
    }

    function lineText(l) {
      return l.qty + " × " + l.name + (l.variantName ? " · " + l.variantName : "");
    }

    function syncNeed() {
      if (!needSel || !items) return;
      var active = !items.box.hidden && items.check.checked;
      if (active) {
        if (forcedNeed === null && needSel.value !== LIST_NEED) forcedNeed = needSel.value;
        needSel.value = LIST_NEED;
      } else if (forcedNeed !== null) {
        needSel.value = forcedNeed;
        forcedNeed = null;
      }
    }

    function refreshItems() {
      if (!items) return;
      var ls = lines();
      items.box.hidden = ls.length === 0;
      if (!ls.length) { syncNeed(); return; }
      items.text.textContent = "Incluye mi cotización (" + ls.length + (ls.length === 1 ? " producto)" : " productos)");
      R.clear(items.list);
      ls.forEach(function (l) { items.list.appendChild(R.el("li", "", lineText(l))); });
      items.check.checked = includeList;
      syncNeed();
    }

    /* WhatsApp text */
    function composeText() {
      var b = R.getSelectedBranch();
      var name = val(f.nombre), biz = val(f.negocio), msg = val(f.mensaje), contact = val(f.contacto);
      var head = "Hola Baristop" + (b ? " " + b.name : "") + ", soy " + (name || "(nombre)") + (biz ? " de " + biz : "");
      var ls = sending();
      if (!ls.length) {
        var need = needSel ? needSel.value : "";
        return head + ". Busco: " + need + "." + (msg ? " " + msg : "") + (contact ? " Contacto: " + contact : "");
      }
      var tail = (msg ? msg.replace(/[.\s]+$/, "") + ". " : "") + (contact ? "Contacto: " + contact : "");
      return head + ". Quiero cotizar:\n" + ls.map(function (l) { return "- " + lineText(l); }).join("\n") + (tail ? "\n" + tail : "");
    }

    function updateWhatsApp() {
      if (!waBtn || !R.hasContent()) return; // keep the inline default link until content is rendered
      var b = R.getSelectedBranch();
      var number = b ? b.whatsapp : R.getSite().franchiseWhatsapp;
      var href = R.waLink(number, composeText());
      if (href) { waBtn.href = href; waBtn.hidden = false; } else { waBtn.hidden = true; }
    }

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text || "";
      statusEl.classList.toggle("is-error", !!isError);
    }
    function markInvalid(node, on) {
      if (!node) return;
      if (on) node.setAttribute("aria-invalid", "true"); else node.removeAttribute("aria-invalid");
    }
    function looksLikeContact(v) {
      return S.isEmail(v) || S.normalizeDigits(v).length >= 10;
    }

    function validate() {
      markInvalid(f.nombre, false);
      markInvalid(f.contacto, false);
      if (!R.getSelectedBranch()) return { field: null, message: "Elige una sucursal para enviar tu solicitud." };
      var n = val(f.nombre);
      if (n.length < 2 || n.length > 80) { markInvalid(f.nombre, true); return { field: f.nombre, message: "Escribe tu nombre (entre 2 y 80 caracteres)." }; }
      var c = val(f.contacto);
      if (c.length < 5 || c.length > 120 || !looksLikeContact(c)) {
        markInvalid(f.contacto, true);
        return { field: f.contacto, message: "Escribe un teléfono de 10 dígitos o un correo válido para responderte." };
      }
      return null;
    }

    function syncFormMode() {
      var noBranch = R.hasContent() && !R.getSelectedBranch();
      if (sendBtn) {
        sendBtn.hidden = C.isDemo;
        sendBtn.disabled = noBranch || busy;
      }
      if (demoNote) demoNote.hidden = !C.isDemo;
      // In preview there is no submit button, so WhatsApp becomes the primary action.
      if (waBtn) {
        waBtn.classList.toggle("btn", !!C.isDemo);
        waBtn.classList.toggle("btn-ghost", !!C.isDemo);
        waBtn.textContent = C.isDemo ? "Pedir cotización por WhatsApp" : (drawerMode ? "o envíala por WhatsApp" : "o pídela por WhatsApp");
      }
    }

    form.addEventListener("input", updateWhatsApp);
    form.addEventListener("change", updateWhatsApp);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (C.isDemo || busy) return;
      var problem = validate();
      if (problem) {
        setStatus(problem.message, true);
        if (problem.field) problem.field.focus();
        return;
      }
      var b = R.getSelectedBranch();
      var ts = openedAt;
      if (Date.now() - ts > 23 * 3600 * 1000) ts = Date.now() - 5000; // keep inside the server's 24 h window
      var ls = sending();
      var payload = {
        branchId: b.id,
        name: val(f.nombre),
        business: val(f.negocio),
        contact: val(f.contacto),
        need: ls.length && drawerMode ? LIST_NEED : (needSel ? needSel.value : ""),
        message: val(f.mensaje),
        website: f.sitio_web ? f.sitio_web.value : "",
        ts: ts
      };
      if (ls.length) {
        payload.items = ls.map(function (l) { return { productId: l.productId, variantId: l.variantId, qty: l.qty }; });
      }
      setStatus("", false);
      busy = true;
      sendBtn.disabled = true;
      var label = sendBtn.textContent;
      sendBtn.textContent = "Enviando…";
      form.setAttribute("aria-busy", "true");
      C.submitQuote(payload).then(function (res) {
        busy = false;
        form.removeAttribute("aria-busy");
        sendBtn.textContent = label;
        sendBtn.disabled = false;
        if (res.ok) {
          if (ls.length && QL()) QL().clear();
          if (typeof opts.onSuccess === "function") {
            opts.onSuccess();
          } else {
            form.hidden = true;
            if (success) { success.hidden = false; success.focus(); }
          }
        } else {
          setStatus(res.message, true);
        }
      });
    });

    if (seg) {
      wireRadioGroup(seg, function (btn) { R.setSelectedBranch(btn.getAttribute("data-branch-id")); });
    }

    if (opts.withItems && !drawerMode) items = buildItems();

    document.addEventListener("baristop:branch", updateWhatsApp);
    document.addEventListener("baristop:list", function () { refreshItems(); updateWhatsApp(); });
    document.addEventListener("baristop:rendered", function () { refreshItems(); updateWhatsApp(); syncFormMode(); });

    syncFormMode();
    refreshItems();
    updateWhatsApp();

    return {
      form: form,
      update: function () { refreshItems(); updateWhatsApp(); syncFormMode(); },
      // CTA links that preset the form (data-need / data-message).
      preset: function (need, message) {
        if (needSel && need) {
          for (var i = 0; i < needSel.options.length; i++) {
            if (needSel.options[i].text === need) needSel.selectedIndex = i;
          }
          forcedNeed = null;
          if (items) { includeList = false; items.check.checked = false; }
        }
        if (message && f.mensaje) {
          var box = f.mensaje;
          if (!box.value.trim() || box.value === box.getAttribute("data-prefilled")) box.value = message;
          else if (box.value.indexOf(message) === -1) box.value = box.value + "\n" + message;
          box.setAttribute("data-prefilled", box.value);
        }
        updateWhatsApp();
      },
      reset: function () {
        form.reset();
        form.hidden = false;
        setStatus("", false);
      }
    };
  }

  window.BaristopQuoteForm = { mount: mount, wireRadioGroup: wireRadioGroup, LIST_NEED: LIST_NEED };
})();
