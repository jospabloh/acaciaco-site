/* ACACIA · Promo de apps de pago para herramientas gratuitas.
 * Regla general: incluye en cualquier app "free" estas dos líneas:
 *   <div id="acacia-promo"></div>
 *   <script src="/scripts/freeware-promo.js" defer></script>
 * Es autocontenido: inyecta sus estilos, rota solo, respeta tema (data-theme)
 * e idioma (atributo lang / localStorage acacia-lang). Sin dependencias.
 */
(function () {
  if (window.__acaciaPromo) return;
  window.__acaciaPromo = true;

  var APPS = [
    {
      id: "flowfin", href: "/apps/flowfin", l: 0.58, c: 0.13, h: 152, icon: "wallet",
      es: { tag: "FlowFin", h: "¿A dónde se fue tu dinero este mes?", p: "Organiza tus finanzas personales, en pareja y en familia. Sin hojas de cálculo y sin sorpresas a fin de mes.", cta: "Toma el control" },
      en: { tag: "FlowFin", h: "Where did your money go this month?", p: "Organize your personal, couple and family finances. No spreadsheets, no end-of-month surprises.", cta: "Take control" }
    },
    {
      id: "stockflow", href: "/apps/stockflow", l: 0.57, c: 0.12, h: 205, icon: "box",
      es: { tag: "StockFlow", h: "Tu negocio, bajo control total.", p: "Inventario, caja chica, proveedores, cotizaciones, entregas, cobranza y utilidades en un solo lugar.", cta: "Ordena tu operación" },
      en: { tag: "StockFlow", h: "Your business, fully under control.", p: "Inventory, petty cash, suppliers, quotes, deliveries, collections and profits — all in one place.", cta: "Streamline your operation" }
    },
    {
      id: "liuma", href: "/apps/liuma", l: 0.55, c: 0.14, h: 292, icon: "school",
      es: { tag: "LIUMA", h: "El colegio que comunica como siempre debió ser.", p: "Conecta a familias, maestros y administración con IA, reportes claros y la seguridad más alta de la industria.", cta: "Conoce LIUMA" },
      en: { tag: "LIUMA", h: "The school that finally communicates right.", p: "Connect families, teachers and staff with AI, clear reports and industry-leading privacy and security.", cta: "Discover LIUMA" }
    },
    {
      id: "puntos", href: "/apps/puntos-plus", l: 0.64, c: 0.14, h: 70, icon: "star",
      es: { tag: "Puntos+", h: "Premia a quien te elige.", p: "Lleva tu programa de lealtad directo al wallet de tus clientes. Más visitas, más recompra, más amor por tu marca.", cta: "Fideliza más" },
      en: { tag: "Puntos+", h: "Reward the customers who choose you.", p: "Bring your loyalty program straight into your customers' wallet. More visits, more repeat sales.", cta: "Boost loyalty" }
    }
  ];

  var ICONS = {
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 13h.01"/>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/>',
    school: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/>',
    star: '<polygon points="12 2 14.9 8.6 22 9.3 16.7 14 18.3 21 12 17.3 5.7 21 7.3 14 2 9.3 9.1 8.6 12 2"/>'
  };

  var EYEBROW = { es: "Descubre las apps de ACACIA", en: "Discover the ACACIA apps" };

  function getLang() {
    var l = document.documentElement.getAttribute("lang");
    if (l === "en" || l === "es") return l;
    try { var s = localStorage.getItem("acacia-lang"); if (s === "en" || s === "es") return s; } catch (e) {}
    return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es";
  }

  /* ---- estilos (una sola vez) ---- */
  var css = ''
    + '.acacia-promo{max-width:820px;margin:30px auto;padding:0 20px;'
    + '--ap:oklch(0.55 0.13 255);--ap-soft:oklch(0.55 0.13 255 / .12);'
    + '--ap-card:#fff;--ap-ink:#11181f;--ap-ink2:#5b6470;--ap-line:rgba(17,24,31,.10);'
    + 'font-family:"Space Grotesk",-apple-system,BlinkMacSystemFont,sans-serif;}'
    + 'html[data-theme="dark"] .acacia-promo{--ap-card:oklch(0.23 0.014 260);--ap-ink:#eef2f7;--ap-ink2:#9aa3af;--ap-line:rgba(255,255,255,.12);}'
    + '.acacia-promo .ap-eyebrow{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ap-ink2);margin:0 2px 8px;}'
    + '.acacia-promo .ap-dot{width:7px;height:7px;border-radius:50%;background:var(--ap);box-shadow:0 0 0 0 var(--ap);animation:apPulse 2.4s infinite;}'
    + '.acacia-promo .ap-card{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;text-decoration:none;'
    + 'background:linear-gradient(120deg,var(--ap-soft),transparent 60%),var(--ap-card);'
    + 'border:1px solid var(--ap-line);border-radius:16px;padding:18px 20px;'
    + 'box-shadow:0 14px 40px -26px rgba(0,0,0,.45);transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s;}'
    + '.acacia-promo .ap-card:hover{transform:translateY(-2px);box-shadow:0 20px 48px -24px rgba(0,0,0,.5);border-color:var(--ap);}'
    + '.acacia-promo .ap-card::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;'
    + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.18),transparent);transform:skewX(-18deg);animation:apShine 5.5s ease-in-out infinite;pointer-events:none;}'
    + '.acacia-promo .ap-fade{opacity:0;transform:translateY(6px);}'
    + '.acacia-promo .ap-inner{display:flex;align-items:center;gap:16px;width:100%;transition:opacity .22s ease,transform .22s ease;}'
    + '.acacia-promo .ap-icon{flex:none;width:50px;height:50px;border-radius:13px;display:grid;place-items:center;background:var(--ap-soft);color:var(--ap);}'
    + '.acacia-promo .ap-icon svg{width:26px;height:26px;}'
    + '.acacia-promo .ap-body{flex:1;min-width:0;}'
    + '.acacia-promo .ap-tag{font-size:12px;font-weight:700;color:var(--ap);letter-spacing:.02em;}'
    + '.acacia-promo .ap-h{font-size:16px;font-weight:700;color:var(--ap-ink);line-height:1.2;margin:1px 0 3px;letter-spacing:-.01em;}'
    + '.acacia-promo .ap-p{font-size:13px;color:var(--ap-ink2);line-height:1.45;}'
    + '.acacia-promo .ap-cta{flex:none;align-self:center;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;'
    + 'background:var(--ap);color:#fff;font-size:13.5px;font-weight:600;padding:10px 15px;border-radius:10px;transition:gap .2s;}'
    + '.acacia-promo .ap-card:hover .ap-cta{gap:10px;}'
    + '.acacia-promo .ap-dots{display:flex;justify-content:center;gap:7px;margin-top:12px;}'
    + '.acacia-promo .ap-dots button{width:7px;height:7px;padding:0;border:none;border-radius:50%;background:var(--ap-line);cursor:pointer;transition:width .25s,background .25s;}'
    + '.acacia-promo .ap-dots button[aria-current="true"]{width:20px;border-radius:4px;background:var(--ap);}'
    + '@media(max-width:560px){.acacia-promo .ap-inner{flex-wrap:wrap;}.acacia-promo .ap-cta{width:100%;justify-content:center;}}'
    + '@keyframes apShine{0%,55%{left:-60%;}85%,100%{left:130%;}}'
    + '@keyframes apPulse{0%{box-shadow:0 0 0 0 var(--ap);}70%{box-shadow:0 0 0 6px transparent;}100%{box-shadow:0 0 0 0 transparent;}}'
    + '@media(prefers-reduced-motion:reduce){.acacia-promo .ap-card::after,.acacia-promo .ap-dot{animation:none;}.acacia-promo .ap-card,.acacia-promo .ap-inner{transition:none;}}';

  function injectStyle() {
    if (document.getElementById("acacia-promo-style")) return;
    var s = document.createElement("style");
    s.id = "acacia-promo-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function mountPoint() {
    var el = document.getElementById("acacia-promo");
    if (el) return el;
    el = document.createElement("div");
    el.id = "acacia-promo";
    var article = document.querySelector(".seo-article");
    if (article && article.parentNode) article.parentNode.insertBefore(el, article);
    else document.body.appendChild(el);
    return el;
  }

  function build() {
    injectStyle();
    var root = mountPoint();
    var lang = getLang();
    var i = 0, timer = null;

    var sec = document.createElement("section");
    sec.className = "acacia-promo";
    sec.setAttribute("aria-label", "ACACIA");
    sec.innerHTML =
      '<div class="ap-eyebrow"><span class="ap-dot"></span> <span class="ap-eyebrow-txt"></span></div>'
      + '<a class="ap-card" href="#"><div class="ap-inner">'
      + '<div class="ap-icon"></div>'
      + '<div class="ap-body"><div class="ap-tag"></div><div class="ap-h"></div><div class="ap-p"></div></div>'
      + '<span class="ap-cta"></span>'
      + '</div></a>'
      + '<div class="ap-dots"></div>';
    root.innerHTML = "";
    root.appendChild(sec);

    var card = sec.querySelector(".ap-card");
    var inner = sec.querySelector(".ap-inner");
    var elIcon = sec.querySelector(".ap-icon");
    var elTag = sec.querySelector(".ap-tag");
    var elH = sec.querySelector(".ap-h");
    var elP = sec.querySelector(".ap-p");
    var elCta = sec.querySelector(".ap-cta");
    var elEye = sec.querySelector(".ap-eyebrow-txt");
    var dotsBox = sec.querySelector(".ap-dots");

    APPS.forEach(function (a, idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", a[lang] ? a[lang].tag : a.es.tag);
      b.addEventListener("click", function () { go(idx, true); });
      dotsBox.appendChild(b);
    });
    var dots = dotsBox.querySelectorAll("button");

    function paint() {
      lang = getLang();
      var a = APPS[i], tx = a[lang] || a.es;
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      var L = dark ? Math.min(0.82, a.l + 0.12) : a.l;
      sec.style.setProperty("--ap", "oklch(" + L + " " + a.c + " " + a.h + ")");
      sec.style.setProperty("--ap-soft", "oklch(" + L + " " + a.c + " " + a.h + " / .12)");
      elEye.textContent = EYEBROW[lang] || EYEBROW.es;
      elIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[a.icon] + "</svg>";
      elTag.textContent = tx.tag;
      elH.textContent = tx.h;
      elP.textContent = tx.p;
      elCta.innerHTML = tx.cta + ' <span aria-hidden="true">→</span>';
      card.setAttribute("href", a.href);
      for (var d = 0; d < dots.length; d++) dots[d].setAttribute("aria-current", d === i ? "true" : "false");
    }

    function go(n, manual) {
      i = (n + APPS.length) % APPS.length;
      inner.classList.add("ap-fade");
      setTimeout(function () { paint(); inner.classList.remove("ap-fade"); }, 200);
      if (manual) restart();
    }
    function next() { go(i + 1); }
    function restart() { if (timer) clearInterval(timer); timer = setInterval(next, 6000); }

    paint();
    restart();
    sec.addEventListener("mouseenter", function () { if (timer) clearInterval(timer); });
    sec.addEventListener("mouseleave", restart);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { if (timer) clearInterval(timer); } else restart(); });

    // Reacciona a cambios de idioma/tema que hagan las apps en <html>
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "data-theme"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
