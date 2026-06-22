// Trip Converter — multi-currency, live rates, picker for up to 5 currencies.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// --- Tweakable defaults ---
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "tripName": "My Trip",
  "tripStart": "2025-11-01",
  "tripEnd": "2026-01-31",
  "budget": 0,
  "spent": 0,
  "showBudget": true,
  "showCosts": true,
  "trackExpenses": "ask",
  "accent": "warm",
  "autoRegion": true,
  "selectedCurrencies": ["USD", "MXN", "CRC"]
}/*EDITMODE-END*/;

const MAX_CURRENCIES = 5;

// Palette = oklch(L C h) — hue comes from CURRENCY_HUE, L/C from palette
const PALETTE = {
  warm:   { l: 0.55, c: 0.13 },
  jewel:  { l: 0.50, c: 0.16 },
  pastel: { l: 0.72, c: 0.07 },
  mono:   { l: 0.40, c: 0.015 }
};

const CURRENCY_HUE = {
  USD: 145, MXN:  40, CRC: 160, EUR: 250, GBP: 285, CAD:   5, JPY: 350,
  CHF:  60, AUD:  85, NZD: 120, CNY:  20, HKD: 200, SGD: 175, KRW: 305,
  TWD: 230, THB: 320, VND: 180, IDR: 100, MYR: 215, PHP:  50, INR: 335,
  BRL: 130, ARS: 200, COP:  75, CLP: 270, PEN: 110, AED: 220, SAR:  35,
  ILS: 195, TRY:  10, ZAR:  65, EGP: 245, MAD: 155, KES: 235, NGN:  90,
  RUB: 295, PLN: 265, CZK:   0, HUF: 165, SEK: 205, NOK: 250, DKK: 280,
  RON: 115, BGN: 140
};

const CURRENCIES = {
  USD: { code: "USD", country: "US", name: "United States",  symbol: "$",   decimals: 2, region: "Americas" },
  MXN: { code: "MXN", country: "MX", name: "Mexico",         symbol: "$",   decimals: 0, region: "Americas" },
  CRC: { code: "CRC", country: "CR", name: "Costa Rica",     symbol: "₡",   decimals: 0, region: "Americas" },
  CAD: { code: "CAD", country: "CA", name: "Canada",         symbol: "$",   decimals: 2, region: "Americas" },
  BRL: { code: "BRL", country: "BR", name: "Brazil",         symbol: "R$",  decimals: 2, region: "Americas" },
  ARS: { code: "ARS", country: "AR", name: "Argentina",      symbol: "$",   decimals: 0, region: "Americas" },
  COP: { code: "COP", country: "CO", name: "Colombia",       symbol: "$",   decimals: 0, region: "Americas" },
  CLP: { code: "CLP", country: "CL", name: "Chile",          symbol: "$",   decimals: 0, region: "Americas" },
  PEN: { code: "PEN", country: "PE", name: "Peru",           symbol: "S/",  decimals: 2, region: "Americas" },
  EUR: { code: "EUR", country: "EU", name: "Eurozone",       symbol: "€",   decimals: 2, region: "Europe" },
  GBP: { code: "GBP", country: "GB", name: "United Kingdom", symbol: "£",   decimals: 2, region: "Europe" },
  CHF: { code: "CHF", country: "CH", name: "Switzerland",    symbol: "Fr",  decimals: 2, region: "Europe" },
  PLN: { code: "PLN", country: "PL", name: "Poland",         symbol: "zł",  decimals: 2, region: "Europe" },
  CZK: { code: "CZK", country: "CZ", name: "Czechia",        symbol: "Kč",  decimals: 0, region: "Europe" },
  HUF: { code: "HUF", country: "HU", name: "Hungary",        symbol: "Ft",  decimals: 0, region: "Europe" },
  SEK: { code: "SEK", country: "SE", name: "Sweden",         symbol: "kr",  decimals: 2, region: "Europe" },
  NOK: { code: "NOK", country: "NO", name: "Norway",         symbol: "kr",  decimals: 2, region: "Europe" },
  DKK: { code: "DKK", country: "DK", name: "Denmark",        symbol: "kr",  decimals: 2, region: "Europe" },
  RON: { code: "RON", country: "RO", name: "Romania",        symbol: "lei", decimals: 2, region: "Europe" },
  BGN: { code: "BGN", country: "BG", name: "Bulgaria",       symbol: "лв",  decimals: 2, region: "Europe" },
  TRY: { code: "TRY", country: "TR", name: "Türkiye",        symbol: "₺",   decimals: 2, region: "Europe" },
  JPY: { code: "JPY", country: "JP", name: "Japan",          symbol: "¥",   decimals: 0, region: "Asia" },
  CNY: { code: "CNY", country: "CN", name: "China",          symbol: "¥",   decimals: 2, region: "Asia" },
  HKD: { code: "HKD", country: "HK", name: "Hong Kong",      symbol: "$",   decimals: 2, region: "Asia" },
  SGD: { code: "SGD", country: "SG", name: "Singapore",      symbol: "$",   decimals: 2, region: "Asia" },
  KRW: { code: "KRW", country: "KR", name: "South Korea",    symbol: "₩",   decimals: 0, region: "Asia" },
  TWD: { code: "TWD", country: "TW", name: "Taiwan",         symbol: "$",   decimals: 0, region: "Asia" },
  THB: { code: "THB", country: "TH", name: "Thailand",       symbol: "฿",   decimals: 0, region: "Asia" },
  VND: { code: "VND", country: "VN", name: "Vietnam",        symbol: "₫",   decimals: 0, region: "Asia" },
  IDR: { code: "IDR", country: "ID", name: "Indonesia",      symbol: "Rp",  decimals: 0, region: "Asia" },
  MYR: { code: "MYR", country: "MY", name: "Malaysia",       symbol: "RM",  decimals: 2, region: "Asia" },
  PHP: { code: "PHP", country: "PH", name: "Philippines",    symbol: "₱",   decimals: 0, region: "Asia" },
  INR: { code: "INR", country: "IN", name: "India",          symbol: "₹",   decimals: 0, region: "Asia" },
  AUD: { code: "AUD", country: "AU", name: "Australia",      symbol: "$",   decimals: 2, region: "Oceania" },
  NZD: { code: "NZD", country: "NZ", name: "New Zealand",    symbol: "$",   decimals: 2, region: "Oceania" },
  AED: { code: "AED", country: "AE", name: "U.A.E.",         symbol: "د.إ", decimals: 2, region: "Mid East & Africa" },
  SAR: { code: "SAR", country: "SA", name: "Saudi Arabia",   symbol: "﷼",   decimals: 2, region: "Mid East & Africa" },
  ILS: { code: "ILS", country: "IL", name: "Israel",         symbol: "₪",   decimals: 2, region: "Mid East & Africa" },
  ZAR: { code: "ZAR", country: "ZA", name: "South Africa",   symbol: "R",   decimals: 2, region: "Mid East & Africa" },
  EGP: { code: "EGP", country: "EG", name: "Egypt",          symbol: "E£",  decimals: 2, region: "Mid East & Africa" },
  MAD: { code: "MAD", country: "MA", name: "Morocco",        symbol: "DH",  decimals: 2, region: "Mid East & Africa" },
  KES: { code: "KES", country: "KE", name: "Kenya",          symbol: "Sh",  decimals: 0, region: "Mid East & Africa" },
  NGN: { code: "NGN", country: "NG", name: "Nigeria",        symbol: "₦",   decimals: 0, region: "Mid East & Africa" }
};

// Real-world cost anchors (only for currencies we have ground-truth pricing on)
const COSTS = {
  USD: [
    { label: "Drip coffee",        price: 4.50,  icon: "C" },
    { label: "Subway / bus ride",  price: 2.90,  icon: "T" },
    { label: "Casual lunch",       price: 18,    icon: "L" },
    { label: "Movie ticket",       price: 16,    icon: "M" },
    { label: "Midrange hotel",     price: 180,   icon: "H" }
  ],
  MXN: [
    { label: "Street taco",        price: 25,    icon: "T" },
    { label: "Coffee, cafecito",   price: 55,    icon: "C" },
    { label: "Uber, short ride",   price: 95,    icon: "U" },
    { label: "Sit-down dinner",    price: 380,   icon: "D" },
    { label: "Boutique hotel",     price: 2400,  icon: "H" }
  ],
  CRC: [
    { label: "Casado lunch",       price: 4500,  icon: "L" },
    { label: "Café con leche",     price: 1800,  icon: "C" },
    { label: "Taxi, 10 min",       price: 3200,  icon: "T" },
    { label: "Zipline tour",       price: 38000, icon: "Z" },
    { label: "Eco-lodge night",    price: 72000, icon: "H" }
  ]
};

// Fallback rates if API fails (relative to USD, mid-2026 approximate)
const FALLBACK_RATES = {
  USD: 1, MXN: 17.42, CRC: 512.60, EUR: 0.92, GBP: 0.78, CAD: 1.36, JPY: 156,
  CHF: 0.88, AUD: 1.53, NZD: 1.65, CNY: 7.18, HKD: 7.81, SGD: 1.34, KRW: 1370,
  TWD: 32.1, THB: 36.2, VND: 25400, IDR: 16100, MYR: 4.71, PHP: 58.3, INR: 83.4,
  BRL: 5.12, ARS: 990, COP: 4020, CLP: 935, PEN: 3.75, AED: 3.67, SAR: 3.75,
  ILS: 3.71, TRY: 32.4, ZAR: 18.6, EGP: 48.5, MAD: 9.95, KES: 130, NGN: 1480,
  PLN: 3.95, CZK: 23.1, HUF: 360, SEK: 10.6, NOK: 10.7, DKK: 6.87, RON: 4.59,
  BGN: 1.80
};

// --- Supabase (optional cloud sync) ---
const SUPABASE_URL = "https://lsylxcraugllwegjjvaq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_60mTi34vt4cEbjEFBeL9Kg_NQGf6Rf3";
const supabaseClient = (typeof window !== "undefined" && window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
const LOCAL_TWEAKS_KEY = "plinkfx.tweaks";

// --- Cookies (trip name persistence) ---
const COOKIE_CONSENT = "plinkfx_consent";
const COOKIE_TRIP_NAME = "plinkfx_trip_name";
function cookieGet(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}
function cookieSet(name, value, days = 365) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

// --- i18n ---
const SPANISH_COUNTRIES = ["MX", "CR", "AR", "CO", "CL", "PE", "ES"];
function localeForCurrency(code) {
  const c = CURRENCIES[code];
  if (!c) return "en";
  return SPANISH_COUNTRIES.includes(c.country) ? "es" : "en";
}

const STRINGS = {
  en: {
    sign_in: "Sign in",
    account: "Account",
    sign_out: "Sign out",
    tracking_label: "Tracking",
    tracking_sub: "currencies for this trip",
    add_currency: "Add currency",
    max_currencies: "Max {n}",
    currencies_tracked: "{n} of {max} currencies tracked",
    search_placeholder: "Search currencies, countries…",
    no_matches: "No matches for \"{q}\"",
    remove: "Remove",
    im_in: "I'm in",
    auto_detected: "auto-detected",
    reset_to_auto: "Reset to auto",
    youre_spending: "You're spending",
    your_home: "Your home",
    trip_budget: "Trip budget",
    remaining: "Remaining",
    of_label: "of",
    if_you_spend: "If you spend",
    now_arrow: "now →",
    left_label: "left",
    cookie_title: "Cookies",
    cookie_text: "We save your trip name in a small cookie so it's there when you come back. No tracking, no third parties.",
    cookie_ok: "OK, got it",
    rate_live: "Live",
    rate_loading: "Fetching…",
    rate_offline: "Offline · cached",
    rate_refresh: "Refresh rates",
    foot_travel_only: "For travel planning only",
    foot_crafted: "crafted with",
    foot_by: "by",
    mark_credit: "crafted with care by",
    mark_free: "Free for everyone",
    nav_more: "← More tools",
    rates_live_prefix: "Rates from",
    rates_last: "last updated",
    rates_fallback: "Couldn't reach rate provider — showing cached rates",
    rates_fetching: "Fetching latest rates…",
    pick_dates: "Pick dates",
    pick_start_short: "pick start",
    pick_end_short: "pick end",
    pick_start: "Pick a start date",
    pick_end: "Pick an end date",
    same_day_ok: "same day is OK",
    done: "Done",
    prev_month: "Previous month",
    next_month: "Next month",
    costs_heading: "What it buys, locally",
    costs_desc: "Your {base} compared to common purchases at each destination. Anchors shown for USD, MXN, and CRC.",
    in_country_buys: "In {country}, {amount} buys",
    add_another_currency: "Add another currency above to see conversions.",
    auth_signin_title: "Sign in",
    auth_signup_title: "Create account",
    auth_subtitle: "Optional — sync your trip name across devices.",
    auth_google: "Continue with Google",
    auth_or: "or",
    auth_email: "Email",
    auth_password: "Password",
    auth_signin_btn: "Sign in",
    auth_signup_btn: "Create account",
    auth_working: "Working…",
    auth_toggle_to_signup: "No account? Create one",
    auth_toggle_to_signin: "Already have an account? Sign in",
    auth_note: "Skip this — your tweaks already save locally to this browser.",
    auth_confirm_email: "Check your inbox to confirm your email, then sign in.",
    close_label: "Close",
    budget_cta_title: "Track your expenses on this trip?",
    budget_cta_desc: "Set a budget, log what you spend, watch it tick down across every currency on the trip. Optional — say no and the page keeps working as a converter.",
    budget_cta_note_label: "How your data is handled.",
    budget_cta_note_body: "Expense numbers are saved only when you're signed in, and they're wiped automatically when the trip ends{date_hint}. We don't keep an archive. You can download a PDF summary before the data is removed.",
    budget_cta_yes_signed_in: "Yes, track expenses",
    budget_cta_yes_sign_in: "Sign in & track expenses",
    budget_cta_no: "No thanks",
    expiry_notice: "Expense data wipes automatically on {date}. Download a PDF summary anytime — we won't keep an archive.",
    summary_eyebrow: "Trip ended",
    summary_wrapped: "{name} — wrapped",
    summary_desc: "Your expense data is about to be permanently removed from our servers. Download a PDF before it goes, if you want a copy.",
    summary_dates: "Dates",
    summary_budget: "Budget",
    summary_spent: "Spent",
    summary_remaining: "Remaining",
    summary_download: "Download PDF",
    summary_delete: "Delete my data now",
    summary_later: "Later",
    summary_grace: "If you don't act, the data is automatically removed {n} days after the trip end date. Nothing is archived.",
    pdf_header: "PLINK FX · TRIP SUMMARY",
    pdf_untitled: "Untitled trip",
    pdf_no_dates: "(no dates set)",
    pdf_budget: "Budget",
    pdf_spent: "Spent",
    pdf_remaining: "Remaining",
    pdf_footer: "Generated on {date}. Plink FX does not retain a copy of this data — once the trip ended, it was removed from our servers.",
  },
  es: {
    sign_in: "Iniciar sesión",
    account: "Cuenta",
    sign_out: "Cerrar sesión",
    tracking_label: "Monedas",
    tracking_sub: "del viaje",
    add_currency: "Añadir moneda",
    max_currencies: "Máx {n}",
    currencies_tracked: "{n} de {max} monedas activas",
    search_placeholder: "Busca monedas, países…",
    no_matches: "Sin resultados para \"{q}\"",
    remove: "Quitar",
    im_in: "Estoy en",
    auto_detected: "detección automática",
    reset_to_auto: "Volver a automático",
    youre_spending: "Vas a gastar",
    your_home: "Tu hogar",
    trip_budget: "Presupuesto del viaje",
    remaining: "Disponible",
    of_label: "de",
    if_you_spend: "Si gastas",
    now_arrow: "ahora →",
    left_label: "restante",
    cookie_title: "Cookies",
    cookie_text: "Guardamos el nombre de tu viaje en una cookie para que esté ahí cuando vuelvas. Sin rastreo, sin terceros.",
    cookie_ok: "De acuerdo",
    rate_live: "En vivo",
    rate_loading: "Cargando…",
    rate_offline: "Sin conexión · caché",
    rate_refresh: "Actualizar tasas",
    foot_travel_only: "Solo para planear viajes",
    foot_crafted: "hecho con",
    foot_by: "por",
    mark_credit: "hecho con cariño por",
    mark_free: "Gratis para todos",
    nav_more: "← Más herramientas",
    rates_live_prefix: "Tasas de",
    rates_last: "actualizadas hace",
    rates_fallback: "No se pudo conectar — mostrando tasas en caché",
    rates_fetching: "Obteniendo tasas actuales…",
    pick_dates: "Elegir fechas",
    pick_start_short: "elegir inicio",
    pick_end_short: "elegir fin",
    pick_start: "Elige fecha de inicio",
    pick_end: "Elige fecha de fin",
    same_day_ok: "el mismo día está bien",
    done: "Listo",
    prev_month: "Mes anterior",
    next_month: "Mes siguiente",
    costs_heading: "Qué compra, localmente",
    costs_desc: "Tu {base} comparado con compras comunes en cada destino. Ejemplos para USD, MXN y CRC.",
    in_country_buys: "En {country}, {amount} compra",
    add_another_currency: "Añade otra moneda arriba para ver conversiones.",
    auth_signin_title: "Iniciar sesión",
    auth_signup_title: "Crear cuenta",
    auth_subtitle: "Opcional — sincroniza tu viaje entre dispositivos.",
    auth_google: "Continuar con Google",
    auth_or: "o",
    auth_email: "Correo",
    auth_password: "Contraseña",
    auth_signin_btn: "Iniciar sesión",
    auth_signup_btn: "Crear cuenta",
    auth_working: "Procesando…",
    auth_toggle_to_signup: "¿No tienes cuenta? Crea una",
    auth_toggle_to_signin: "¿Ya tienes cuenta? Inicia sesión",
    auth_note: "Sáltalo — tus ajustes ya se guardan localmente.",
    auth_confirm_email: "Revisa tu correo para confirmar, luego inicia sesión.",
    close_label: "Cerrar",
    budget_cta_title: "¿Quieres llevar el control de gastos?",
    budget_cta_desc: "Establece un presupuesto, registra tus gastos y observa cómo disminuye en cada moneda del viaje. Opcional — di no y la página sigue funcionando como convertidor.",
    budget_cta_note_label: "Cómo manejamos tus datos.",
    budget_cta_note_body: "Los gastos solo se guardan si iniciaste sesión, y se eliminan automáticamente al terminar el viaje{date_hint}. No guardamos archivo. Puedes descargar un PDF antes de que se eliminen.",
    budget_cta_yes_signed_in: "Sí, llevar gastos",
    budget_cta_yes_sign_in: "Iniciar sesión y llevar gastos",
    budget_cta_no: "No, gracias",
    expiry_notice: "Los datos de gastos se eliminan automáticamente el {date}. Descarga un PDF cuando quieras — no guardamos archivo.",
    summary_eyebrow: "Viaje terminado",
    summary_wrapped: "{name} — completado",
    summary_desc: "Tus datos de gastos están a punto de eliminarse de nuestros servidores. Descarga un PDF antes de que desaparezcan.",
    summary_dates: "Fechas",
    summary_budget: "Presupuesto",
    summary_spent: "Gastado",
    summary_remaining: "Disponible",
    summary_download: "Descargar PDF",
    summary_delete: "Eliminar mis datos ahora",
    summary_later: "Después",
    summary_grace: "Si no haces nada, los datos se eliminan automáticamente {n} días después del fin del viaje. Nada se archiva.",
    pdf_header: "PLINK FX · RESUMEN DE VIAJE",
    pdf_untitled: "Viaje sin nombre",
    pdf_no_dates: "(sin fechas)",
    pdf_budget: "Presupuesto",
    pdf_spent: "Gastado",
    pdf_remaining: "Disponible",
    pdf_footer: "Generado el {date}. Plink FX no conserva una copia de estos datos — una vez terminado el viaje, se eliminaron de nuestros servidores.",
  }
};

function tr(lang, key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

const LangContext = React.createContext("en");

// Date picker labels per language
const MONTH_NAMES_I18N = {
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  es: ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
};
const MONTH_SHORT_I18N = {
  en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  es: ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"],
};
const WEEKDAYS_I18N = {
  en: ["Su","Mo","Tu","We","Th","Fr","Sa"],
  es: ["Do","Lu","Ma","Mi","Ju","Vi","Sá"],
};

// Translated COSTS labels (data is otherwise identical to COSTS)
const COSTS_LABEL_I18N = {
  en: {
    "Drip coffee": "Drip coffee", "Subway / bus ride": "Subway / bus ride",
    "Casual lunch": "Casual lunch", "Movie ticket": "Movie ticket",
    "Midrange hotel": "Midrange hotel", "Street taco": "Street taco",
    "Coffee, cafecito": "Coffee, cafecito", "Uber, short ride": "Uber, short ride",
    "Sit-down dinner": "Sit-down dinner", "Boutique hotel": "Boutique hotel",
    "Casado lunch": "Casado lunch", "Café con leche": "Café con leche",
    "Taxi, 10 min": "Taxi, 10 min", "Zipline tour": "Zipline tour",
    "Eco-lodge night": "Eco-lodge night",
  },
  es: {
    "Drip coffee": "Café filtrado", "Subway / bus ride": "Metro / autobús",
    "Casual lunch": "Almuerzo casual", "Movie ticket": "Boleto de cine",
    "Midrange hotel": "Hotel medio", "Street taco": "Taco de la calle",
    "Coffee, cafecito": "Café, cafecito", "Uber, short ride": "Uber, viaje corto",
    "Sit-down dinner": "Cena sentada", "Boutique hotel": "Hotel boutique",
    "Casado lunch": "Casado", "Café con leche": "Café con leche",
    "Taxi, 10 min": "Taxi, 10 min", "Zipline tour": "Tour de canopy",
    "Eco-lodge night": "Eco-lodge, noche",
  }
};

// --- Helpers ---

function detectCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Mexico")) return "MXN";
    if (tz.includes("Costa_Rica")) return "CRC";
    if (/America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indianapolis|Boise|Juneau|Honolulu|Adak)/.test(tz)) return "USD";
    const loc = (navigator.language || "").toLowerCase();
    if (loc.includes("mx")) return "MXN";
    if (loc.includes("cr")) return "CRC";
    if (loc.startsWith("en-us") || loc === "en") return "USD";
  } catch (e) {}
  return "USD";
}

function fmt(n, code) {
  if (!isFinite(n)) return "—";
  const dec = code && CURRENCIES[code] ? CURRENCIES[code].decimals : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: dec, minimumFractionDigits: dec });
}

function timeAgo(date) {
  if (!date) return "—";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hr ago";
  return Math.floor(s / 86400) + " days ago";
}

function accentFor(code, palette) {
  const p = PALETTE[palette] || PALETTE.warm;
  const hue = CURRENCY_HUE[code] ?? 60;
  return `oklch(${p.l} ${p.c} ${hue})`;
}

// Quick-amount sets per currency (scale to the currency's magnitude)
function quickAmountsFor(code) {
  const c = CURRENCIES[code];
  if (!c) return [1, 5, 10, 20, 50, 100, 500];
  const r = FALLBACK_RATES[code] || 1;
  // Scale a USD base set by approximate rate and round to nice numbers
  const baseUSD = [1, 5, 10, 20, 50, 100, 500];
  const roundNice = (n) => {
    if (n < 1) return Math.round(n * 100) / 100;
    if (n < 10) return Math.round(n);
    if (n < 100) return Math.round(n / 5) * 5;
    if (n < 1000) return Math.round(n / 10) * 10;
    if (n < 10000) return Math.round(n / 100) * 100;
    if (n < 100000) return Math.round(n / 500) * 500;
    return Math.round(n / 1000) * 1000;
  };
  return baseUSD.map(b => roundNice(b * r));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useAnimatedNumber(value, ms = 280) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(performance.now());
  useEffect(() => {
    // Respect reduced-motion: snap straight to the value, no tween.
    if (prefersReducedMotion()) { setDisplay(value); return; }
    fromRef.current = display;
    startRef.current = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

// Click-outside hook for popovers
function useClickOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return;
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    const handleKey = (e) => { if (e.key === "Escape") onOutside(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [active]);
}

// Abstract country mark — uniform circle with ISO country code text
function FlagMark({ code, size = 44 }) {
  const c = CURRENCIES[code];
  if (!c) return null;
  const accent = `var(--c-${code})`;
  const r = size / 2;
  // Special illustrative marks for the three "home" countries; ISO text monogram for rest
  if (code === "MXN") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <rect width="48" height="48" rx="22" fill={accent} opacity="0.12"/>
        <circle cx="24" cy="24" r="10" fill="none" stroke={accent} strokeWidth="2"/>
        <circle cx="24" cy="24" r="3.5" fill={accent}/>
      </svg>
    );
  }
  if (code === "CRC") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <rect width="48" height="48" rx="22" fill={accent} opacity="0.12"/>
        <path d="M14 30 Q24 14 34 30" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="24" cy="18" r="2.5" fill={accent}/>
      </svg>
    );
  }
  if (code === "USD") {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <rect width="48" height="48" rx="22" fill={accent} opacity="0.12"/>
        <path d="M12 18 H36 M12 24 H36 M12 30 H36" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  // Generic: 2-letter country code in a tinted circle
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect width="48" height="48" rx="22" fill={accent} opacity="0.12"/>
      <text x="24" y="29" textAnchor="middle"
            fontSize={size > 30 ? 15 : 11}
            fontWeight="600"
            fontFamily="Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
            fill={accent} letterSpacing="0.05em">{c.country}</text>
    </svg>
  );
}

// --- CurrencyPicker ---
function CurrencyPicker({ selected, onChange, max }) {
  const lang = React.useContext(LangContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const available = useMemo(() => {
    const all = Object.values(CURRENCIES);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      : all;
    // Group by region, sort code A-Z within
    const groups = {};
    filtered.forEach(c => {
      if (!groups[c.region]) groups[c.region] = [];
      groups[c.region].push(c);
    });
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.code.localeCompare(b.code)));
    return groups;
  }, [query]);

  const remove = (code) => {
    if (selected.length <= 1) return;
    onChange(selected.filter(c => c !== code));
  };
  const add = (code) => {
    if (selected.includes(code)) {
      setOpen(false);
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, code]);
    setQuery("");
    setOpen(false);
  };

  const canAdd = selected.length < max;

  return (
    <div className="picker">
      <div className="picker-chips">
        {selected.map(code => {
          const c = CURRENCIES[code];
          return (
            <div key={code} className="picker-chip" style={{ "--accent": `var(--c-${code})` }}>
              <FlagMark code={code} size={18} />
              <span className="picker-chip-code mono">{code}</span>
              <span className="picker-chip-name">{c.name}</span>
              {selected.length > 1 && (
                <button
                  className="picker-chip-x"
                  onClick={() => remove(code)}
                  aria-label={`${tr(lang, "remove")} ${code}`}
                  title={tr(lang, "remove")}
                >×</button>
              )}
            </div>
          );
        })}

        <div className="picker-wrap" ref={ref}>
          <button
            className={"picker-add" + (canAdd ? "" : " disabled")}
            onClick={() => canAdd && setOpen(o => !o)}
            disabled={!canAdd}
            title={canAdd ? tr(lang, "add_currency") : tr(lang, "max_currencies", { n: max })}
          >
            <span className="picker-add-plus">+</span>
            <span>{canAdd ? tr(lang, "add_currency") : tr(lang, "max_currencies", { n: max })}</span>
          </button>

          {open && <div className="mobile-backdrop" onClick={() => { setOpen(false); setQuery(""); }} />}
          {open && (
            <div className="picker-pop">
              <div className="picker-pop-head">
                <input
                  ref={inputRef}
                  className="picker-search"
                  placeholder={tr(lang, "search_placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="picker-count mono">{selected.length}/{max}</span>
              </div>
              <div className="picker-list">
                {Object.entries(available).map(([region, items]) => (
                  <div key={region} className="picker-group">
                    <div className="picker-group-head">{region}</div>
                    {items.map(c => {
                      const isSelected = selected.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          className={"picker-row" + (isSelected ? " is-selected" : "")}
                          onClick={() => !isSelected && add(c.code)}
                          disabled={isSelected}
                        >
                          <FlagMark code={c.code} size={22} />
                          <span className="picker-row-code mono">{c.code}</span>
                          <span className="picker-row-name">{c.name}</span>
                          <span className="picker-row-sym">{c.symbol}</span>
                          {isSelected && <span className="picker-row-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {Object.keys(available).length === 0 && (
                  <div className="picker-empty">{tr(lang, "no_matches", { q: query })}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="picker-meta">
        <span>{tr(lang, "currencies_tracked", { n: selected.length, max })}</span>
      </div>
    </div>
  );
}

// --- ConvCard ---
function ConvCard({ code, baseCode, rate, baseAmount, isHome }) {
  const lang = React.useContext(LangContext);
  const c = CURRENCIES[code];
  const converted = baseAmount * rate;
  const shown = useAnimatedNumber(converted, 280);
  const baseDec = CURRENCIES[baseCode].decimals;
  return (
    <div className={"conv-card" + (isHome ? " is-home" : "")} style={{ "--accent": `var(--c-${code})` }}>
      {isHome && <div className="home-tag">{tr(lang, "your_home")}</div>}
      <div className="conv-head">
        <FlagMark code={code} />
        <div className="conv-meta">
          <div className="conv-name">{c.name}</div>
          <div className="conv-code">
            {c.code}
            <span className="conv-rate">
              1 {baseCode} = <span className="mono">{rate < 1 ? rate.toFixed(4) : rate.toFixed(2)}</span> {c.code}
            </span>
          </div>
        </div>
      </div>

      <div className="conv-amount">
        <span className="conv-symbol">{c.symbol}</span>
        <span className="conv-big mono">{fmt(shown, code)}</span>
        <span className="conv-cur">{c.code}</span>
      </div>

      <div className="conv-foot">
        <span className="conv-foot-label">1 {c.code} →</span>
        <span className="mono">{(1 / rate).toFixed(baseDec === 0 ? 2 : 4)} {baseCode}</span>
        <span className="dot">·</span>
        <span className="conv-foot-label">100 {baseCode} →</span>
        <span className="mono">{fmt(100 * rate, code)} {c.code}</span>
      </div>
    </div>
  );
}

// --- QuickAmounts ---
function QuickAmounts({ onPick, baseCode, current }) {
  const amounts = useMemo(() => quickAmountsFor(baseCode), [baseCode]);
  const sym = CURRENCIES[baseCode].symbol;
  return (
    <div className="chips">
      {amounts.map(a => (
        <button
          key={a}
          className={"chip" + (Math.abs(current - a) < 0.001 ? " active" : "")}
          onClick={() => onPick(a)}
        >{sym}{a.toLocaleString()}</button>
      ))}
    </div>
  );
}

// --- Costs ---
function CostsRow({ cost, baseAmount, rate, code }) {
  const lang = React.useContext(LangContext);
  const local = baseAmount * rate;
  const qty = local / cost.price;
  const label = (COSTS_LABEL_I18N[lang] && COSTS_LABEL_I18N[lang][cost.label]) || cost.label;
  return (
    <div className="cost-row">
      <span className="cost-icon">{cost.icon}</span>
      <span className="cost-label">{label}</span>
      <span className="cost-price mono">{CURRENCIES[code].symbol}{fmt(cost.price, code)}</span>
      <span className="cost-qty">×<span className="mono">{qty < 10 ? qty.toFixed(1) : Math.floor(qty)}</span></span>
    </div>
  );
}

function CostsTable({ baseCode, baseAmount, rates, others }) {
  const lang = React.useContext(LangContext);
  const withCosts = others.filter(code => COSTS[code]);
  if (withCosts.length === 0) return null;
  return (
    <div className={"costs-grid count-" + withCosts.length}>
      {withCosts.map(code => {
        const rate = rates[code] / rates[baseCode];
        const local = baseAmount * rate;
        const c = CURRENCIES[code];
        return (
          <div key={code} className="costs-col" style={{ "--accent": `var(--c-${code})` }}>
            <div className="costs-head">
              <span className="costs-title">{tr(lang, "in_country_buys", { country: c.name, amount: `${CURRENCIES[baseCode].symbol}${fmt(baseAmount, baseCode)}` })}</span>
              <span className="costs-sub mono">{c.symbol}{fmt(local, code)} {code}</span>
            </div>
            {COSTS[code].map(cost => (
              <CostsRow key={cost.label} cost={cost} baseAmount={baseAmount} rate={rate} code={code} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// --- BudgetBar ---
function BudgetBar({ budget, spent, baseAmount, baseCode, rates, otherCodes }) {
  const lang = React.useContext(LangContext);
  const pct = Math.min(100, (spent / budget) * 100);
  const remaining = budget - spent;
  const remainingInBase = remaining * (rates[baseCode] || 1);
  const baseInUSD = baseAmount / (rates[baseCode] || 1);
  const afterPct = Math.min(100, ((spent + baseInUSD) / budget) * 100);

  return (
    <div className="budget">
      <div className="budget-head">
        <div>
          <div className="budget-label">{tr(lang, "trip_budget")}</div>
          <div className="budget-amounts">
            <span className="mono budget-spent">{CURRENCIES[baseCode].symbol}{fmt(spent * rates[baseCode], baseCode)}</span>
            <span className="budget-of">{tr(lang, "of_label")}</span>
            <span className="mono budget-total">{CURRENCIES[baseCode].symbol}{fmt(budget * rates[baseCode], baseCode)}</span>
            <span className="budget-code">{baseCode}</span>
          </div>
        </div>
        <div className="budget-right">
          <div className="budget-label">{tr(lang, "remaining")}</div>
          <div className="mono budget-remain">{CURRENCIES[baseCode].symbol}{fmt(remainingInBase, baseCode)}</div>
        </div>
      </div>

      <div className="budget-bar">
        <div className="budget-fill" style={{ width: pct + "%" }} />
        <div className="budget-fill-pending" style={{ width: afterPct + "%" }} />
        <div className="budget-tick" style={{ left: "25%" }}><span>25%</span></div>
        <div className="budget-tick" style={{ left: "50%" }}><span>50%</span></div>
        <div className="budget-tick" style={{ left: "75%" }}><span>75%</span></div>
      </div>

      <div className="budget-foot">
        <span className="budget-hint">{tr(lang, "if_you_spend")} <span className="mono">{CURRENCIES[baseCode].symbol}{fmt(baseAmount, baseCode)}</span> {tr(lang, "now_arrow")}</span>
        <span className="budget-after mono">{CURRENCIES[baseCode].symbol}{fmt(remainingInBase - baseAmount, baseCode)} {tr(lang, "left_label")}</span>
        {otherCodes.slice(0, 3).map(c => (
          <React.Fragment key={c}>
            <span className="dot">·</span>
            <span className="mono" style={{ color: `var(--c-${c})` }}>
              {CURRENCIES[c].symbol}{fmt((remainingInBase - baseAmount) * (rates[c] / rates[baseCode]), c)} {c}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// --- Auth ---
function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supabaseClient) { setReady(true); return; }
    let mounted = true;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setReady(true);
    });
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, s) => {
      setSession(s || null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return { session, user: session?.user || null, ready };
}

function AuthButton({ user, onOpen, onSignOut }) {
  const lang = React.useContext(LangContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setMenuOpen(false), menuOpen);
  if (!supabaseClient) return null;
  if (!user) {
    return (
      <button className="auth-btn" onClick={onOpen} title={tr(lang, "sign_in")}>
        <span aria-hidden="true">↗</span>
        <span>{tr(lang, "sign_in")}</span>
      </button>
    );
  }
  const display = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "";
  const initials = display
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const avatar = user.user_metadata?.avatar_url;
  return (
    <div className="auth-wrap" ref={ref}>
      <button className="auth-btn" onClick={() => setMenuOpen(o => !o)}>
        <span className="auth-avatar">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : initials}</span>
        <span>{tr(lang, "account")}</span>
      </button>
      {menuOpen && (
        <div className="auth-menu">
          <div className="auth-menu-email">{user.email || display}</div>
          <button className="auth-menu-item" onClick={() => { setMenuOpen(false); onSignOut(); }}>{tr(lang, "sign_out")}</button>
        </div>
      )}
    </div>
  );
}

function AuthModal({ onClose }) {
  const lang = React.useContext(LangContext);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const signInGoogle = async () => {
    if (!supabaseClient) return;
    setErr(""); setInfo("");
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href }
    });
    if (error) setErr(error.message);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    setLoading(true); setErr(""); setInfo("");
    try {
      if (mode === "signin") {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });
        if (error) setErr(error.message);
        else onClose();
      } else {
        const { error, data } = await supabaseClient.auth.signUp({ email, password: pw });
        if (error) setErr(error.message);
        else if (data.session) onClose();
        else setInfo(tr(lang, "auth_confirm_email"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose} aria-label={tr(lang, "close_label")}>×</button>
        <h2>{tr(lang, mode === "signin" ? "auth_signin_title" : "auth_signup_title")}</h2>
        <p>{tr(lang, "auth_subtitle")}</p>

        <button className="auth-google" onClick={signInGoogle}>
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.96v2.332A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.96A9 9 0 0 0 0 9c0 1.452.348 2.827.96 4.042l3.004-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A9 9 0 0 0 .96 4.958l3.004 2.332C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {tr(lang, "auth_google")}
        </button>

        <div className="auth-divider">{tr(lang, "auth_or")}</div>

        <form onSubmit={submit}>
          <input className="auth-field" type="email" required placeholder={tr(lang, "auth_email")}
                 value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <input className="auth-field" type="password" required placeholder={tr(lang, "auth_password")} minLength={6}
                 value={pw} onChange={e => setPw(e.target.value)}
                 autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          {err && <p className="auth-error">{err}</p>}
          {info && <p className="auth-error" style={{color:"var(--ink-2)"}}>{info}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? tr(lang, "auth_working") : tr(lang, mode === "signin" ? "auth_signin_btn" : "auth_signup_btn")}
          </button>
        </form>

        <button className="auth-toggle" onClick={() => { setErr(""); setInfo(""); setMode(m => m === "signin" ? "signup" : "signin"); }}>
          {tr(lang, mode === "signin" ? "auth_toggle_to_signup" : "auth_toggle_to_signin")}
        </button>

        <p className="auth-note">{tr(lang, "auth_note")}</p>
      </div>
    </div>
  );
}

// --- Date range picker ---
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseISO(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function toISO(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
function dayMs(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function sameDay(a, b) { return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function formatRange(s, e, lang = "en") {
  const months = MONTH_SHORT_I18N[lang] || MONTH_SHORT_I18N.en;
  if (!s && !e) return tr(lang, "pick_dates");
  if (s && !e) return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} → ${tr(lang, "pick_end_short")}`;
  if (!s && e) return `${tr(lang, "pick_start_short")} → ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  if (sameDay(s, e)) return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function CalendarMonth({ month, start, end, hover, phase, onPick, onHover }) {
  const lang = React.useContext(LangContext);
  const MONTHS = MONTH_NAMES_I18N[lang] || MONTH_NAMES_I18N.en;
  const WEEKS = WEEKDAYS_I18N[lang] || WEEKDAYS_I18N.en;
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const liveStart = phase === "start" && hover ? hover : start;
  const liveEnd = phase === "end" && hover && start ? hover : end;
  const rangeFrom = liveStart && liveEnd ? (dayMs(liveStart) <= dayMs(liveEnd) ? liveStart : liveEnd) : null;
  const rangeTo   = liveStart && liveEnd ? (dayMs(liveStart) <= dayMs(liveEnd) ? liveEnd : liveStart) : null;

  return (
    <div className="dp-month">
      <div className="dp-month-title">{MONTHS[m]} {year}</div>
      <div className="dp-wk">
        {WEEKS.map(w => <div key={w} className="dp-wk-cell">{w}</div>)}
      </div>
      <div className="dp-days">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="dp-cell empty" />;
          const t = dayMs(day);
          const isStart = sameDay(day, rangeFrom);
          const isEnd = sameDay(day, rangeTo);
          const inRange = rangeFrom && rangeTo && t > dayMs(rangeFrom) && t < dayMs(rangeTo);
          const isSingle = isStart && isEnd;
          const cls = [
            "dp-cell day",
            isStart && "is-start",
            isEnd && "is-end",
            inRange && "in-range",
            isSingle && "is-single"
          ].filter(Boolean).join(" ");
          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              onMouseLeave={() => onHover(null)}
            >{day.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePicker({ startISO, endISO, onChange }) {
  const lang = React.useContext(LangContext);
  const MONTHS = MONTH_NAMES_I18N[lang] || MONTH_NAMES_I18N.en;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("start");
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseISO(startISO) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  useClickOutside(ref, () => { setOpen(false); setPhase("start"); setHover(null); }, open);

  useEffect(() => {
    if (!open) return;
    const d = parseISO(startISO) || new Date();
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setPhase("start");
    setHover(null);
  }, [open]);

  const start = parseISO(startISO);
  const end = parseISO(endISO);

  const pick = (day) => {
    if (phase === "start") {
      const ns = toISO(day);
      let ne = endISO;
      if (end && dayMs(day) > dayMs(end)) ne = ns;
      onChange({ start: ns, end: ne });
      setPhase("end");
    } else {
      const ne = toISO(day);
      if (start && dayMs(day) < dayMs(start)) {
        onChange({ start: ne, end: toISO(start) });
      } else {
        onChange({ start: startISO || ne, end: ne });
      }
      setOpen(false);
      setPhase("start");
      setHover(null);
    }
  };

  return (
    <div className="dp-wrap" ref={ref}>
      <button
        className="dp-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M2 7 H14" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 1.5 V4 M11 1.5 V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>{formatRange(start, end, lang)}</span>
      </button>
      {open && <div className="mobile-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="dp-pop" role="dialog" aria-label={tr(lang, "pick_dates")}>
          <div className="dp-head">
            <button className="dp-nav-btn" onClick={() => setViewMonth(m => addMonths(m, -1))} aria-label={tr(lang, "prev_month")}>‹</button>
            <span className="dp-head-label">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              {" – "}
              {(() => { const n = addMonths(viewMonth, 1); return MONTHS[n.getMonth()] + " " + n.getFullYear(); })()}
            </span>
            <button className="dp-nav-btn" onClick={() => setViewMonth(m => addMonths(m, 1))} aria-label={tr(lang, "next_month")}>›</button>
          </div>
          <div className="dp-months">
            <CalendarMonth month={viewMonth}            start={start} end={end} hover={hover} phase={phase} onPick={pick} onHover={setHover} />
            <CalendarMonth month={addMonths(viewMonth, 1)} start={start} end={end} hover={hover} phase={phase} onPick={pick} onHover={setHover} />
          </div>
          <div className="dp-foot">
            <span className="dp-status">{tr(lang, phase === "start" ? "pick_start" : "pick_end")} · {tr(lang, "same_day_ok")}</span>
            <button className="dp-done" onClick={() => { setOpen(false); setPhase("start"); setHover(null); }}>{tr(lang, "done")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const GRACE_DAYS = 7; // server-side hard-delete this many days after tripEnd

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isTripOver(tripEndISO) {
  const end = parseISO(tripEndISO);
  if (!end) return false;
  return startOfToday().getTime() > dayMs(end);
}
function formatDateLong(d) {
  if (!d) return "—";
  return `${MONTH_NAMES_I18N.en[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// --- Budget opt-in card ---
function BudgetOptInCard({ tripEndISO, signedIn, onYes, onNo }) {
  const lang = React.useContext(LangContext);
  const end = parseISO(tripEndISO);
  const dateHint = end ? ` (${formatDateLong(end)})` : "";
  return (
    <section className="budget-cta">
      <h3 className="budget-cta-title">{tr(lang, "budget_cta_title")}</h3>
      <p className="budget-cta-desc">
        {tr(lang, "budget_cta_desc")}
      </p>
      <p className="budget-cta-note">
        <strong>{tr(lang, "budget_cta_note_label")}</strong>{" "}
        {tr(lang, "budget_cta_note_body", { date_hint: dateHint })}
      </p>
      <div className="budget-cta-actions">
        <button className="btn-primary" onClick={onYes}>
          {signedIn ? tr(lang, "budget_cta_yes_signed_in") : tr(lang, "budget_cta_yes_sign_in")}
        </button>
        <button className="btn-ghost" onClick={onNo}>{tr(lang, "budget_cta_no")}</button>
      </div>
    </section>
  );
}

// --- Expiry notice shown while tracking is on ---
function ExpiryNotice({ tripEndISO }) {
  const lang = React.useContext(LangContext);
  const end = parseISO(tripEndISO);
  if (!end) return null;
  return (
    <div className="expiry-notice">
      <svg className="expiry-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 4.5 V8 L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <span>
        {tr(lang, "expiry_notice", { date: formatDateLong(end) })}
      </span>
    </div>
  );
}

// --- PDF summary ---
function downloadTripSummaryPDF({ lang, tripName, tripStart, tripEnd, baseCode, baseSymbol, budget, spent }) {
  if (typeof window === "undefined" || !window.jspdf) {
    alert("PDF library failed to load. Try refreshing the page.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const start = parseISO(tripStart);
  const end = parseISO(tripEnd);
  const fmtMoney = (n) => `${baseSymbol}${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${baseCode}`;
  const l = lang || "en";

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(tr(l, "pdf_header"), 50, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(28);
  doc.setTextColor(20);
  doc.text(tripName || tr(l, "pdf_untitled"), 50, 100);

  doc.setFontSize(13);
  doc.setTextColor(80);
  const rangeLine = start && end
    ? formatRange(start, end)
    : tr(l, "pdf_no_dates");
  doc.text(rangeLine, 50, 124);

  doc.setDrawColor(220);
  doc.line(50, 150, 560, 150);

  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(tr(l, "pdf_budget"), 50, 180);
  doc.text(tr(l, "pdf_spent"), 50, 210);
  doc.text(tr(l, "pdf_remaining"), 50, 240);

  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(fmtMoney(budget), 200, 180);
  doc.text(fmtMoney(spent), 200, 210);
  doc.text(fmtMoney((budget || 0) - (spent || 0)), 200, 240);

  doc.setDrawColor(220);
  doc.line(50, 270, 560, 270);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(140);
  doc.text(
    tr(l, "pdf_footer", { date: formatDateLong(new Date()) }),
    50, 300, { maxWidth: 510 }
  );

  const safe = (tripName || "trip").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const stamp = end ? toISO(end) : toISO(new Date());
  doc.save(`plinkfx-${safe}-${stamp}.pdf`);
}

// --- Trip summary overlay (post-trip-end) ---
function TripSummaryOverlay({ t, onDownload, onDelete, onDismiss }) {
  const lang = React.useContext(LangContext);
  const start = parseISO(t.tripStart);
  const end = parseISO(t.tripEnd);
  const baseCode = (t.selectedCurrencies && t.selectedCurrencies[0]) || "USD";
  const baseSymbol = (CURRENCIES[baseCode] && CURRENCIES[baseCode].symbol) || "$";
  const fmtMoney = (n) => `${baseSymbol}${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${baseCode}`;
  return (
    <div className="summary-overlay" role="dialog" aria-modal="true">
      <div className="summary-card">
        <span className="summary-eyebrow">{tr(lang, "summary_eyebrow")}</span>
        <h2 className="trip-summary-title">{tr(lang, "summary_wrapped", { name: t.tripName || "Your trip" })}</h2>
        <p className="budget-cta-desc">
          {tr(lang, "summary_desc")}
        </p>
        <dl className="summary-grid">
          {start && end && <>
            <dt>{tr(lang, "summary_dates")}</dt><dd>{formatRange(start, end)}</dd>
          </>}
          <dt>{tr(lang, "summary_budget")}</dt><dd>{fmtMoney(t.budget)}</dd>
          <dt>{tr(lang, "summary_spent")}</dt><dd>{fmtMoney(t.spent)}</dd>
          <dt>{tr(lang, "summary_remaining")}</dt><dd>{fmtMoney((t.budget || 0) - (t.spent || 0))}</dd>
        </dl>
        <div className="summary-actions">
          <button className="btn-primary" onClick={onDownload}>{tr(lang, "summary_download")}</button>
          <button className="btn-ghost" onClick={onDelete}>{tr(lang, "summary_delete")}</button>
          {onDismiss && <button className="btn-ghost" onClick={onDismiss}>{tr(lang, "summary_later")}</button>}
        </div>
        <p className="summary-note">
          {tr(lang, "summary_grace", { n: GRACE_DAYS })}
        </p>
      </div>
    </div>
  );
}

// --- Main App ---
function App() {
  const [t, setTweakBase] = useTweaks(TWEAK_DEFAULTS);
  const { user, ready: authReady } = useSupabaseAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const hydratedLocalRef = useRef(false);
  const hydratedCloudFor = useRef(null);
  const cloudDebounceRef = useRef(null);
  const latestTRef = useRef(t);
  latestTRef.current = t;

  // Hydrate from localStorage on first mount
  useEffect(() => {
    if (hydratedLocalRef.current) return;
    hydratedLocalRef.current = true;
    try {
      const raw = localStorage.getItem(LOCAL_TWEAKS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setTweakBase(parsed);
    } catch (e) {}
  }, []);

  // When user signs in: pull cloud row or seed with current state if missing
  useEffect(() => {
    if (!authReady || !user || !supabaseClient) return;
    if (hydratedCloudFor.current === user.id) return;
    hydratedCloudFor.current = user.id;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseClient
        .from("user_tweaks")
        .select("tweaks")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data && data.tweaks) {
        setTweakBase(data.tweaks);
      } else if (!error) {
        await supabaseClient
          .from("user_tweaks")
          .insert({ user_id: user.id, tweaks: latestTRef.current });
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, user]);

  // Sign-out resets cloud hydration so a different user re-pulls.
  useEffect(() => { if (!user) hydratedCloudFor.current = null; }, [user]);

  const setTweak = useCallback((keyOrEdits, val) => {
    setTweakBase(keyOrEdits, val);
    const edits = typeof keyOrEdits === "object" && keyOrEdits !== null ? keyOrEdits : { [keyOrEdits]: val };
    const next = { ...latestTRef.current, ...edits };
    // Expense data (budget, spent) never touches localStorage — it lives only
    // in memory until the user signs in, then syncs to Supabase. After the
    // trip ends it's wiped server-side.
    try {
      const local = { ...next };
      delete local.budget;
      delete local.spent;
      localStorage.setItem(LOCAL_TWEAKS_KEY, JSON.stringify(local));
    } catch (e) {}
    if (user && supabaseClient) {
      if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
      cloudDebounceRef.current = setTimeout(() => {
        supabaseClient
          .from("user_tweaks")
          .upsert({ user_id: user.id, tweaks: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      }, 600);
    }
  }, [user, setTweakBase]);

  const signOut = useCallback(async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
  }, []);

  // --- Post-trip summary + data deletion ---
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const tripOver = isTripOver(t.tripEnd);
  const tracking = t.trackExpenses === "yes";
  const hasExpenseData = !!t.budget || !!t.spent;

  // Hard-delete: trip ended more than GRACE_DAYS ago → wipe locally and in cloud,
  // no questions asked, no UI shown.
  useEffect(() => {
    const end = parseISO(t.tripEnd);
    if (!end) return;
    const cutoff = new Date(end);
    cutoff.setDate(cutoff.getDate() + GRACE_DAYS);
    if (startOfToday().getTime() <= cutoff.getTime()) return;
    if (!hasExpenseData) return;
    setTweak({ budget: 0, spent: 0, trackExpenses: "ask" });
    if (user && supabaseClient) {
      supabaseClient.from("user_tweaks").delete().eq("user_id", user.id);
    }
  }, [t.tripEnd, user, hasExpenseData]);

  const downloadSummary = useCallback(() => {
    const baseCode = (t.selectedCurrencies && t.selectedCurrencies[0]) || "USD";
    const baseSymbol = (CURRENCIES[baseCode] && CURRENCIES[baseCode].symbol) || "$";
    downloadTripSummaryPDF({
      lang: effectiveLang,
      tripName: t.tripName,
      tripStart: t.tripStart,
      tripEnd: t.tripEnd,
      baseCode,
      baseSymbol,
      budget: t.budget,
      spent: t.spent,
    });
  }, [effectiveLang, t.tripName, t.tripStart, t.tripEnd, t.selectedCurrencies, t.budget, t.spent]);

  const deleteTripData = useCallback(async () => {
    if (user && supabaseClient) {
      await supabaseClient.from("user_tweaks").delete().eq("user_id", user.id);
    }
    setTweak({ budget: 0, spent: 0, trackExpenses: "ask" });
    setSummaryDismissed(true);
  }, [user, setTweak]);

  // --- Cookie consent + trip name persistence ---
  const [cookieConsent, setCookieConsent] = useState(() => cookieGet(COOKIE_CONSENT) === "1");
  const tripNameHydratedRef = useRef(false);

  // On first mount with consent already given, restore trip name from cookie
  useEffect(() => {
    if (tripNameHydratedRef.current) return;
    tripNameHydratedRef.current = true;
    if (cookieGet(COOKIE_CONSENT) === "1") {
      const saved = cookieGet(COOKIE_TRIP_NAME);
      if (saved) setTweakBase("tripName", saved);
    }
  }, []);

  // After consent, persist trip name to a cookie on every change
  useEffect(() => {
    if (!cookieConsent) return;
    if (!tripNameHydratedRef.current) return;
    if (t.tripName) cookieSet(COOKIE_TRIP_NAME, t.tripName);
  }, [t.tripName, cookieConsent]);

  const acceptCookies = useCallback(() => {
    cookieSet(COOKIE_CONSENT, "1");
    setCookieConsent(true);
    if (t.tripName) cookieSet(COOKIE_TRIP_NAME, t.tripName);
  }, [t.tripName]);

  const selected = t.selectedCurrencies || ["USD", "MXN", "CRC"];

  // Detect home; user can override
  const [detected] = useState(() => detectCurrency());
  const [manualHome, setManualHome] = useState(null);
  // Home must be one of the selected; if detected isn't, fall back to first selected
  let homeCode = !t.autoRegion && manualHome ? manualHome : detected;
  if (!selected.includes(homeCode)) homeCode = selected[0];

  // --- Language follows home, always ---
  // The language is whatever the home country's primary language is.
  // Spanish-speaking primaries → Spanish; everything else → English.
  // No user-facing pin, no prompt — just track the home.
  const effectiveLang = localeForCurrency(homeCode);
  const tt = useCallback((key, vars) => tr(effectiveLang, key, vars), [effectiveLang]);

  // Base = currency the user is typing in
  const [baseCode, setBaseCodeRaw] = useState(homeCode);
  const [amount, setAmount] = useState(() => {
    const r = FALLBACK_RATES[homeCode] || 1;
    return Math.round(20 * r);
  });
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState("");

  // Track OS color scheme so theme: "auto" follows the device
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  const effectiveTheme = t.theme === "auto" ? (systemDark ? "ink" : "paper") : t.theme;

  // Rates relative to USD (for everything we know about)
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [rateStatus, setRateStatus] = useState("loading");
  const [rateUpdated, setRateUpdated] = useState(null);
  const [provider, setProvider] = useState("");

  // Re-render time-ago every 30s
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender(x => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // If baseCode is no longer in selected, snap to home
  useEffect(() => {
    if (!selected.includes(baseCode)) {
      setBaseCodeRaw(homeCode);
      const r = rates[homeCode] || FALLBACK_RATES[homeCode] || 1;
      setAmount(Math.round(20 * r));
    }
  }, [selected, baseCode, homeCode, rates]);

  // When home changes, refresh amount sensibly
  const prevHome = useRef(homeCode);
  useEffect(() => {
    if (prevHome.current !== homeCode) {
      setBaseCodeRaw(homeCode);
      const r = rates[homeCode] || FALLBACK_RATES[homeCode] || 1;
      setAmount(Math.round(20 * r));
      prevHome.current = homeCode;
    }
  }, [homeCode, rates]);

  // Fetch live rates (open.er-api returns all currencies on USD base)
  const fetchRates = useCallback(async () => {
    setRateStatus("loading");
    const tryFetch = async (url, parser) => {
      try {
        const ctl = new AbortController();
        const tm = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(url, { signal: ctl.signal });
        clearTimeout(tm);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        return parser(j);
      } catch (e) { return null; }
    };
    let result = await tryFetch(
      "https://open.er-api.com/v6/latest/USD",
      (j) => j && j.result === "success" ? {
        rates: { ...FALLBACK_RATES, ...j.rates, USD: 1 },
        updated: j.time_last_update_utc ? new Date(j.time_last_update_utc) : new Date(),
        provider: "open.er-api.com"
      } : null
    );
    if (!result) {
      result = await tryFetch(
        "https://api.exchangerate.host/latest?base=USD",
        (j) => j && j.rates ? {
          rates: { ...FALLBACK_RATES, ...j.rates, USD: 1 },
          updated: j.date ? new Date(j.date) : new Date(),
          provider: "exchangerate.host"
        } : null
      );
    }
    if (result) {
      setRates(result.rates);
      setRateUpdated(result.updated);
      setProvider(result.provider);
      setRateStatus("live");
    } else {
      setRateStatus("fallback");
      setRateUpdated(new Date());
      setProvider("cached");
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchRates]);

  const onAmountChange = (val) => {
    const clean = val.replace(/[^\d.]/g, "");
    setRawInput(clean);
    const num = parseFloat(clean) || 0;
    setAmount(num);
  };
  const setBaseCode = (next) => {
    const usd = amount / (rates[baseCode] || 1);
    setBaseCodeRaw(next);
    setAmount(usd * (rates[next] || 1));
  };

  const rateFromBase = (target) => rates[target] / rates[baseCode];

  // CSS vars for all selected currencies + a few fixed shorthands
  const cssVars = {};
  Object.keys(CURRENCIES).forEach(code => {
    cssVars[`--c-${code}`] = accentFor(code, t.accent);
  });

  const others = selected.filter(c => c !== baseCode);
  const cardCount = others.length;

  return (
    <LangContext.Provider value={effectiveLang}>
    <div className={"app theme-" + t.theme} style={cssVars}>
      <header className="trip-header">
        <div className="trip-mark">
          <a href="/freeware" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "var(--ink-2)", textDecoration: "none", marginBottom: "4px", width: "fit-content" }}>{tt("nav_more")}</a>
          <div className="trip-credit">
            {tt("mark_credit")} <a href="https://acaciaco.com.mx/" target="_blank" rel="noopener noreferrer">ACACIA Consultoria</a>
            <span className="trip-free">{tt("mark_free")}</span>
          </div>
          <span>Plink FX</span>
        </div>
        <div className="trip-info">
          <input
            className="trip-name trip-edit"
            value={t.tripName}
            onChange={(e) => setTweak("tripName", e.target.value)}
            aria-label="Trip name"
            placeholder="Untitled trip"
          />
          <div className="trip-route">
            {selected.map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && <span className="trip-arrow">·</span>}
                <span className="trip-leg"><span className="leg-dot" style={{background:`var(--c-${c})`}}/>{CURRENCIES[c].name}</span>
              </React.Fragment>
            ))}
          </div>
          <DateRangePicker
            startISO={t.tripStart}
            endISO={t.tripEnd}
            onChange={({ start, end }) => {
              const edits = {};
              if (start !== t.tripStart) edits.tripStart = start;
              if (end !== t.tripEnd) edits.tripEnd = end;
              if (Object.keys(edits).length) setTweak(edits);
            }}
          />
        </div>
        <div className="trip-rates">
          <AuthButton user={user} onOpen={() => setAuthOpen(true)} onSignOut={signOut} />
          <button className="rate-refresh" onClick={fetchRates} title={tt("rate_refresh")}>
            <span className={"pulse-dot " + rateStatus}/>
            {rateStatus === "loading" && tt("rate_loading")}
            {rateStatus === "live" && <>{tt("rate_live")} · <span className="rate-ago">{timeAgo(rateUpdated)}</span></>}
            {rateStatus === "fallback" && tt("rate_offline")}
            <svg viewBox="0 0 16 16" width="11" height="11" className="refresh-icon"><path d="M3 8a5 5 0 0 1 8.5-3.5L13 3v4H9l1.6-1.6A3.5 3.5 0 0 0 4.5 8H3zm10 0a5 5 0 0 1-8.5 3.5L3 13V9h4l-1.6 1.6A3.5 3.5 0 0 0 11.5 8H13z" fill="currentColor"/></svg>
          </button>
          <div className="trip-source">{provider && `via ${provider}`}</div>
        </div>
      </header>

      {/* Currency picker — pick up to 5 */}
      <div className="picker-bar">
        <div className="picker-bar-inner">
          <div className="picker-label">
            <span className="picker-label-title">{tt("tracking_label")}</span>
            <span className="picker-label-sub">{tt("tracking_sub")}</span>
          </div>
          <CurrencyPicker
            selected={selected}
            onChange={(next) => setTweak("selectedCurrencies", next)}
            max={MAX_CURRENCIES}
          />
        </div>
      </div>

      {/* Home / "I'm in" */}
      <div className="region-bar">
        <div className="region-bar-inner">
          <span className="region-label">{tt("im_in")}</span>
          <div className="region-toggle">
            {selected.map(c => (
              <button
                key={c}
                className={"region-btn" + (homeCode === c ? " active" : "")}
                onClick={() => { setTweak("autoRegion", false); setManualHome(c); }}
                style={{ "--accent": `var(--c-${c})` }}
              >
                <FlagMark code={c} size={20} />
                <span>{CURRENCIES[c].name}</span>
                <span className="region-code mono">{c}</span>
              </button>
            ))}
          </div>
          {t.autoRegion && (
            <span className="region-auto">
              <span className="auto-dot"/>
              {tt("auto_detected")}
            </span>
          )}
          {!t.autoRegion && (
            <button className="region-reset" onClick={() => { setTweak("autoRegion", true); setManualHome(null); }}>
              {tt("reset_to_auto")}
            </button>
          )}
        </div>
      </div>

      <main className="main">
        <section className="amount-section">
          <div className="amount-label">
            <span>{tt("youre_spending")}</span>
            <div className="dir-toggle" role="tablist" aria-label="Input currency">
              {selected.map(d => (
                <button
                  key={d}
                  className={"dir-btn" + (baseCode === d ? " active" : "")}
                  onClick={() => setBaseCode(d)}
                  style={{ "--accent": `var(--c-${d})` }}
                >{d}</button>
              ))}
            </div>
          </div>

          <div className={"amount-input-wrap" + (focused ? " focused" : "")} style={{ "--accent": `var(--c-${baseCode})` }}>
            <span className="amount-symbol">{CURRENCIES[baseCode].symbol}</span>
            <input
              className="amount-input mono"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              value={focused ? rawInput : fmt(amount, baseCode)}
              onChange={(e) => onAmountChange(e.target.value)}
              onFocus={(e) => {
                const raw = amount === 0 ? "" : String(amount);
                setRawInput(raw);
                setFocused(true);
                requestAnimationFrame(() => e.target.select());
              }}
              onBlur={() => {
                setFocused(false);
                setRawInput("");
              }}
            />
            <span className="amount-code">{baseCode}</span>
          </div>

          <QuickAmounts onPick={setAmount} baseCode={baseCode} current={amount} />
        </section>

        <section className={"conv-grid count-" + cardCount}>
          {others.map(code => (
            <ConvCard
              key={code}
              code={code}
              baseCode={baseCode}
              rate={rateFromBase(code)}
              baseAmount={amount}
              isHome={code === homeCode}
            />
          ))}
          {cardCount === 0 && (
            <div className="conv-empty">
              <p>{tt("add_another_currency")}</p>
            </div>
          )}
        </section>

        {t.showBudget && t.trackExpenses !== "no" && (
          t.trackExpenses === "yes" && user ? (
            <section>
              <ExpiryNotice tripEndISO={t.tripEnd} />
              <BudgetBar
                budget={t.budget}
                spent={t.spent}
                baseAmount={amount}
                baseCode={baseCode}
                rates={rates}
                otherCodes={others}
              />
            </section>
          ) : (
            <BudgetOptInCard
              tripEndISO={t.tripEnd}
              signedIn={!!user}
              onYes={() => {
                setTweak("trackExpenses", "yes");
                if (!user) setAuthOpen(true);
              }}
              onNo={() => setTweak("trackExpenses", "no")}
            />
          )
        )}

        {t.showCosts && others.some(c => COSTS[c]) && (
          <section className="costs-section">
            <div className="section-head">
              <h2>{tt("costs_heading")}</h2>
              <p>{tt("costs_desc", { base: baseCode })}</p>
            </div>
            <CostsTable baseCode={baseCode} baseAmount={amount} rates={rates} others={others} />
          </section>
        )}

        <footer className="foot">
          <span>
            {rateStatus === "live" && <>{tt("rates_live_prefix")} <strong>{provider}</strong> · {tt("rates_last")} {timeAgo(rateUpdated)}</>}
            {rateStatus === "fallback" && <>{tt("rates_fallback")}</>}
            {rateStatus === "loading" && <>{tt("rates_fetching")}</>}
          </span>
          <span className="foot-sep">·</span>
          <span>{tt("foot_travel_only")}</span>
          <span className="foot-sep">·</span>
          <span>{tt("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {tt("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoria</a></span>
        </footer>
      </main>

      <TweaksPanel title="Trip Tweaks">
        <TweakSection title="Trip">
          <TweakText label="Trip name" value={t.tripName} onChange={v => setTweak("tripName", v)} />
          <div style={{fontSize:11, color:"var(--ink-3)", padding:"4px 2px", lineHeight:1.5}}>
            Dates are picked from the calendar in the header.<br/>
            Current: <strong style={{color:"var(--ink)"}}>{t.tripStart || "—"}</strong> → <strong style={{color:"var(--ink)"}}>{t.tripEnd || "—"}</strong>
          </div>
        </TweakSection>
        <TweakSection title="Region">
          <TweakToggle label="Auto-detect home (timezone)" value={t.autoRegion} onChange={v => { setTweak("autoRegion", v); if (v) setManualHome(null); }} />
          <div style={{fontSize:11, color:"var(--ink-3)", padding:"4px 2px"}}>
            Detected: <strong style={{color:"var(--ink)"}}>{detected}</strong> · Active: <strong style={{color:"var(--ink)"}}>{homeCode}</strong>
          </div>
        </TweakSection>
        <TweakSection title="Budget">
          <TweakNumber label="Total budget (USD)" value={t.budget} step={50} onChange={v => setTweak("budget", v)} />
          <TweakNumber label="Spent so far (USD)" value={t.spent} step={10} onChange={v => setTweak("spent", v)} />
          <TweakToggle label="Show budget bar" value={t.showBudget} onChange={v => setTweak("showBudget", v)} />
          <TweakToggle label="Show local cost table" value={t.showCosts} onChange={v => setTweak("showCosts", v)} />
        </TweakSection>
        <TweakSection title="Look">
          <TweakRadio label="Theme" value={t.theme} options={[{value:"auto",label:"Auto"},{value:"paper",label:"Paper"},{value:"ink",label:"Ink"}]} onChange={v => setTweak("theme", v)} />
          {t.theme === "auto" && (
            <div style={{fontSize:11, color:"var(--ink-3)", padding:"4px 2px"}}>
              Following device: <strong style={{color:"var(--ink)"}}>{systemDark ? "Dark" : "Light"}</strong>
            </div>
          )}
          <TweakSelect label="Accent palette" value={t.accent} options={[
            {value:"warm",label:"Warm (default)"},
            {value:"jewel",label:"Jewel"},
            {value:"pastel",label:"Pastel"},
            {value:"mono",label:"Monochrome"}
          ]} onChange={v => setTweak("accent", v)} />
        </TweakSection>
        <TweakSection title="Rates">
          <TweakButton label="Refresh now" onClick={fetchRates} />
          <div style={{fontSize:11, color:"var(--ink-3)", padding:"4px 2px", lineHeight:1.5}}>
            Auto-refreshed every 10 min.<br/>
            Source: {provider || "—"}<br/>
            Updated: {rateUpdated ? rateUpdated.toLocaleString() : "—"}
          </div>
        </TweakSection>
      </TweaksPanel>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {tripOver && tracking && hasExpenseData && !summaryDismissed && (
        <TripSummaryOverlay
          t={t}
          onDownload={downloadSummary}
          onDelete={deleteTripData}
          onDismiss={() => setSummaryDismissed(true)}
        />
      )}

      {!cookieConsent && (
        <div className="cookie-banner" role="region" aria-label={tt("cookie_title")}>
          <div className="cookie-banner-inner">
            <div className="cookie-banner-text">
              <strong>{tt("cookie_title")}</strong> · {tt("cookie_text")}
            </div>
            <button className="cookie-accept" onClick={acceptCookies}>{tt("cookie_ok")}</button>
          </div>
        </div>
      )}

    </div>
    </LangContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
