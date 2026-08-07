/* Gastos de Viaje — interfaz. ACACIA freeware.
 * 100% en el navegador: los montos, las fotos y el PDF nunca se suben. ES/EN.
 * El panel de la derecha no es un widget de totales: es la carátula del reporte
 * que se va a descargar, con el mismo encabezado y las mismas cifras. */

const { useState, useEffect, useMemo, useCallback, useRef } = React
const C = window.GVCalc
const Store = window.GVStore

const STRINGS = {
  es: {
    nav_more: "← Más herramientas", theme_label: "Cambiar tema", lang_label: "Idioma",
    eyebrow: "Herramienta gratis",
    h1: "Reporte de ", h1b: "gastos de viaje",
    hero_p: "Captura cada gasto con su comprobante, resta el anticipo y descarga el PDF listo para entregar. Sin registro y sin subir nada.",
    privacy_chip: "Los montos, tus tickets y el PDF no salen de tu navegador.",

    trip: "Datos del viaje",
    traveler: "Viajero", traveler_ph: "Nombre completo",
    employeeId: "No. de empleado", employeeId_ph: "Opcional",
    company: "Empresa", company_ph: "A quién se entrega el reporte",
    destination: "Destino", destination_ph: "Monterrey, N.L.",
    purpose: "Motivo del viaje", purpose_ph: "Visita a cliente, congreso…",
    dateFrom: "Salida", dateTo: "Regreso",
    currency: "Moneda del reporte",
    advance: "Anticipo recibido", advance_hint: "Lo que te entregaron antes del viaje",
    notes: "Notas (opcional)", notes_ph: "Cualquier aclaración para quien autoriza.",

    expenses: "Gastos", add_expense: "Agregar gasto",
    empty: "Aún no hay gastos. Agrega el primero y aparecerá aquí con su comprobante.",
    e_date: "Fecha", e_category: "Categoría", e_description: "Descripción",
    e_description_ph: "Hotel Centro, 2 noches",
    e_amount: "Consumo", e_tip: "Propina", e_currency: "Moneda",
    e_fx: "Tipo de cambio",
    e_fx_hint: "1 {cur} = ? {base}", e_fx_suggest: "Traer del día",
    e_fx_missing: "Falta el tipo de cambio",
    e_how_paid: "Cómo se pagó",
    pay_efectivo: "Efectivo", pay_tdc_propia: "Mi tarjeta", pay_tdc_empresa: "Tarjeta empresa",
    consequence_efectivo: "Sale de tu anticipo.",
    consequence_tdc_propia: "Lo pusiste tú: se te reembolsa.",
    consequence_tdc_propia_adv: "Lo cubres con el anticipo que traes: no te lo transfieren.",
    from_advance: "Tomarlo del anticipo",
    from_advance_hint: "quedan {n}",
    from_advance_partial: "alcanza para {n} de este cargo",
    consequence_tdc_empresa: "Ya lo pagó la empresa: no afecta tu saldo.",
    e_invoiced: "Con factura",
    e_tax: "IVA", e_tax_auto: "se calcula solo, edítalo si difiere",
    e_tax_none: "Sin factura no hay IVA que acreditar.",
    e_delete: "Eliminar gasto",
    receipt_add: "Adjuntar comprobante", receipt_change: "Cambiar", receipt_remove: "Quitar",
    receipt_none: "Sin comprobante",
    incomplete: "Falta información",

    cat_transporte_largo: "Avión o autobús", cat_hospedaje: "Hospedaje",
    cat_alimentos: "Alimentos", cat_transporte_local: "Transporte local",
    cat_combustible: "Combustible y casetas", cat_otros: "Otros",

    doc_kicker: "Reporte de gastos", doc_untitled: "Viaje sin destino",
    doc_noname: "Sin viajero", doc_period: "Sin fechas",
    f_total: "Total del viaje", f_tax: "IVA acreditable", f_advance: "Anticipo",
    f_settleable: "A liquidar contigo",
    f_transfer: "Te transfieren", f_return: "Devuelves en efectivo",
    f_how_settled: "Cómo se salda",
    bal_refund: "Te deben", bal_return: "Debes devolver", bal_settled: "Cuentas saldadas",
    download: "Descargar reporte (PDF)", download_busy: "Armando el PDF…",
    csv: "CSV", json_export: "Guardar .json", json_import: "Abrir .json",
    reset: "Nuevo reporte",
    warn_incomplete: "{n} gasto(s) sin fecha, sin monto o sin tipo de cambio. Se incluyen tal cual.",
    warn_nostore: "Tu navegador no está guardando el reporte. Si recargas, se pierde: descarga el .json antes de cerrar.",
    warn_quota: "Ya no cabe más en este navegador. Descarga el .json y quita algún comprobante.",
    err_receipt_type: "Ese archivo no se puede adjuntar. Usa JPG, PNG, WebP o PDF.",
    err_receipt_read: "Tu navegador no puede leer ese archivo. Si es HEIC de iPhone, compártelo como JPG.",
    err_json: "Ese archivo no es un reporte de esta herramienta.",
    err_pdf: "No se pudo armar el PDF. Revisa los comprobantes adjuntos.",
    confirm_reset: "Se borra el reporte actual y sus comprobantes. ¿Seguir?",

    disclaimer: "<strong>El reporte no es un documento fiscal.</strong> Es el formato de comprobación que entregas a tu empresa; los comprobantes fiscales siguen siendo los CFDI de cada proveedor. Todo se calcula y se genera en tu navegador.",
    cta_h3: "¿Tu empresa sigue comprobando viáticos por correo?",
    cta_p: "En ACACIA implementamos finanzas, gastos e inventario para PyMEs. Hablemos.",
    cta_btn: "Hablar con ACACIA",
    faq_title: "Preguntas frecuentes",
    faq: [
      ["¿Sirve para comprobar viáticos ante mi empresa?", "Sí. El PDF trae carátula con el saldo a reembolsar, la tabla de gastos con fecha, categoría e IVA, líneas de firma para quien elabora y quien autoriza, y un anexo con cada comprobante en su propia página."],
      ["¿Mis tickets se suben a algún servidor?", "No. Las fotos, los montos y el PDF se procesan por completo en tu navegador. Nada se envía a ningún servidor y no se necesita cuenta."],
      ["¿Puedo capturar gastos en dólares?", "Sí. Cada gasto lleva su moneda y su tipo de cambio, y el reporte convierte todo a la moneda que elijas. Para dólares a pesos puedes traer el tipo de cambio del día con un clic; cualquier otro par se captura a mano."],
      ["¿Puedo seguir la captura en otra computadora?", "Sí. Guarda el .json —incluye los comprobantes— y ábrelo desde el otro equipo."],
    ],
    foot_free: "© 2026 ACACIA · Herramienta gratis", foot_tools: "Herramientas",
    foot_privacy: "Privacidad", foot_contact: "Contacto",
    foot_crafted: "hecho con", foot_by: "por",

    pdf_kicker: "ACACIA · Comprobación de viáticos",
    pdf_title: "Reporte de gastos de viaje",
    pdf_traveler: "Viajero", pdf_employee: "No. de empleado", pdf_company: "Empresa",
    pdf_destination: "Destino", pdf_period: "Periodo", pdf_purpose: "Motivo",
    pdf_total: "Total del viaje", pdf_tax: "IVA acreditable", pdf_advance: "Anticipo recibido",
    pdf_settleable: "A liquidar con el viajero",
    pdf_how_settled: "Cómo se salda",
    pdf_transfer: "Se le transfiere", pdf_return: "Devuelve en efectivo",
    pdf_adv_mark: "* Cubierto con el anticipo.",
    pdf_pay_efectivo: "En efectivo", pdf_pay_tdc_propia: "Con tarjeta del viajero",
    pdf_pay_tdc_empresa: "Con tarjeta de la empresa",
    pdf_bal_refund: "Saldo a reembolsar al viajero",
    pdf_bal_return: "Saldo a devolver a la empresa",
    pdf_bal_settled: "Cuentas saldadas",
    pdf_notes: "Notas",
    pdf_table_title: "Detalle de gastos", pdf_table_title_cont: "Detalle de gastos (continúa)",
    pdf_col_date: "Fecha", pdf_col_category: "Categoría", pdf_col_description: "Descripción",
    pdf_col_currency: "Mon.", pdf_col_fx: "TC", pdf_col_amount: "Importe",
    pdf_col_tax: "IVA", pdf_col_payment: "Pago", pdf_col_tip: "Propina",
    pdf_short_efectivo: "Efectivo", pdf_short_tdc_propia: "T. viajero",
    pdf_short_tdc_empresa: "T. empresa",
    pdf_yes: "Sí", pdf_count: "{n} gasto(s)",
    pdf_signed_by: "Elaboró (viajero)", pdf_approved_by: "Autorizó",
    pdf_annex_title: "ANEXO DE COMPROBANTES",
    pdf_annex_item: "Gasto #{n} · {date} · {cat} · {amount}",
    pdf_annex_failed: "No se pudo incrustar este comprobante.",
    pdf_footer: "Generado en acaciaco.com.mx/freeware/gastos-viaje",
    csv_date: "Fecha", csv_category: "Categoría", csv_description: "Descripción",
    csv_currency: "Moneda", csv_amount: "Monto", csv_fx: "Tipo de cambio",
    csv_converted: "Importe", csv_tax: "IVA", csv_invoiced: "Con factura",
    csv_payment: "Pago", csv_tip: "Propina", csv_settles: "Cuenta al saldo",
    csv_from_advance: "Del anticipo",
  },
  en: {
    nav_more: "← More tools", theme_label: "Toggle theme", lang_label: "Language",
    eyebrow: "Free tool",
    h1: "Travel ", h1b: "expense report",
    hero_p: "Log every expense with its receipt, subtract the advance and download the PDF ready to hand in. No sign-up, nothing uploaded.",
    privacy_chip: "Amounts, receipts and the PDF never leave your browser.",

    trip: "Trip details",
    traveler: "Traveler", traveler_ph: "Full name",
    employeeId: "Employee ID", employeeId_ph: "Optional",
    company: "Company", company_ph: "Who receives the report",
    destination: "Destination", destination_ph: "Monterrey, MX",
    purpose: "Purpose", purpose_ph: "Client visit, conference…",
    dateFrom: "Departure", dateTo: "Return",
    currency: "Report currency",
    advance: "Advance received", advance_hint: "What you were given before the trip",
    notes: "Notes (optional)", notes_ph: "Anything the approver should know.",

    expenses: "Expenses", add_expense: "Add expense",
    empty: "No expenses yet. Add the first one and it shows up here with its receipt.",
    e_date: "Date", e_category: "Category", e_description: "Description",
    e_description_ph: "Hotel Centro, 2 nights",
    e_amount: "Charge", e_tip: "Tip", e_currency: "Currency",
    e_fx: "Exchange rate",
    e_fx_hint: "1 {cur} = ? {base}", e_fx_suggest: "Today's rate",
    e_fx_missing: "Exchange rate missing",
    e_how_paid: "How it was paid",
    pay_efectivo: "Cash", pay_tdc_propia: "My card", pay_tdc_empresa: "Company card",
    consequence_efectivo: "Comes out of your advance.",
    consequence_tdc_propia: "You fronted it: you get reimbursed.",
    consequence_tdc_propia_adv: "Covered by the advance you are holding: nothing gets transferred.",
    from_advance: "Take it from the advance",
    from_advance_hint: "{n} left",
    from_advance_partial: "covers {n} of this charge",
    consequence_tdc_empresa: "The company already paid: your balance is untouched.",
    e_invoiced: "Has an invoice",
    e_tax: "Tax", e_tax_auto: "worked out for you, edit if it differs",
    e_tax_none: "No invoice, no tax to credit.",
    e_delete: "Delete expense",
    receipt_add: "Attach receipt", receipt_change: "Replace", receipt_remove: "Remove",
    receipt_none: "No receipt",
    incomplete: "Missing information",

    cat_transporte_largo: "Flight or bus", cat_hospedaje: "Lodging",
    cat_alimentos: "Meals", cat_transporte_local: "Local transport",
    cat_combustible: "Fuel and tolls", cat_otros: "Other",

    doc_kicker: "Expense report", doc_untitled: "Trip with no destination",
    doc_noname: "No traveler", doc_period: "No dates",
    f_total: "Trip total", f_tax: "Creditable tax", f_advance: "Advance",
    f_settleable: "To settle with you",
    f_transfer: "Transferred to you", f_return: "Cash you hand back",
    f_how_settled: "How it settles",
    bal_refund: "You are owed", bal_return: "You must return", bal_settled: "All settled",
    download: "Download report (PDF)", download_busy: "Building the PDF…",
    csv: "CSV", json_export: "Save .json", json_import: "Open .json",
    reset: "New report",
    warn_incomplete: "{n} expense(s) missing a date, an amount or a rate. They are included as-is.",
    warn_nostore: "Your browser isn't saving this report. Reloading loses it: download the .json before you close.",
    warn_quota: "This browser is out of room. Download the .json and remove a receipt.",
    err_receipt_type: "That file can't be attached. Use JPG, PNG, WebP or PDF.",
    err_receipt_read: "Your browser can't read that file. If it's an iPhone HEIC, share it as JPG.",
    err_json: "That file isn't a report from this tool.",
    err_pdf: "The PDF couldn't be built. Check the attached receipts.",
    confirm_reset: "This clears the current report and its receipts. Continue?",

    disclaimer: "<strong>The report is not a tax document.</strong> It's the expense form you hand to your company; the tax receipts are still each supplier's invoices. Everything is calculated and generated in your browser.",
    cta_h3: "Still settling travel expenses over email?",
    cta_p: "At ACACIA we implement finance, expenses and inventory for SMBs. Let's talk.",
    cta_btn: "Talk to ACACIA",
    faq_title: "FAQ",
    faq: [
      ["Does this work for company expense reports?", "Yes. The PDF has a cover with the reimbursement balance, the expense table with date, category and tax, signature lines for preparer and approver, and an annex with each receipt on its own page."],
      ["Are my receipts uploaded anywhere?", "No. Photos, amounts and the PDF are handled entirely in your browser. Nothing is sent to a server and no account is needed."],
      ["Can I log expenses in another currency?", "Yes. Each expense carries its currency and exchange rate, and the report converts everything to the currency you pick. USD to MXN can pull today's rate in one click; any other pair is entered by hand."],
      ["Can I continue on another computer?", "Yes. Save the .json — it includes the receipts — and open it on the other machine."],
    ],
    foot_free: "© 2026 ACACIA · Free tool", foot_tools: "Tools",
    foot_privacy: "Privacy", foot_contact: "Contact",
    foot_crafted: "crafted with", foot_by: "by",

    pdf_kicker: "ACACIA · Travel expense settlement",
    pdf_title: "Travel expense report",
    pdf_traveler: "Traveler", pdf_employee: "Employee ID", pdf_company: "Company",
    pdf_destination: "Destination", pdf_period: "Period", pdf_purpose: "Purpose",
    pdf_total: "Trip total", pdf_tax: "Creditable tax", pdf_advance: "Advance received",
    pdf_settleable: "To settle with the traveler",
    pdf_how_settled: "How it settles",
    pdf_transfer: "Transferred to them", pdf_return: "Cash handed back",
    pdf_adv_mark: "* Covered by the advance.",
    pdf_pay_efectivo: "In cash", pdf_pay_tdc_propia: "On the traveler's card",
    pdf_pay_tdc_empresa: "On the company card",
    pdf_bal_refund: "Balance to reimburse the traveler",
    pdf_bal_return: "Balance to return to the company",
    pdf_bal_settled: "All settled",
    pdf_notes: "Notes",
    pdf_table_title: "Expense detail", pdf_table_title_cont: "Expense detail (continued)",
    pdf_col_date: "Date", pdf_col_category: "Category", pdf_col_description: "Description",
    pdf_col_currency: "Curr.", pdf_col_fx: "Rate", pdf_col_amount: "Amount",
    pdf_col_tax: "Tax", pdf_col_payment: "Paid", pdf_col_tip: "Tip",
    pdf_short_efectivo: "Cash", pdf_short_tdc_propia: "Own card",
    pdf_short_tdc_empresa: "Co. card",
    pdf_yes: "Yes", pdf_count: "{n} expense(s)",
    pdf_signed_by: "Prepared by (traveler)", pdf_approved_by: "Approved by",
    pdf_annex_title: "RECEIPT ANNEX",
    pdf_annex_item: "Expense #{n} · {date} · {cat} · {amount}",
    pdf_annex_failed: "This receipt could not be embedded.",
    pdf_footer: "Generated at acaciaco.com.mx/freeware/gastos-viaje",
    csv_date: "Date", csv_category: "Category", csv_description: "Description",
    csv_currency: "Currency", csv_amount: "Amount", csv_fx: "Rate",
    csv_converted: "Converted", csv_tax: "Tax", csv_invoiced: "Has invoice",
    csv_payment: "Payment", csv_tip: "Tip", csv_settles: "Counts to balance",
    csv_from_advance: "From advance",
  },
}

function makeT(lang) {
  return (k, v) => {
    let s = (STRINGS[lang] && STRINGS[lang][k]) != null ? STRINGS[lang][k]
      : (STRINGS.es[k] != null ? STRINGS.es[k] : k)
    if (v && typeof s === "string") for (const x in v) s = s.split("{" + x + "}").join(v[x])
    return s
  }
}

function detectLang() {
  try { const s = localStorage.getItem("acacia-lang"); if (s === "es" || s === "en") return s } catch (e) {}
  return (navigator.language || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es"
}

const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const SYMBOLS = { MXN: "$", USD: "$", CAD: "$", CLP: "$", COP: "$", ARS: "$", EUR: "€", GBP: "£", BRL: "R$" }
const symbolFor = (c) => SYMBOLS[c] || ""

function emptyReport() {
  return {
    v: 2,
    trip: {
      traveler: "", employeeId: "", company: "", destination: "", purpose: "",
      dateFrom: "", dateTo: "", currency: "MXN", advance: "", notes: "",
    },
    expenses: [],
    updatedAt: null,
  }
}

function newExpense(currency) {
  return {
    id: Store.uid(), date: "", category: "alimentos", description: "",
    amount: "", tip: "", currency: currency, fx: "", payment: "efectivo",
    invoiced: false, taxAmount: "", fromAdvance: false,
    receiptId: null, receiptName: "", receiptType: "",
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
}

// Reporta la exportación a Mission Control como una ruta virtual. Es el único
// dato que sale de aquí: que alguien terminó su reporte. Ni montos ni nombres.
function trackExport() {
  try {
    const img = new Image(1, 1)
    img.src = "https://control.acaciaco.com.mx/api/track?p=" +
      encodeURIComponent("/freeware/gastos-viaje/exportado") +
      "&h=" + encodeURIComponent(location.host) + "&t=" + Date.now()
  } catch (e) {}
}

function Icon({ name }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }
  if (name === "download") return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  if (name === "trash") return <svg {...common}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
  if (name === "lock") return <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  if (name === "moon") return <svg {...common} className="moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
  if (name === "sun") return <svg {...common} className="sun"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  return null
}

function ReceiptThumb({ expense, t }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let dead = false, made = null
    if (expense.receiptId && expense.receiptType && expense.receiptType.indexOf("image/") === 0) {
      Store.getReceipt(expense.receiptId).then((rec) => {
        if (dead || !rec) return
        made = URL.createObjectURL(rec.blob)
        setUrl(made)
      })
    } else setUrl(null)
    return () => { dead = true; if (made) URL.revokeObjectURL(made) }
  }, [expense.receiptId, expense.receiptType])

  if (!expense.receiptId) return null
  return (
    <div className="receipt-thumb">
      {url ? <img src={url} alt="" /> : <span>PDF</span>}
    </div>
  )
}

// Los días del viaje como botones. Se listan sólo si el rango es corto: en un
// viaje de tres semanas, veintiún botones estorban más de lo que ayudan y el
// calendario nativo vuelve a ser lo correcto.
const MAX_DAY_CHIPS = 10
function tripDays(trip) {
  if (!trip.dateFrom || !trip.dateTo) return []
  const from = new Date(trip.dateFrom + "T00:00:00")
  const to = new Date(trip.dateTo + "T00:00:00")
  if (isNaN(from) || isNaN(to) || to < from) return []
  const days = []
  for (let d = new Date(from); d <= to && days.length <= MAX_DAY_CHIPS; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days.length > MAX_DAY_CHIPS ? [] : days
}

function DayPicker({ value, days, lang, onPick, onChange }) {
  const fmt = (iso) => {
    const d = new Date(iso + "T00:00:00")
    return {
      dow: d.toLocaleDateString(lang === "en" ? "en-US" : "es-MX", { weekday: "short" }).replace(".", ""),
      num: d.getDate(),
    }
  }
  return (
    <div className="daypick">
      {days.map((iso) => {
        const { dow, num } = fmt(iso)
        return (
          <button type="button" key={iso} className="day" aria-pressed={value === iso}
            onClick={() => onPick(iso)}>
            <em>{dow}</em>{num}
          </button>
        )
      })}
      <input type="date" value={value} onChange={onChange} />
    </div>
  )
}

function ExpenseRow({ expense, index, reportCurrency, trip, lang, coverage, t, onChange, onDelete, onAttach, onDetach, onSuggestFx }) {
  const fileRef = useRef(null)
  const set = (k) => (ev) => {
    const v = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value
    onChange({ ...expense, [k]: v })
  }
  const foreign = expense.currency !== reportCurrency
  const flagged = C.isIncomplete(expense, reportCurrency)
  const canSuggest = expense.currency === "USD" && reportCurrency === "MXN"
  const withTip = C.allowsTip(expense.category)
  const days = useMemo(() => tripDays(trip), [trip.dateFrom, trip.dateTo])

  // Lo que quedaba del anticipo justo antes de este gasto, ya descontado el
  // efectivo y lo que se llevaron los cargos marcados antes que él.
  const available = (coverage && coverage.availableBefore) || 0
  const ownSym = symbolFor(expense.currency)
  const grossOwn = C.toCents(expense.amount) + (withTip ? C.toCents(expense.tip) : 0)
  const grossReport = C.expenseGrossCents(expense, reportCurrency)
  const autoTax = C.autoTaxCents(expense)

  return (
    <div className={"exp" + (flagged ? " flag" : "")}>
      <div className="exp-num mono">
        #{index + 1}
        {flagged && <span title={t("incomplete")} aria-label={t("incomplete")}>!</span>}
      </div>
      <div className="exp-body">
        <div className="row2">
          <div className="field">
            <label>{t("e_date")}</label>
            <DayPicker value={expense.date} days={days} lang={lang}
              onPick={(iso) => onChange({ ...expense, date: iso })} onChange={set("date")} />
          </div>
          <div className="field">
            <label>{t("e_category")}</label>
            <select value={expense.category} onChange={set("category")}>
              {C.CATEGORIES.map((c) => <option key={c} value={c}>{t("cat_" + c)}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>{t("e_description")}</label>
          <input type="text" value={expense.description} onChange={set("description")}
            placeholder={t("e_description_ph")} />
        </div>

        {/* Consumo + propina = importe. Los campos van dentro de la cuenta. */}
        <div className="money">
          <div className="slot">
            <label>{t("e_amount")}</label>
            <input type="text" inputMode="decimal" className="mono" value={expense.amount}
              onChange={set("amount")} placeholder="0.00" />
          </div>
          {withTip && <span className="op" aria-hidden="true">+</span>}
          {withTip && (
            <div className="slot">
              <label>{t("e_tip")}</label>
              <input type="text" inputMode="decimal" className="mono" value={expense.tip}
                onChange={set("tip")} placeholder="0.00" />
            </div>
          )}
          <div className="slot">
            <label>{t("e_currency")}</label>
            <select value={expense.currency} onChange={set("currency")}>
              {C.CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="result">
            <span className="v">{C.formatMoney(grossOwn, ownSym)}</span>
            <span className="cur">{expense.currency}</span>
            {foreign && (
              <span className="conv">
                {C.expenseFx(expense, reportCurrency) > 0
                  ? "= " + C.formatMoney(grossReport, symbolFor(reportCurrency)) + " " + reportCurrency
                  : t("e_fx_missing")}
              </span>
            )}
          </div>
        </div>

        {foreign && (
          <div className="tax-row">
            <div className="slot">
              <label>{t("e_fx")} <span className="hint">{t("e_fx_hint", { cur: expense.currency, base: reportCurrency })}</span></label>
              <input type="text" inputMode="decimal" className="mono" value={expense.fx}
                onChange={set("fx")} placeholder="18.42" />
            </div>
            {canSuggest && (
              <button type="button" className="btn-mini" style={{ marginBottom: 1 }}
                onClick={() => onSuggestFx(expense)}>{t("e_fx_suggest")}</button>
            )}
          </div>
        )}

        <div className="split"><span>{t("e_how_paid")}</span></div>

        <div className="pay-seg" role="group" aria-label={t("e_how_paid")}>
          {C.PAYMENTS.map((p) => (
            <button type="button" key={p} aria-pressed={expense.payment === p}
              onClick={() => onChange({ ...expense, payment: p })}>{t("pay_" + p)}</button>
          ))}
        </div>
        <div className="consequence">
          {t("consequence_" + expense.payment + (expense.fromAdvance && expense.payment === "tdc_propia" ? "_adv" : ""))}
        </div>

        {/* Sólo tiene sentido ofrecerlo si de verdad queda anticipo por usar.
            Sin remanente el check no haría nada, así que no aparece. */}
        {expense.payment === "tdc_propia" && (available > 0 || expense.fromAdvance) && (
          <label className="check adv-check">
            <input type="checkbox" checked={!!expense.fromAdvance}
              onChange={(ev) => onChange({ ...expense, fromAdvance: ev.target.checked })} />
            {t("from_advance")}
            <span className="hint">
              {available < grossReport && available > 0
                ? t("from_advance_partial", { n: C.formatMoney(available, symbolFor(reportCurrency)) })
                : t("from_advance_hint", { n: C.formatMoney(available, symbolFor(reportCurrency)) })}
            </span>
          </label>
        )}

        <div className="tax-row">
          <label className="check" style={{ paddingBottom: 11 }}>
            <input type="checkbox" checked={!!expense.invoiced} onChange={set("invoiced")} />
            {t("e_invoiced")}
          </label>
          {expense.invoiced ? (
            <div className="slot">
              <label>{t("e_tax")} <span className="hint">{t("e_tax_auto")}</span></label>
              <input type="text" inputMode="decimal" className="mono" value={expense.taxAmount}
                onChange={set("taxAmount")}
                placeholder={C.formatMoney(autoTax, ownSym).replace(ownSym, "")} />
            </div>
          ) : (
            <span className="tax-off">{t("e_tax_none")}</span>
          )}
        </div>

        <div className="receipt">
          <ReceiptThumb expense={expense} t={t} />
          <span className="receipt-name">{expense.receiptName || t("receipt_none")}</span>
          <input ref={fileRef} type="file" style={{ display: "none" }}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            onChange={(ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) onAttach(expense, f) }} />
          <button type="button" className="btn-mini" onClick={() => fileRef.current.click()}>
            {expense.receiptId ? t("receipt_change") : t("receipt_add")}
          </button>
          {expense.receiptId && (
            <button type="button" className="btn-mini" onClick={() => onDetach(expense)}>
              {t("receipt_remove")}
            </button>
          )}
          <button type="button" className="rowdel" style={{ marginLeft: "auto" }}
            onClick={() => onDelete(expense)}
            title={t("e_delete")} aria-label={t("e_delete")}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [lang, setLang] = useState(detectLang)
  const t = useMemo(() => makeT(lang), [lang])
  const [report, setReport] = useState(emptyReport)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)   // { kind: 'warn'|'plain', text }
  const importRef = useRef(null)

  useEffect(() => { try { localStorage.setItem("acacia-lang", lang) } catch (e) {}; document.documentElement.lang = lang }, [lang])

  useEffect(() => {
    Store.load().then((saved) => {
      if (saved && (saved.v === 1 || saved.v === 2)) setReport(C.migrate(saved))
      setLoaded(true)
      if (!Store.available) setMessage({ kind: "warn", text: t("warn_nostore") })
    })
  }, [])

  // Autoguardado: 600 ms después del último cambio, no en cada tecla.
  useEffect(() => {
    if (!loaded) return
    const id = setTimeout(() => {
      Store.save({ ...report, updatedAt: new Date().toISOString() })
        .catch((e) => { if (e.message === "quota") setMessage({ kind: "warn", text: t("warn_quota") }) })
    }, 600)
    return () => clearTimeout(id)
  }, [report, loaded])

  const totals = useMemo(() => C.totals(report), [report])
  const sym = symbolFor(report.trip.currency)
  const money = (cents) => C.formatMoney(cents, sym)
  const kind = C.balanceKind(totals.balanceCents)

  const setTrip = (k) => (ev) => setReport((r) => ({ ...r, trip: { ...r.trip, [k]: ev.target.value } }))

  const addExpense = () => setReport((r) => ({ ...r, expenses: r.expenses.concat([newExpense(r.trip.currency)]) }))

  const updateExpense = useCallback((next) => {
    setReport((r) => ({ ...r, expenses: r.expenses.map((e) => (e.id === next.id ? next : e)) }))
  }, [])

  const deleteExpense = useCallback((expense) => {
    if (expense.receiptId) Store.deleteReceipt(expense.receiptId)
    setReport((r) => ({ ...r, expenses: r.expenses.filter((e) => e.id !== expense.id) }))
  }, [])

  const attachReceipt = useCallback((expense, file) => {
    const isPdf = file.type === "application/pdf"
    const looksImage = file.type.indexOf("image/") === 0
    if (!isPdf && !looksImage) {
      setMessage({ kind: "warn", text: t("err_receipt_type") })
      return
    }
    const prepare = isPdf
      ? Promise.resolve({ blob: file, type: "application/pdf" })
      : Store.shrinkImage(file).then((blob) => ({ blob: blob, type: "image/jpeg" }))

    prepare
      .then(({ blob, type }) => Store.putReceipt(blob, file.name, type).then((id) => ({ id, type })))
      .then(({ id, type }) => {
        if (expense.receiptId) Store.deleteReceipt(expense.receiptId)
        updateExpense({ ...expense, receiptId: id, receiptName: file.name, receiptType: type })
        setMessage(null)
      })
      .catch((e) => {
        setMessage({
          kind: "warn",
          text: e.message === "quota" ? t("warn_quota")
            : e.message === "unreadable" ? t("err_receipt_read")
            : t("err_receipt_type"),
        })
      })
  }, [t, updateExpense])

  const detachReceipt = useCallback((expense) => {
    if (expense.receiptId) Store.deleteReceipt(expense.receiptId)
    updateExpense({ ...expense, receiptId: null, receiptName: "", receiptType: "" })
  }, [updateExpense])

  // Sólo USD→MXN: /api/exchange-rate sirve el FIX de Banxico y nada más. Si
  // falla, el campo se queda como estaba y no aparece ningún error.
  const suggestFx = useCallback((expense) => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((d) => { if (d && d.rate) updateExpense({ ...expense, fx: String(d.rate) }) })
      .catch(() => {})
  }, [updateExpense])

  const fileBase = () => {
    const dest = slugify(report.trip.destination)
    const month = (report.trip.dateFrom || report.trip.dateTo || "").slice(0, 7)
    return ["reporte-gastos", dest, month].filter(Boolean).join("-")
  }

  const downloadPdf = () => {
    setBusy(true)
    const ids = report.expenses.map((e) => e.receiptId).filter(Boolean)
    Promise.all(ids.map((id) => Store.getReceipt(id)))
      .then((recs) => {
        const map = new Map()
        recs.filter(Boolean).forEach((r) => map.set(r.id, r))
        return window.GVPdf.buildPdf(report, map, t)
      })
      .then((blob) => {
        download(blob, fileBase() + ".pdf")
        trackExport()
        if (totals.incompleteCount > 0) {
          setMessage({ kind: "warn", text: t("warn_incomplete", { n: totals.incompleteCount }) })
        }
      })
      .catch(() => setMessage({ kind: "warn", text: t("err_pdf") }))
      .then(() => setBusy(false))
  }

  const downloadCsv = () => {
    const csv = C.toCsv(report, {
      date: t("csv_date"), category: t("csv_category"), description: t("csv_description"),
      currency: t("csv_currency"), amount: t("csv_amount"), fx: t("csv_fx"),
      converted: t("csv_converted"), tax: t("csv_tax"), invoiced: t("csv_invoiced"),
      payment: t("csv_payment"), tip: t("csv_tip"), settles: t("csv_settles"),
      fromAdvance: t("csv_from_advance"),
      pay_efectivo: t("pay_efectivo"), pay_tdc_propia: t("pay_tdc_propia"),
      pay_tdc_empresa: t("pay_tdc_empresa"),
    })
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), fileBase() + ".csv")
  }

  const saveJson = () => {
    Store.exportJson(report).then((blob) => download(blob, fileBase() + ".json"))
  }

  const openJson = (file) => {
    Store.importJson(file)
      .then((r) => { setReport(C.migrate(r)); setMessage(null) })
      .catch(() => setMessage({ kind: "warn", text: t("err_json") }))
  }

  const resetReport = () => {
    if (!window.confirm(t("confirm_reset"))) return
    Store.clearAll().then(() => { setReport(emptyReport()); setMessage(null) })
  }

  const toggleTheme = () => {
    const now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", now)
    try { localStorage.setItem("acacia-theme", now) } catch (e) {}
  }

  const period = report.trip.dateFrom || report.trip.dateTo
    ? [report.trip.dateFrom, report.trip.dateTo].filter(Boolean).join(" – ")
    : t("doc_period")

  return (
    <div className="app">
      <div className="wrap">
        <div className="topbar">
          <a className="brand" href="/"><img src="/assets/acacia-logo.jpg" alt="ACACIA" />ACACIA</a>
          <div className="topbar-actions">
            <a className="ghost-link" href="/freeware">{t("nav_more")}</a>
            <div className="lang-seg" role="group" aria-label={t("lang_label")}>
              <button aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</button>
              <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            </div>
            <button className="icon-btn" onClick={toggleTheme} aria-label={t("theme_label")}>
              <Icon name="moon" /><Icon name="sun" />
            </button>
          </div>
        </div>

        <div className="hero">
          <span className="eyebrow"><span className="dot" />{t("eyebrow")}</span>
          <h1>{t("h1")}<span style={{ color: "var(--accent-2)" }}>{t("h1b")}</span></h1>
          <p>{t("hero_p")}</p>
          <div className="privacy-chip"><Icon name="lock" />{t("privacy_chip")}</div>
        </div>

        <div className="layout">
          <div className="col-main">
            <div className="card">
              <h2>{t("trip")}</h2>
              <div className="row2">
                <div className="field">
                  <label>{t("traveler")}</label>
                  <input value={report.trip.traveler} onChange={setTrip("traveler")} placeholder={t("traveler_ph")} />
                </div>
                <div className="field">
                  <label>{t("employeeId")}</label>
                  <input value={report.trip.employeeId} onChange={setTrip("employeeId")} placeholder={t("employeeId_ph")} />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label>{t("company")}</label>
                  <input value={report.trip.company} onChange={setTrip("company")} placeholder={t("company_ph")} />
                </div>
                <div className="field">
                  <label>{t("destination")}</label>
                  <input value={report.trip.destination} onChange={setTrip("destination")} placeholder={t("destination_ph")} />
                </div>
              </div>
              <div className="field">
                <label>{t("purpose")}</label>
                <input value={report.trip.purpose} onChange={setTrip("purpose")} placeholder={t("purpose_ph")} />
              </div>
              <div className="row3">
                <div className="field">
                  <label>{t("dateFrom")}</label>
                  <input type="date" value={report.trip.dateFrom} onChange={setTrip("dateFrom")} />
                </div>
                <div className="field">
                  <label>{t("dateTo")}</label>
                  <input type="date" value={report.trip.dateTo} onChange={setTrip("dateTo")} />
                </div>
                <div className="field">
                  <label>{t("currency")}</label>
                  <select value={report.trip.currency} onChange={setTrip("currency")}>
                    {C.CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>{t("advance")} <span className="hint">{t("advance_hint")}</span></label>
                <input type="text" inputMode="decimal" className="mono" value={report.trip.advance}
                  onChange={setTrip("advance")} placeholder="0.00" />
              </div>
              <div className="field">
                <label>{t("notes")}</label>
                <textarea value={report.trip.notes} onChange={setTrip("notes")} placeholder={t("notes_ph")} />
              </div>
            </div>

            <div className="exp-head">
              <h2>{t("expenses")}</h2>
              <button className="btn-mini" onClick={addExpense}>+ {t("add_expense")}</button>
            </div>

            {report.expenses.length === 0 && <div className="empty">{t("empty")}</div>}

            {report.expenses.map((e, i) => (
              <ExpenseRow key={e.id} expense={e} index={i} reportCurrency={report.trip.currency}
                trip={report.trip} lang={lang} coverage={totals.coverage[e.id]}
                t={t} onChange={updateExpense} onDelete={deleteExpense}
                onAttach={attachReceipt} onDetach={detachReceipt} onSuggestFx={suggestFx} />
            ))}

            {report.expenses.length > 0 && (
              <button className="btn" onClick={addExpense}>+ {t("add_expense")}</button>
            )}

            <div className="disclaimer" dangerouslySetInnerHTML={{ __html: t("disclaimer") }} />
            <div className="cta">
              <h3>{t("cta_h3")}</h3><p>{t("cta_p")}</p>
              <a className="btn btn-primary" href="/contacto">{t("cta_btn")}</a>
            </div>
            <div style={{ marginTop: 8 }}>
              <h2 className="section-title">{t("faq_title")}</h2>
              {t("faq").map(([q, a], i) => <details key={i}><summary>{q}</summary><p>{a}</p></details>)}
            </div>
          </div>

          {/* La carátula del reporte: lo que se ve aquí es lo que se descarga. */}
          <div className="col-side">
            <div className="doc">
              <div className="doc-head">
                <div className="doc-kicker">{t("doc_kicker")}</div>
                <div className="doc-title">{report.trip.destination || t("doc_untitled")}</div>
                <div className="doc-meta mono">{period}</div>
                <div className="doc-meta">{report.trip.traveler || t("doc_noname")}</div>
              </div>

              <div className="doc-figs">
                <div className="fig"><span>{t("f_total")}</span><span className="v">{money(totals.totalCents)}</span></div>
                {/* El desglose explica el total de arriba: lo de la tarjeta de
                    la empresa se atenúa porque no entra en la liquidación. */}
                {C.PAYMENTS.map((p) => (
                  totals.byPayment[p] ? (
                    <div key={p} className={"fig sub" + (p === "tdc_empresa" ? " off" : "")}>
                      <span>{t("pay_" + p)}</span>
                      <span className="v">{money(totals.byPayment[p])}</span>
                    </div>
                  ) : null
                ))}
                <div className="fig rule" style={{ paddingTop: 8 }}>
                  <span>{t("f_tax")}</span><span className="v">{money(totals.taxCents)}</span>
                </div>
                <div className="fig"><span>{t("f_settleable")}</span><span className="v">{money(totals.settleableCents)}</span></div>
                <div className="fig rule"><span>{t("f_advance")}</span><span className="v">−{money(totals.advanceCents)}</span></div>

                {/* Las dos cifras con las que de verdad se cierra: cuánto entra
                    a tu cuenta y cuánto efectivo entregas. Su diferencia es el
                    saldo de abajo. */}
                {(totals.toTransferCents > 0 || totals.cashToReturnCents > 0) && (
                  <>
                    <div className="fig sub" style={{ paddingTop: 8 }}>
                      <span>{t("f_transfer")}</span>
                      <span className="v">{money(totals.toTransferCents)}</span>
                    </div>
                    <div className="fig sub">
                      <span>{t("f_return")}</span>
                      <span className="v">{money(totals.cashToReturnCents)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className={"balance " + kind}>
                <div className="lbl">{kind === "refund" ? t("bal_refund") : kind === "return" ? t("bal_return") : t("bal_settled")}</div>
                <div className="amt">{money(Math.abs(totals.balanceCents))} <span style={{ fontSize: "0.5em", fontWeight: 600 }}>{report.trip.currency}</span></div>
              </div>

              {message && <div className={"note" + (message.kind === "plain" ? " plain" : "")}>{message.text}</div>}

              <div className="doc-actions">
                <button className="btn btn-primary" onClick={downloadPdf} disabled={busy}>
                  <Icon name="download" />{busy ? t("download_busy") : t("download")}
                </button>
                <div className="btn-row">
                  <button className="btn" onClick={downloadCsv}>{t("csv")}</button>
                  <button className="btn" onClick={saveJson}>{t("json_export")}</button>
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={() => importRef.current.click()}>{t("json_import")}</button>
                  <button className="btn" onClick={resetReport}>{t("reset")}</button>
                </div>
                <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                  onChange={(ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) openJson(f) }} />
              </div>
            </div>
          </div>
        </div>

        <footer className="foot">
          <span>{t("foot_free")}</span>
          <span className="foot-credit">{t("foot_crafted")} <span className="foot-heart" aria-label="love">♥</span> {t("foot_by")} <a className="foot-link" href="https://acaciaco.com.mx" target="_blank" rel="noopener noreferrer">ACACIA Consultoría</a></span>
          <span><a href="/freeware">{t("foot_tools")}</a> · <a href="/legal/privacidad">{t("foot_privacy")}</a> · <a href="/contacto">{t("foot_contact")}</a></span>
        </footer>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />)
