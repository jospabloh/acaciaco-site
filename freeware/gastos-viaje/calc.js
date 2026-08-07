/* Gastos de Viaje — cálculos puros. Sin DOM, sin React: se prueba con node --test.
 * Todo el dinero se suma en centavos enteros y el redondeo ocurre sólo al
 * presentar; con tipos de cambio de por medio, sumar flotantes se nota. */
(function (root) {
  var CATEGORIES = ['transporte_largo', 'hospedaje', 'alimentos', 'transporte_local', 'combustible', 'otros']
  var CURRENCIES = ['MXN', 'USD', 'EUR', 'CAD', 'GBP', 'COP', 'ARS', 'CLP', 'BRL']

  function toCents(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : 0
    var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''))
    return isFinite(n) ? Math.round(n * 100) : 0
  }

  function centsToNumber(c) { return c / 100 }

  // fx = 1 cuando el gasto está en la moneda del reporte. Un tipo de cambio
  // ausente o inválido devuelve 0, lo que marca el gasto como incompleto en
  // vez de contarlo como cero pesos sin avisar.
  function expenseFx(e, reportCurrency) {
    if (!e.currency || e.currency === reportCurrency) return 1
    var n = parseFloat(e.fx)
    return isFinite(n) && n > 0 ? n : 0
  }

  function expenseCents(e, cur) { return Math.round(toCents(e.amount) * expenseFx(e, cur)) }
  function expenseTaxCents(e, cur) { return Math.round(toCents(e.taxAmount) * expenseFx(e, cur)) }

  function isIncomplete(e, cur) {
    return !e.date || toCents(e.amount) === 0 || expenseFx(e, cur) === 0
  }

  function totals(report) {
    var cur = report.trip.currency, total = 0, tax = 0, incomplete = 0
    for (var i = 0; i < report.expenses.length; i++) {
      var e = report.expenses[i]
      total += expenseCents(e, cur)
      if (e.deductible) tax += expenseTaxCents(e, cur)
      if (isIncomplete(e, cur)) incomplete++
    }
    var advance = toCents(report.trip.advance)
    return {
      totalCents: total, taxCents: tax, advanceCents: advance,
      balanceCents: total - advance, count: report.expenses.length,
      incompleteCount: incomplete,
    }
  }

  function balanceKind(c) { return c > 0 ? 'refund' : c < 0 ? 'return' : 'settled' }

  function formatMoney(cents, symbol) {
    var sign = cents < 0 ? '-' : ''
    var parts = (Math.abs(cents) / 100).toFixed(2).split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return sign + (symbol || '$') + parts.join('.')
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  function toCsv(report, L) {
    var cur = report.trip.currency
    var head = ['#', L.date, L.category, L.description, L.currency, L.amount, L.fx,
      L.converted + ' (' + cur + ')', L.tax, L.deductible]
    var rows = report.expenses.map(function (e, i) {
      return [i + 1, e.date, e.category, e.description, e.currency,
        centsToNumber(toCents(e.amount)).toFixed(2), expenseFx(e, cur),
        centsToNumber(expenseCents(e, cur)).toFixed(2),
        centsToNumber(expenseTaxCents(e, cur)).toFixed(2),
        e.deductible ? '1' : '0'].map(csvCell).join(',')
    })
    return [head.map(csvCell).join(',')].concat(rows).join('\n') + '\n'
  }

  var API = {
    CATEGORIES: CATEGORIES, CURRENCIES: CURRENCIES, toCents: toCents,
    centsToNumber: centsToNumber, expenseFx: expenseFx, expenseCents: expenseCents,
    expenseTaxCents: expenseTaxCents, isIncomplete: isIncomplete, totals: totals,
    balanceKind: balanceKind, formatMoney: formatMoney, toCsv: toCsv,
  }

  root.GVCalc = API
  if (typeof module !== 'undefined' && module.exports) module.exports = API
})(typeof globalThis !== 'undefined' ? globalThis : this)
