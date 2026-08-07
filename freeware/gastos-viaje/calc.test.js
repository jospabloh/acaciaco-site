const { test } = require('node:test')
const assert = require('node:assert/strict')
const C = require('./calc.js')

const report = (over = {}) => ({
  v: 2,
  trip: { currency: 'MXN', advance: 0, ...(over.trip || {}) },
  expenses: over.expenses || [],
})
const exp = (o) => ({ id: 'x', date: '2026-03-12', category: 'hospedaje', description: '',
  amount: 0, tip: '', currency: 'MXN', fx: 1, payment: 'efectivo', invoiced: false,
  taxAmount: '', receiptId: null, ...o })

test('toCents parses numbers, strings and commas', () => {
  assert.equal(C.toCents(1234.5), 123450)
  assert.equal(C.toCents('1,234.50'), 123450)
  assert.equal(C.toCents(''), 0)
  assert.equal(C.toCents('abc'), 0)
  assert.equal(C.toCents(0.1 + 0.2), 30)
})

test('expenseFx is 1 for the report currency and the stored rate otherwise', () => {
  assert.equal(C.expenseFx(exp({ currency: 'MXN', fx: 99 }), 'MXN'), 1)
  assert.equal(C.expenseFx(exp({ currency: 'USD', fx: '18.42' }), 'MXN'), 18.42)
  assert.equal(C.expenseFx(exp({ currency: 'USD', fx: '' }), 'MXN'), 0)
})

test('the gross of an expense is the charge plus the tip', () => {
  const e = exp({ amount: 500, tip: 80, category: 'alimentos' })
  assert.equal(C.expenseAmountCents(e, 'MXN'), 50000)
  assert.equal(C.expenseTipCents(e, 'MXN'), 8000)
  assert.equal(C.expenseGrossCents(e, 'MXN'), 58000)
})

test('the gross converts with the exchange rate, tip included', () => {
  const e = exp({ amount: 100, tip: 20, currency: 'USD', fx: 18.42, category: 'alimentos' })
  assert.equal(C.expenseGrossCents(e, 'MXN'), Math.round(10000 * 18.42) + Math.round(2000 * 18.42))
})

test('a tip only counts on food; elsewhere it is ignored', () => {
  assert.equal(C.allowsTip('alimentos'), true)
  assert.equal(C.allowsTip('hospedaje'), false)
  const lodging = exp({ category: 'hospedaje', amount: 500, tip: 80 })
  assert.equal(C.expenseTipCents(lodging, 'MXN'), 0)
  assert.equal(C.expenseGrossCents(lodging, 'MXN'), 50000)
})

test('tax is zero without an invoice, whatever was typed', () => {
  assert.equal(C.expenseTaxCents(exp({ amount: 1160, invoiced: false, taxAmount: 160 }), 'MXN'), 0)
})

test('tax is derived from the charge at 16/116 when the field is left empty', () => {
  assert.equal(C.VAT_RATE, 16)
  const e = exp({ amount: 1160, invoiced: true })
  assert.equal(C.autoTaxCents(e), 16000)
  assert.equal(C.expenseTaxCents(e, 'MXN'), 16000)
  assert.equal(C.isTaxAuto(e), true)
})

test('a typed tax overrides the automatic one', () => {
  const e = exp({ amount: 1160, invoiced: true, taxAmount: '90' })
  assert.equal(C.expenseTaxCents(e, 'MXN'), 9000)
  assert.equal(C.isTaxAuto(e), false)
})

test('the tip stays out of the tax base', () => {
  const e = exp({ category: 'alimentos', amount: 1160, tip: 200, invoiced: true })
  assert.equal(C.expenseTaxCents(e, 'MXN'), 16000)
  assert.equal(C.expenseGrossCents(e, 'MXN'), 136000)
})

test('tax converts with the same rate as the expense', () => {
  const e = exp({ amount: 116, currency: 'USD', fx: 18.5, invoiced: true })
  assert.equal(C.expenseTaxCents(e, 'MXN'), Math.round(1600 * 18.5))
})

test('only the company card is excluded from the settlement', () => {
  assert.equal(C.countsToBalance(exp({ payment: 'efectivo' })), true)
  assert.equal(C.countsToBalance(exp({ payment: 'tdc_propia' })), true)
  assert.equal(C.countsToBalance(exp({ payment: 'tdc_empresa' })), false)
})

test('totals split the trip by payment method', () => {
  const t = C.totals(report({
    trip: { currency: 'MXN', advance: 3000 },
    expenses: [
      exp({ amount: 2450, payment: 'efectivo' }),
      exp({ amount: 1200, payment: 'tdc_propia' }),
      exp({ amount: 8000, payment: 'tdc_empresa' }),
    ],
  }))
  assert.equal(t.totalCents, 1165000)
  assert.equal(t.byPayment.efectivo, 245000)
  assert.equal(t.byPayment.tdc_propia, 120000)
  assert.equal(t.byPayment.tdc_empresa, 800000)
  assert.equal(t.settleableCents, 365000)
  assert.equal(t.balanceCents, 365000 - 300000)
  assert.equal(C.balanceKind(t.balanceCents), 'refund')
})

test('the company card never moves the balance', () => {
  const t = C.totals(report({
    trip: { currency: 'MXN', advance: 1000 },
    expenses: [exp({ amount: 5000, payment: 'tdc_empresa' })],
  }))
  assert.equal(t.totalCents, 500000)
  assert.equal(t.settleableCents, 0)
  assert.equal(t.balanceCents, -100000)
  assert.equal(C.balanceKind(t.balanceCents), 'return')
})

test('a tip paid in cash still eats into the advance', () => {
  const t = C.totals(report({
    trip: { currency: 'MXN', advance: 1000 },
    expenses: [exp({ category: 'alimentos', amount: 800, tip: 200, payment: 'efectivo' })],
  }))
  assert.equal(t.settleableCents, 100000)
  assert.equal(t.balanceCents, 0)
  assert.equal(C.balanceKind(t.balanceCents), 'settled')
})

test('creditable tax adds up across every payment method', () => {
  const t = C.totals(report({
    expenses: [
      exp({ amount: 1160, payment: 'efectivo', invoiced: true }),
      exp({ amount: 2320, payment: 'tdc_empresa', invoiced: true }),
      exp({ amount: 5000, payment: 'efectivo', invoiced: false }),
    ],
  }))
  assert.equal(t.taxCents, 16000 + 32000)
})

test('sums stay exact across many fractional conversions', () => {
  const expenses = Array.from({ length: 100 }, () =>
    exp({ amount: 0.1, currency: 'USD', fx: 18.33 }))
  assert.equal(C.totals(report({ expenses })).totalCents, 100 * Math.round(10 * 18.33))
})

test('isIncomplete flags missing date, zero charge and a missing rate', () => {
  assert.equal(C.isIncomplete(exp({ amount: 100 }), 'MXN'), false)
  assert.equal(C.isIncomplete(exp({ amount: 100, date: '' }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 0 }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 100, currency: 'USD', fx: '' }), 'MXN'), true)
})

test('a tip-only food charge is not incomplete', () => {
  assert.equal(C.isIncomplete(exp({ category: 'alimentos', amount: 0, tip: 150 }), 'MXN'), false)
})

test('totals counts expenses and incomplete ones', () => {
  const t = C.totals(report({ expenses: [exp({ amount: 100 }), exp({ amount: 0 })] }))
  assert.equal(t.count, 2)
  assert.equal(t.incompleteCount, 1)
})

test('formatMoney groups thousands and always shows two decimals', () => {
  assert.equal(C.formatMoney(123450, '$'), '$1,234.50')
  assert.equal(C.formatMoney(-76000, '$'), '-$760.00')
  assert.equal(C.formatMoney(0, '$'), '$0.00')
})

test('migrate upgrades a v1 report to v2 without changing its balance', () => {
  const v1 = {
    v: 1,
    trip: { currency: 'MXN', advance: 1000 },
    expenses: [{ id: 'a', date: '2026-03-10', category: 'hospedaje', description: 'Hotel',
      amount: 2450, currency: 'MXN', fx: 1, taxAmount: 337.93, deductible: true, receiptId: null }],
  }
  const v2 = C.migrate(v1)
  assert.equal(v2.v, 2)
  assert.equal(v2.expenses[0].payment, 'efectivo')
  assert.equal(v2.expenses[0].invoiced, true)
  assert.equal(v2.expenses[0].tip, '')
  assert.equal(v2.expenses[0].taxAmount, 337.93)
  assert.equal(Object.prototype.hasOwnProperty.call(v2.expenses[0], 'deductible'), false)
  // El saldo de la v1 contaba todo contra el anticipo: 'efectivo' lo reproduce.
  assert.equal(C.totals(v2).balanceCents, 245000 - 100000)
  // Y el IVA capturado a mano se respeta, no se recalcula.
  assert.equal(C.totals(v2).taxCents, 33793)
})

test('migrate leaves a v2 report untouched', () => {
  const r = report({ expenses: [exp({ amount: 100 })] })
  assert.equal(C.migrate(r), r)
})

test('toCsv emits a header plus one row per expense and escapes quotes', () => {
  const L = { date: 'Fecha', category: 'Categoría', description: 'Descripción', payment: 'Pago',
    currency: 'Moneda', amount: 'Consumo', tip: 'Propina', fx: 'TC', converted: 'Importe',
    tax: 'IVA', invoiced: 'Con factura', settles: 'Cuenta al saldo',
    pay_efectivo: 'Efectivo', pay_tdc_propia: 'Mi tarjeta', pay_tdc_empresa: 'Tarjeta empresa' }
  const csv = C.toCsv(report({ expenses: [
    exp({ amount: 100, description: 'Hotel "Centro"', payment: 'tdc_propia' }),
  ] }), L)
  const lines = csv.trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^#,Fecha,/)
  assert.match(lines[1], /"Hotel ""Centro"""/)
  assert.match(lines[1], /Mi tarjeta/)
})
