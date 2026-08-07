/* Gastos de Viaje — cálculos puros. Sin DOM, sin React: se prueba con node --test.
 * Todo el dinero se suma en centavos enteros y el redondeo ocurre sólo al
 * presentar; con tipos de cambio de por medio, sumar flotantes se nota.
 *
 * El modelo de liquidación, que es lo que da sentido a todo lo demás:
 *   · El anticipo es efectivo que la empresa le entregó al viajero.
 *   · Lo pagado en efectivo y lo pagado con la tarjeta del viajero salen de su
 *     bolsillo, así que cuentan para el saldo.
 *   · Lo pagado con la tarjeta de la empresa ya lo pagó la empresa: suma al
 *     costo del viaje pero no mueve el saldo.
 *   · saldo = (efectivo + tarjeta propia) − anticipo.
 */
(function (root) {
  var CATEGORIES = ['transporte_largo', 'hospedaje', 'alimentos', 'transporte_local', 'combustible', 'otros']
  var CURRENCIES = ['MXN', 'USD', 'EUR', 'CAD', 'GBP', 'COP', 'ARS', 'CLP', 'BRL']
  var PAYMENTS = ['efectivo', 'tdc_propia', 'tdc_empresa']
  var VAT_RATE = 16
  // La propina vive donde existe: en la cuenta de un restaurante. En un vuelo o
  // una noche de hotel el campo sólo sería ruido.
  var TIP_CATEGORIES = ['alimentos']

  function toCents(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : 0
    var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''))
    return isFinite(n) ? Math.round(n * 100) : 0
  }

  function centsToNumber(c) { return c / 100 }

  function allowsTip(category) { return TIP_CATEGORIES.indexOf(category) !== -1 }

  // fx = 1 cuando el gasto está en la moneda del reporte. Un tipo de cambio
  // ausente o inválido devuelve 0, lo que marca el gasto como incompleto en
  // vez de contarlo como cero pesos sin avisar.
  function expenseFx(e, reportCurrency) {
    if (!e.currency || e.currency === reportCurrency) return 1
    var n = parseFloat(e.fx)
    return isFinite(n) && n > 0 ? n : 0
  }

  function expenseAmountCents(e, cur) { return Math.round(toCents(e.amount) * expenseFx(e, cur)) }

  function expenseTipCents(e, cur) {
    if (!allowsTip(e.category)) return 0
    return Math.round(toCents(e.tip) * expenseFx(e, cur))
  }

  // Lo que de verdad se gastó en ese renglón: consumo más propina.
  function expenseGrossCents(e, cur) {
    return expenseAmountCents(e, cur) + expenseTipCents(e, cur)
  }

  // IVA desglosado de un monto que ya lo incluye. La propina queda fuera de la
  // base a propósito: no va en la factura.
  function autoTaxCents(e) {
    return Math.round(toCents(e.amount) * VAT_RATE / (100 + VAT_RATE))
  }

  // Campo vacío = automático. Es la regla más simple que existe y se deshace
  // sola: si el usuario borra lo que escribió, vuelve al cálculo.
  function isTaxAuto(e) {
    return e.taxAmount === '' || e.taxAmount == null
  }

  function expenseTaxCents(e, cur) {
    if (!e.invoiced) return 0
    var own = isTaxAuto(e) ? autoTaxCents(e) : toCents(e.taxAmount)
    return Math.round(own * expenseFx(e, cur))
  }

  function countsToBalance(e) { return e.payment !== 'tdc_empresa' }

  function isIncomplete(e, cur) {
    var hasMoney = toCents(e.amount) !== 0 || expenseTipCents(e, cur) !== 0
    return !e.date || !hasMoney || expenseFx(e, cur) === 0
  }

  function totals(report) {
    var cur = report.trip.currency
    var total = 0, tax = 0, settleable = 0, incomplete = 0
    var byPayment = { efectivo: 0, tdc_propia: 0, tdc_empresa: 0 }
    for (var i = 0; i < report.expenses.length; i++) {
      var e = report.expenses[i]
      var gross = expenseGrossCents(e, cur)
      total += gross
      if (byPayment[e.payment] === undefined) byPayment[e.payment] = 0
      byPayment[e.payment] += gross
      if (countsToBalance(e)) settleable += gross
      tax += expenseTaxCents(e, cur)
      if (isIncomplete(e, cur)) incomplete++
    }
    var advance = toCents(report.trip.advance)
    return {
      totalCents: total, byPayment: byPayment, settleableCents: settleable,
      taxCents: tax, advanceCents: advance, balanceCents: settleable - advance,
      count: report.expenses.length, incompleteCount: incomplete,
    }
  }

  function balanceKind(c) { return c > 0 ? 'refund' : c < 0 ? 'return' : 'settled' }

  function formatMoney(cents, symbol) {
    var sign = cents < 0 ? '-' : ''
    var parts = (Math.abs(cents) / 100).toFixed(2).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return sign + (symbol || '$') + parts.join('.')
  }

  // Un reporte guardado antes de que existieran el método de pago y la propina
  // se sube a v2 sin cambiar una sola cifra: la v1 contaba todo contra el
  // anticipo, que es exactamente lo que hace 'efectivo'. El IVA capturado a
  // mano se conserva tal cual, no se recalcula.
  function migrate(report) {
    if (!report || report.v === 2) return report
    if (report.v !== 1) return report
    return {
      v: 2,
      trip: report.trip,
      expenses: (report.expenses || []).map(function (old) {
        var e = {}
        for (var k in old) if (k !== 'deductible') e[k] = old[k]
        e.payment = 'efectivo'
        e.tip = ''
        e.invoiced = !!old.deductible
        return e
      }),
      updatedAt: report.updatedAt,
    }
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  function toCsv(report, L) {
    var cur = report.trip.currency
    var head = ['#', L.date, L.category, L.description, L.payment, L.currency, L.amount,
      L.tip, L.fx, L.converted + ' (' + cur + ')', L.tax, L.invoiced, L.settles]
    var rows = report.expenses.map(function (e, i) {
      return [i + 1, e.date, e.category, e.description, L['pay_' + e.payment] || e.payment,
        e.currency, centsToNumber(toCents(e.amount)).toFixed(2),
        centsToNumber(allowsTip(e.category) ? toCents(e.tip) : 0).toFixed(2),
        expenseFx(e, cur), centsToNumber(expenseGrossCents(e, cur)).toFixed(2),
        centsToNumber(expenseTaxCents(e, cur)).toFixed(2),
        e.invoiced ? '1' : '0', countsToBalance(e) ? '1' : '0'].map(csvCell).join(',')
    })
    return [head.map(csvCell).join(',')].concat(rows).join('\n') + '\n'
  }

  var API = {
    CATEGORIES: CATEGORIES, CURRENCIES: CURRENCIES, PAYMENTS: PAYMENTS,
    VAT_RATE: VAT_RATE, allowsTip: allowsTip,
    toCents: toCents, centsToNumber: centsToNumber, expenseFx: expenseFx,
    expenseAmountCents: expenseAmountCents, expenseTipCents: expenseTipCents,
    expenseGrossCents: expenseGrossCents, autoTaxCents: autoTaxCents,
    isTaxAuto: isTaxAuto, expenseTaxCents: expenseTaxCents,
    countsToBalance: countsToBalance, isIncomplete: isIncomplete, totals: totals,
    balanceKind: balanceKind, formatMoney: formatMoney, migrate: migrate, toCsv: toCsv,
  }

  root.GVCalc = API
  if (typeof module !== 'undefined' && module.exports) module.exports = API
})(typeof globalThis !== 'undefined' ? globalThis : this)
