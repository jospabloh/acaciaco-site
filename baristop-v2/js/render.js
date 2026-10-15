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
    promo: "assets/placeholders/promo-16x9.svg"
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
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.5v11l9-5.5-9-5.5z"/></svg>'
  };

  var state = { content: null, branches: [], selectedBranchId: "" };

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

  // https URL (Drive), a path relative to the site, or a data: image (admin demo mode).
  function imageSrc(u) {
    var v = str(u).trim();
    if (!v) return "";
    if (S.isSafeHttpsUrl(v)) return v;
    if (DATA_IMG_RE.test(v)) return v;
    if (REL_PATH_RE.test(v)) return v;
    return "";
  }

  function onImgError(e) {
    var img = e.currentTarget;
    var step = img.getAttribute("data-step") || "0";
    var m = /^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]+)/.exec(img.src);
    if (step === "0" && m) {
      img.setAttribute("data-step", "1");
      img.src = "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
      return;
    }
    if (step !== "2") {
      img.setAttribute("data-step", "2");
      img.src = PH[img.getAttribute("data-ph")] || PH.hero;
    }
  }

  function makeImg(url, ph, alt, opts) {
    opts = opts || {};
    var img = document.createElement("img");
    var src = imageSrc(url);
    img.src = src || PH[ph];
    img.alt = str(alt);
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

  function renderHeroStrip(rows) {
    var box = list("heroStrip");
    if (!box) return;
    var wrap = box.closest(".hero-strip") || box;
    clear(box);
    if (!rows.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    for (var i = 0; i < 4; i++) {
      var r = rows[i];
      var fig = el("figure", "tile" + (r ? "" : " tile-empty"));
      fig.appendChild(makeImg(r ? r.image : "", "hero", r ? (r.alt || r.title) : "", { eager: true, w: 1200, h: 900 }));
      if (r && str(r.title).trim()) fig.appendChild(el("figcaption", "tile-cap", r.title));
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

  /* ---------- offer chips ---------- */

  function fillChips(name, names) {
    var ul = list(name);
    if (!ul) return;
    clear(ul);
    names.forEach(function (n) { ul.appendChild(el("li", "", n)); });
  }

  /* ---------- catalogue ---------- */

  function renderCategories(cats) {
    var box = list("machineryCategories");
    if (!box) return;
    var block = box.closest(".cat-block");
    clear(box);
    setHidden(block, !cats.length);
    cats.forEach(function (c) {
      var btn = el("button", "mcard");
      btn.type = "button";
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("data-cat-id", c.id);
      var fig = el("span", "mcard-img");
      fig.appendChild(makeImg(c.image, "category", "", { w: 1200, h: 800 }));
      btn.appendChild(fig);
      var body = el("span", "mcard-body");
      body.appendChild(el("span", "mcard-name", c.name));
      if (str(c.tagline).trim()) body.appendChild(el("span", "mcard-tag", c.tagline));
      var more = el("span", "mcard-more", "Ver equipos");
      more.appendChild(document.createTextNode(" "));
      more.appendChild(el("span", "", "→")).setAttribute("aria-hidden", "true");
      body.appendChild(more);
      btn.appendChild(body);
      box.appendChild(btn);
    });
  }

  function renderInsumos(items) {
    var box = list("insumos");
    if (!box) return;
    var block = box.closest(".cat-block");
    clear(box);
    setHidden(block, !items.length);
    items.forEach(function (it) {
      var card = el("article", "icard");
      var fig = el("div", "icard-img");
      fig.appendChild(makeImg(it.image, "insumo", it.name, { w: 1200, h: 1500 }));
      card.appendChild(fig);
      var body = el("div", "icard-body");
      body.appendChild(el("h4", "", it.name));
      if (str(it.tagline).trim()) body.appendChild(el("p", "icard-tag", it.tagline));
      if (str(it.description).trim()) body.appendChild(el("p", "icard-text", it.description));
      card.appendChild(body);
      box.appendChild(card);
    });
  }

  // Fills the (static) dialog skeleton for one category. Returns the category or null.
  function renderCategoryDialog(catId) {
    var content = state.content;
    if (!content) return null;
    var cat = null;
    content.machineryCategories.forEach(function (c) { if (c.id === catId) cat = c; });
    if (!cat) return null;
    var title = qs("#cat-dialog-title");
    var body = qs("#cat-dialog-body");
    if (!title || !body) return null;
    title.textContent = cat.name;
    clear(body);
    if (str(cat.description).trim()) body.appendChild(el("p", "cd-desc", cat.description));
    var machines = content.machines.filter(function (m) { return m.categoryId === cat.id; });
    if (!machines.length) {
      var empty = el("div", "cd-empty");
      empty.appendChild(el("p", "", "Estamos actualizando este catálogo. Cotiza por WhatsApp y te enviamos opciones."));
      var go = el("a", "btn btn-wine", "Ir a cotizar");
      go.href = "#cotiza";
      go.setAttribute("data-need", "Maquinaria / equipo");
      go.setAttribute("data-close-dialog", "");
      empty.appendChild(go);
      body.appendChild(empty);
      return cat;
    }
    var ul = el("ul", "machine-list");
    machines.forEach(function (m) {
      var li = el("li", "machine");
      var fig = el("div", "machine-img");
      fig.appendChild(makeImg(m.image, "machine", m.name, { w: 1200, h: 900 }));
      li.appendChild(fig);
      var info = el("div", "machine-info");
      info.appendChild(el("h4", "", m.name));
      if (str(m.description).trim()) info.appendChild(el("p", "machine-desc", m.description));
      var specs = str(m.specs).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (specs.length) {
        var sl = el("ul", "specs");
        specs.forEach(function (s) { sl.appendChild(el("li", "", s)); });
        info.appendChild(sl);
      }
      var a = el("a", "mlink", "Cotizar este equipo");
      a.href = "#cotiza";
      a.setAttribute("data-need", "Maquinaria / equipo");
      a.setAttribute("data-message", "Me interesa: " + m.name);
      a.setAttribute("data-close-dialog", "");
      info.appendChild(a);
      li.appendChild(info);
      ul.appendChild(li);
    });
    body.appendChild(ul);
    return cat;
  }

  /* ---------- recipes ---------- */

  function renderRecipes(items, site) {
    var box = list("recipes");
    if (!box) return;
    clear(box);
    var empty = qs("[data-recipes-empty]");
    setHidden(empty, items.length > 0);
    setHidden(box, !items.length);
    items.forEach(function (r) {
      var href = safeUrl(r.videoUrl);
      var card = href ? el("a", "rcard rcard-link") : el("article", "rcard");
      if (href) {
        card.href = href;
        card.target = "_blank";
        card.rel = "noopener";
      }
      var fig = el("div", "rcard-img");
      fig.appendChild(makeImg(r.photo, "recipe", r.title, { w: 1080, h: 1350 }));
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
      if (href) {
        var watch = el("span", "rcard-watch", "Ver video ↗");
        body.appendChild(watch);
      }
      card.appendChild(body);
      box.appendChild(card);
    });
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

  /* Branch segmented control (radiogroup); keyboard handling lives in site.js. */
  function renderBranchSelector(branches) {
    var box = list("quoteBranches");
    if (!box) return;
    clear(box);
    var ids = branches.map(function (b) { return b.id; });
    if (ids.indexOf(state.selectedBranchId) === -1) state.selectedBranchId = ids.length ? ids[0] : "";
    branches.forEach(function (b) {
      var btn = el("button", "seg-btn", b.name);
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("data-branch-id", b.id);
      box.appendChild(btn);
    });
    syncBranchSelector();
  }

  function syncBranchSelector() {
    var box = list("quoteBranches");
    if (!box) return;
    qsa(".seg-btn", box).forEach(function (btn) {
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

  /* ---------- entry point ---------- */

  function render(content) {
    state.content = content;
    state.branches = content.branches;
    var site = content.site || {};
    renderTexts(site);
    renderAnnouncement(content.announcements);
    renderHeroStrip(content.heroImages);
    renderPromos(content.promos);
    fillChips("offerMachineryChips", content.machineryCategories.map(function (c) { return c.name; }));
    fillChips("offerSuppliesChips", content.insumos.map(function (i) { return i.name; }));
    renderCategories(content.machineryCategories);
    renderInsumos(content.insumos);
    renderRecipes(content.recipes, site);
    renderBranchCards(content.branches);
    renderBranchSelector(content.branches);
    renderFooterBranches(content.branches);
    renderSocialList("social", content.social, "");
    renderSocialList("footerSocial", content.social, "");
    renderAlliances(content.alliances);
    document.dispatchEvent(new CustomEvent("baristop:rendered", { detail: { content: content } }));
  }

  window.BaristopRender = {
    render: render,
    renderCategoryDialog: renderCategoryDialog,
    setSelectedBranch: setSelectedBranch,
    getBranch: getBranch,
    getSelectedBranch: function () { return getBranch(state.selectedBranchId); },
    hasContent: function () { return !!state.content; },
    getSite: function () { return state.content ? state.content.site : {}; },
    getBranches: function () { return state.branches; },
    waLink: waLink,
    dismissKey: DISMISS_KEY
  };
})();
