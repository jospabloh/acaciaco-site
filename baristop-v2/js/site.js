/*
 * Baristop v2 — boot and interactions (spec §1.1, §1.2, §1.7, §1.12).
 * Hamburger nav, reveal-on-scroll, catalogue dialog, quote form with branch
 * selector and WhatsApp fallback, announcement dismiss.
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var C = window.BaristopContent;
  var R = window.BaristopRender;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ---------- condensing nav + hamburger ---------- */

  var nav = $("header.nav");
  var toggle = $(".nav-toggle");
  var menu = $("#nav-menu");

  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open, returnFocus) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    menu.classList.toggle("is-open", open);
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
    if (!open && returnFocus) toggle.focus();
  }
  function menuIsOpen() { return toggle && toggle.getAttribute("aria-expanded") === "true"; }

  if (toggle && menu) {
    toggle.addEventListener("click", function () { setMenu(!menuIsOpen()); });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (menuIsOpen() && !e.target.closest("header.nav")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuIsOpen()) setMenu(false, true);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 820 && menuIsOpen()) setMenu(false);
    });
  }

  /* ---------- reveal on scroll ---------- */

  var revealTargets = $all(".reveal, .reveal-group");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach(function (n) { io.observe(n); });
  } else {
    revealTargets.forEach(function (n) { n.classList.add("in"); });
  }

  /* ---------- announcement bar ---------- */

  var bar = $("#anuncios");
  if (bar) {
    $(".announce-close", bar).addEventListener("click", function () {
      var id = bar.getAttribute("data-id") || "";
      try { window.sessionStorage.setItem(R ? R.dismissKey : "baristop-v2:announcement-dismissed", id); } catch (e) { /* ignore */ }
      bar.hidden = true;
    });
  }

  if (!C || !R || !S) return; // scripts failed to load: static copy still works

  /* ---------- catalogue dialog ---------- */

  var dlg = $("#cat-dialog");
  var backdrop = $("#dlg-backdrop");
  var nativeDialog = !!dlg && typeof dlg.showModal === "function";
  var lastTrigger = null;
  var openCatId = "";
  var skipFocusReturn = false;

  function dialogIsOpen() { return !!openCatId; }

  function clearHash() {
    if (/^#maquinaria-/.test(window.location.hash)) {
      try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
    }
  }

  function openCategory(id, trigger) {
    if (!dlg || !R.renderCategoryDialog(id)) return;
    lastTrigger = trigger || lastTrigger;
    openCatId = id;
    if (nativeDialog) {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute("open", "");
      dlg.setAttribute("role", "dialog");
      dlg.setAttribute("aria-modal", "true");
      dlg.classList.add("is-fallback");
      if (backdrop) backdrop.hidden = false;
    }
    document.documentElement.classList.add("no-scroll");
    var body = $("#cat-dialog-body");
    if (body) body.scrollTop = 0;
    var close = $("[data-dialog-close]", dlg);
    if (close) close.focus();
    try { window.history.replaceState(null, "", "#maquinaria-" + id); } catch (e) { /* ignore */ }
  }

  function afterClose() {
    var wasOpen = dialogIsOpen();
    openCatId = "";
    document.documentElement.classList.remove("no-scroll");
    if (backdrop) backdrop.hidden = true;
    clearHash();
    if (wasOpen && !skipFocusReturn && lastTrigger) {
      var again = lastTrigger.isConnected ? lastTrigger : $('.mcard[data-cat-id="' + lastTrigger.getAttribute("data-cat-id") + '"]');
      if (again) again.focus();
    }
    skipFocusReturn = false;
  }

  function closeDialog(opts) {
    if (!dlg || !dialogIsOpen()) return;
    skipFocusReturn = !!(opts && opts.skipFocus);
    if (nativeDialog) {
      if (dlg.open) dlg.close(); // fires "close" -> afterClose
      else afterClose();
    } else {
      dlg.removeAttribute("open");
      dlg.classList.remove("is-fallback");
      afterClose();
    }
  }

  if (dlg) {
    if (nativeDialog) {
      dlg.addEventListener("close", afterClose);
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) closeDialog(); // click on the backdrop
      });
    } else if (backdrop) {
      backdrop.addEventListener("click", function () { closeDialog(); });
    }
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !nativeDialog) { e.preventDefault(); closeDialog(); return; }
      if (e.key !== "Tab") return;
      var items = $all(FOCUSABLE, dlg).filter(function (n) { return n.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $all("[data-dialog-close]", dlg).forEach(function (b) {
      b.addEventListener("click", function () { closeDialog(); });
    });
  }

  document.addEventListener("click", function (e) {
    var card = e.target.closest(".mcard");
    if (card) openCategory(card.getAttribute("data-cat-id"), card);
  });

  function openFromHash() {
    var m = /^#maquinaria-([a-z0-9-]+)$/.exec(window.location.hash);
    if (m) openCategory(m[1], null);
  }
  window.addEventListener("hashchange", function () {
    var m = /^#maquinaria-([a-z0-9-]+)$/.exec(window.location.hash);
    if (m && m[1] !== openCatId) openCategory(m[1], null);
  });

  /* ---------- CTA links that preset the form ---------- */

  var needSel = $("#f-need");
  var msgBox = $("#f-msg");
  var prefilled = "";

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-need]");
    if (!a) return;
    var need = a.getAttribute("data-need");
    if (needSel) {
      for (var i = 0; i < needSel.options.length; i++) {
        if (needSel.options[i].text === need) needSel.selectedIndex = i;
      }
    }
    var msg = a.getAttribute("data-message");
    if (msg && msgBox) {
      if (!msgBox.value.trim() || msgBox.value === prefilled) msgBox.value = msg;
      else if (msgBox.value.indexOf(msg) === -1) msgBox.value = msgBox.value + "\n" + msg;
      prefilled = msgBox.value;
    }
    updateWhatsApp();
    if (a.hasAttribute("data-close-dialog")) {
      closeDialog({ skipFocus: true });
      window.setTimeout(function () { if (needSel) needSel.focus({ preventScroll: true }); }, 450);
    }
  });

  /* ---------- quote form ---------- */

  var form = $("#quote-form");
  var statusEl = $("#form-status");
  var sendBtn = $("#send-btn");
  var waBtn = $("#wa-fallback");
  var demoNote = $("#demo-note");
  var success = $("#form-success");
  var seg = $('[data-list="quoteBranches"]');
  var openedAt = Date.now();

  function val(id) { var n = document.getElementById(id); return n ? n.value.trim() : ""; }

  function composeText() {
    var b = R.getSelectedBranch();
    var name = val("f-name"), biz = val("f-biz"), need = needSel ? needSel.value : "", msg = val("f-msg"), contact = val("f-contact");
    return "Hola Baristop" + (b ? " " + b.name : "") + ", soy " + (name || "(nombre)") + (biz ? " de " + biz : "") +
      ". Busco: " + need + "." + (msg ? " " + msg : "") + (contact ? " Contacto: " + contact : "");
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

  function markInvalid(input, on) {
    if (!input) return;
    if (on) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  function looksLikeContact(v) {
    return S.isEmail(v) || S.normalizeDigits(v).length >= 10;
  }

  function validate() {
    var name = $("#f-name"), contact = $("#f-contact");
    markInvalid(name, false);
    markInvalid(contact, false);
    if (!R.getSelectedBranch()) return { field: null, message: "Elige una sucursal para enviar tu solicitud." };
    var n = name.value.trim();
    if (n.length < 2 || n.length > 80) { markInvalid(name, true); return { field: name, message: "Escribe tu nombre (entre 2 y 80 caracteres)." }; }
    var c = contact.value.trim();
    if (c.length < 5 || c.length > 120 || !looksLikeContact(c)) {
      markInvalid(contact, true);
      return { field: contact, message: "Escribe un teléfono de 10 dígitos o un correo válido para responderte." };
    }
    return null;
  }

  function syncFormMode() {
    var noBranch = R.hasContent() && !R.getSelectedBranch();
    if (sendBtn) {
      sendBtn.hidden = C.isDemo;
      sendBtn.disabled = noBranch;
    }
    if (demoNote) demoNote.hidden = !C.isDemo;
    // In preview there is no submit button, so WhatsApp becomes the primary action.
    var wa = document.getElementById("wa-fallback");
    if (wa) {
      wa.classList.toggle("btn", !!C.isDemo);
      wa.classList.toggle("btn-ghost", !!C.isDemo);
      wa.textContent = C.isDemo ? "Pedir cotización por WhatsApp" : "o pídela por WhatsApp";
    }
  }

  if (form) {
    form.addEventListener("input", function () { updateWhatsApp(); });
    form.addEventListener("change", function () { updateWhatsApp(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (C.isDemo) return;
      var problem = validate();
      if (problem) {
        setStatus(problem.message, true);
        if (problem.field) problem.field.focus();
        return;
      }
      var b = R.getSelectedBranch();
      var ts = openedAt;
      if (Date.now() - ts > 23 * 3600 * 1000) ts = Date.now() - 5000; // keep inside the server's 24 h window
      setStatus("", false);
      sendBtn.disabled = true;
      var label = sendBtn.textContent;
      sendBtn.textContent = "Enviando…";
      form.setAttribute("aria-busy", "true");
      var hp = document.getElementById("f-hp");
      C.submitQuote({
        branchId: b.id,
        name: val("f-name"),
        business: val("f-biz"),
        contact: val("f-contact"),
        need: needSel ? needSel.value : "",
        message: val("f-msg"),
        website: hp ? hp.value : "",
        ts: ts
      }).then(function (res) {
        form.removeAttribute("aria-busy");
        sendBtn.textContent = label;
        sendBtn.disabled = false;
        if (res.ok) {
          form.hidden = true;
          if (success) { success.hidden = false; success.focus(); }
        } else {
          setStatus(res.message, true);
        }
      });
    });
  }

  /* Branch segmented control (radiogroup, roving tabindex). */
  if (seg) {
    seg.addEventListener("click", function (e) {
      var btn = e.target.closest(".seg-btn");
      if (btn) R.setSelectedBranch(btn.getAttribute("data-branch-id"));
    });
    seg.addEventListener("keydown", function (e) {
      var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: "first", End: "last" };
      if (!(e.key in keys)) return;
      var btns = $all(".seg-btn", seg);
      if (!btns.length) return;
      var idx = btns.indexOf(document.activeElement);
      if (idx < 0) idx = 0;
      var step = keys[e.key];
      var next = step === "first" ? 0 : step === "last" ? btns.length - 1 : (idx + step + btns.length) % btns.length;
      e.preventDefault();
      R.setSelectedBranch(btns[next].getAttribute("data-branch-id"));
      btns[next].focus();
    });
  }

  document.addEventListener("baristop:branch", updateWhatsApp);

  var firstRender = true;
  document.addEventListener("baristop:rendered", function () {
    updateWhatsApp();
    syncFormMode();
    if (dialogIsOpen()) {
      if (R.renderCategoryDialog(openCatId) === null) closeDialog();
    }
    if (firstRender) {
      firstRender = false;
      openFromHash();
    }
  });

  syncFormMode();
  updateWhatsApp();

  /* ---------- go ---------- */

  C.load(function (content) {
    R.render(content);
  });
})();
