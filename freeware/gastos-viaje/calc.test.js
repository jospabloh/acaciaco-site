const { test } = require('node:test')
const assert = require('node:assert/strict')
const C = require('./calc.js')

const report = (over = {}) => ({
  v: 1,
  trip: { currency: 'MXN', advance: 0, ...(over.trip || {}) },
  expenses: over.expenses || [],
})
const exp = (o) => ({ id: 'x', date: '2026-03-12', category: 'hospedaje', description: '',
  amount: 0, currency: 'MXN', fx: 1, taxAmount: 0, deductible: false, receiptId: null, ...o })

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

test('expenseCents converts with the exchange rate', () => {
  assert.equal(C.expenseCents(exp({ amount: 100, currency: 'MXN' }), 'MXN'), 10000)
  assert.equal(C.expenseCents(exp({ amount: 100, currency: 'USD', fx: 18.42 }), 'MXN'), 184200)
})

test('tax counts only for deductible expenses', () => {
  const r = report({ expenses: [
    exp({ amount: 1000, taxAmount: 160, deductible: true }),
    exp({ amount: 500, taxAmount: 80, deductible: false }),
  ] })
  const t = C.totals(r)
  assert.equal(t.totalCents, 150000)
  assert.equal(t.taxCents, 16000)
})

test('tax converts with the same rate as the expense', () => {
  const r = report({ expenses: [
    exp({ amount: 100, taxAmount: 16, currency: 'USD', fx: 18.5, deductible: true }),
  ] })
  assert.equal(C.totals(r).taxCents, Math.round(1600 * 18.5))
})

test('balance is total minus advance, in its three shapes', () => {
  const owed = C.totals(report({ trip: { currency: 'MXN', advance: 1000 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(owed.balanceCents, 324000)
  assert.equal(C.balanceKind(owed.balanceCents), 'refund')

  const back = C.totals(report({ trip: { currency: 'MXN', advance: 5000 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(back.balanceCents, -76000)
  assert.equal(C.balanceKind(back.balanceCents), 'return')

  const even = C.totals(report({ trip: { currency: 'MXN', advance: 4240 },
    expenses: [exp({ amount: 4240 })] }))
  assert.equal(even.balanceCents, 0)
  assert.equal(C.balanceKind(even.balanceCents), 'settled')
})

test('sums stay exact across many fractional conversions', () => {
  const expenses = Array.from({ length: 100 }, () =>
    exp({ amount: 0.1, currency: 'USD', fx: 18.33 }))
  assert.equal(C.totals(report({ expenses })).totalCents, 100 * Math.round(10 * 18.33))
})

test('isIncomplete flags missing date, zero amount and a missing rate', () => {
  assert.equal(C.isIncomplete(exp({ amount: 100 }), 'MXN'), false)
  assert.equal(C.isIncomplete(exp({ amount: 100, date: '' }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 0 }), 'MXN'), true)
  assert.equal(C.isIncomplete(exp({ amount: 100, currency: 'USD', fx: '' }), 'MXN'), true)
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

test('toCsv emits a header plus one row per expense and escapes quotes', () => {
  const csv = C.toCsv(report({ expenses: [exp({ amount: 100, description: 'Hotel "Centro"' })] }),
    { date: 'Fecha', category: 'Categoría', description: 'Descripción', currency: 'Moneda',
      amount: 'Monto', fx: 'TC', converted: 'Importe', tax: 'IVA', deductible: 'Deducible' })
  const lines = csv.trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^#,Fecha,/)
  assert.match(lines[1], /"Hotel ""Centro"""/)
})
