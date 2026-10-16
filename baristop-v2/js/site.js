/*
 * Baristop v2 — boot and interactions shared by the home page and the catalog shell
 * (spec 1.1, 1.12, 11, 14.4): condensing nav, disclosure mega-menus, phone drawer with
 * accordions, search entry points, reveal-on-scroll, announcement dismiss, home quote form.
 */
(function () {
  "use strict";

  var S = window.BaristopSchema;
  var C = window.BaristopContent;
  var R = window.BaristopRender;
  var QF = window.BaristopQuoteForm;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- same-page anchors ----------
   * The <base> bootstrap ends in "/", so on a clean-URL host (/baristop-v2, no slash)
   * href="#recetas" resolves to /baristop-v2/#recetas: a different document. The browser
   * then reloads the whole page through a 308 back to /baristop-v2, and on a phone the
   * jump is lost while the page re-renders — the menu "does nothing". Keep those links
   * inside the current document. Handlers that already dealt with a click (quote list,
   * dialogs) call preventDefault first, so they are left alone. */

  function stripSlash(p) { return p.length > 1 ? p.replace(/\/+$/, "") : p; }

  function samePageHash(a) {
    var raw = a.getAttribute("href") || "";
    if (raw.charAt(0) === "#") return raw.length > 1 ? raw : "";
    var u;
    try { u = new URL(a.href, document.baseURI); } catch (err) { return ""; }
    if (!u.hash || u.origin !== location.origin) return "";
    if (stripSlash(u.pathname) !== stripSlash(location.pathname) || u.search !== location.search) return "";
    return u.hash;
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank") return;
    var hash = samePageHash(a);
    if (!hash) return;
    e.preventDefault();
    if (location.hash === hash) {
      var target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) target.scrollIntoView();
    } else {
      location.hash = hash; // same-document navigation: native scroll + hashchange, no reload
    }
  });

  /* ---------- condensing nav ---------- */

  var nav = $("header.nav");
  var toggle = $(".nav-toggle");
  var menu = $("#nav-menu");
  var desk = $('[data-list="navGroups"]');

  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- desktop disclosure menus (spec 11.1) ---------- */

  var openId = "";
  var openBy = "";
  var hoverTimer = null;

  function megaLinks(panel) { return $all("a[href]", panel); }

  function setMega(id, by) {
    window.clearTimeout(hoverTimer);
    if (!desk) return;
    $all(".nav-item", desk).forEach(function (item) {
      var on = !!id && item.getAttribute("data-group") === id;
      var btn = $(".nav-group", item), panel = $(".mega", item);
      if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (panel) panel.classList.toggle("is-open", on);
    });
    openId = id || "";
    openBy = id ? by : "";
  }

  function itemOf(node) { return node && node.closest ? node.closest(".nav-item") : null; }

  if (desk) {
    desk.addEventListener("click", function (e) {
      var btn = e.target.closest(".nav-group");
      if (btn) {
        var id = btn.getAttribute("data-group");
        if (openId === id && openBy !== "hover") setMega("", "");
        else setMega(id, "click");
        return;
      }
      if (e.target.closest("a")) setMega("", ""); // following a link closes the panel
    });

    desk.addEventListener("keydown", function (e) {
      var item = itemOf(e.target);
      if (!item) return;
      var btn = $(".nav-group", item), panel = $(".mega", item);
      var id = item.getAttribute("data-group");
      if (e.key === "Escape" && openId) {
        e.preventDefault();
        setMega("", "");
        if (btn) btn.focus();
        return;
      }
      if (e.target === btn && e.key === "ArrowDown") {
        e.preventDefault();
        setMega(id, "key");
        var first = megaLinks(panel)[0];
        if (first) first.focus();
        return;
      }
      if (panel && panel.contains(e.target)) {
        var links = megaLinks(panel);
        var i = links.indexOf(document.activeElement);
        var move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (move) {
          e.preventDefault();
          if (i + move < 0) { btn.focus(); return; }
          links[(i + move) % links.length].focus();
        } else if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          links[e.key === "Home" ? 0 : links.length - 1].focus();
        }
      }
    });

    // Tab out of the item closes it.
    desk.addEventListener("focusout", function (e) {
      var item = itemOf(e.target);
      if (!item || !openId) return;
      var to = e.relatedTarget;
      if (to && item.contains(to)) return;
      if (to === null && openBy === "click") return; // clicking inside the panel blurs first
      if (openBy !== "hover") setMega("", "");
    });

    // Pointer users: hover opens after 120 ms and closes 250 ms after leaving.
    desk.addEventListener("pointerover", function (e) {
      if (e.pointerType !== "mouse") return;
      var item = itemOf(e.target);
      if (!item || item.contains(e.relatedTarget)) return;
      window.clearTimeout(hoverTimer);
      var id = item.getAttribute("data-group");
      if (openId === id) return;
      hoverTimer = window.setTimeout(function () { setMega(id, "hover"); }, 120);
    });
    desk.addEventListener("pointerout", function (e) {
      if (e.pointerType !== "mouse") return;
      var item = itemOf(e.target);
      if (!item || item.contains(e.relatedTarget)) return;
      window.clearTimeout(hoverTimer);
      if (openBy === "hover") hoverTimer = window.setTimeout(function () { setMega("", ""); }, 250);
    });

    document.addEventListener("click", function (e) {
      if (openId && !itemOf(e.target)) setMega("", "");
    });
    document.addEventListener("baristop:rendered", function () {
      if (openId && !$(".nav-group[data-group=\"" + openId + "\"]", desk)) setMega("", "");
    });
  }

  /* ---------- phone drawer + accordions (spec 11.2) ---------- */

  function menuIsOpen() { return !!toggle && toggle.getAttribute("aria-expanded") === "true"; }

  function setMenu(open, returnFocus) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    menu.classList.toggle("is-open", open);
    if (open) { var first = $("button, a[href]", menu); if (first) first.focus(); }
    if (!open && returnFocus) toggle.focus();
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () { setMenu(!menuIsOpen()); });
    menu.addEventListener("click", function (e) {
      var acc = e.target.closest(".drawer-acc");
      if (acc) {
        var open = acc.getAttribute("aria-expanded") !== "true";
        acc.setAttribute("aria-expanded", open ? "true" : "false");
        var list = document.getElementById(acc.getAttribute("aria-controls"));
        if (list) list.hidden = !open;
        return;
      }
      if (e.target.closest("a[href], [data-qlist-open]")) setMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (menuIsOpen() && !e.target.closest("header.nav")) setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 820) { if (menuIsOpen()) setMenu(false); }
      else if (openId) setMega("", "");
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (menuIsOpen() && !(window.BaristopQuoteList && window.BaristopQuoteList.isOpen())) setMenu(false, true);
  });

  /* ---------- search entry points ---------- */

  function goSearch(q) {
    var href = R ? R.link("catalogo?q=" + encodeURIComponent(q)) : "catalogo?q=" + encodeURIComponent(q);
    if (window.BaristopCatalog && window.BaristopCatalog.go) window.BaristopCatalog.go(href);
    else window.location.href = href;
  }

  $all("form.nav-search-form").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = f.querySelector("input[type=search]");
      setMenu(false);
      goSearch(input ? input.value.trim() : "");
    });
  });

  // On the shell the search icon only focuses the box that is already on the page.
  var searchIcon = $(".nav-search");
  if (searchIcon) {
    searchIcon.addEventListener("click", function (e) {
      var box = document.getElementById("buscar");
      if (!box) return;
      e.preventDefault();
      box.focus();
      box.scrollIntoView({ block: "center" });
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

  R.setRootLinks();

  /* ---------- home quote form + CTA links that preset it ---------- */

  var homeForm = document.getElementById("quote-form");
  var homeCtl = null;
  if (homeForm && QF) {
    homeCtl = QF.mount(homeForm.closest(".quote-right") || homeForm.parentNode, { withItems: true, mode: "home" });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-need]");
    if (!a || !homeCtl) return;
    homeCtl.preset(a.getAttribute("data-need"), a.getAttribute("data-message"));
  });

  /* ---------- go ---------- */

  C.load(function (content) {
    R.render(content);
  });
})();
