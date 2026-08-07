/* Gastos de Viaje — el documento que se entrega, armado con pdf-lib.
 * No sabe de React ni de IndexedDB: entra el reporte más un Map de blobs de
 * comprobantes, sale un Blob de PDF. Tres partes: carátula con el saldo,
 * tabla de gastos paginada con líneas de firma, y un anexo con una página por
 * comprobante encabezada con el mismo número que lleva el gasto en la tabla. */
window.GVPdf = (function () {
  var C = window.GVCalc
  var W = 612, H = 792, M = 48            // carta, márgenes en puntos
  var LINE = 0.75

  function symbolFor(code) {
    return code === "MXN" || code === "USD" || code === "CAD" || code === "CLP" ||
           code === "COP" || code === "ARS" ? "$" : code === "EUR" ? "€" :
           code === "GBP" ? "£" : code === "BRL" ? "R$" : ""
  }

  // pdf-lib usa WinAnsi en las fuentes estándar: cualquier glifo fuera de esa
  // tabla revienta el documento. Se limpia lo que el usuario escribió.
  function safe(s) {
    return String(s == null ? "" : s).replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
  }

  function fitText(text, font, size, maxWidth) {
    var s = safe(text)
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) s = s.slice(0, -1)
    return s + "…"
  }

  function fmtDate(iso) {
    if (!iso) return "—"
    var p = String(iso).split("-")
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : safe(iso)
  }

  async function buildPdf(report, receipts, t) {
    var PDFDocument = PDFLib.PDFDocument, StandardFonts = PDFLib.StandardFonts, rgb = PDFLib.rgb
    var doc = await PDFDocument.create()
    var font = await doc.embedFont(StandardFonts.Helvetica)
    var bold = await doc.embedFont(StandardFonts.HelveticaBold)

    var ink = rgb(0.13, 0.15, 0.15)
    var gray = rgb(0.45, 0.48, 0.48)
    var soft = rgb(0.82, 0.85, 0.85)
    var accent = rgb(0.06, 0.45, 0.42)
    var warn = rgb(0.66, 0.42, 0.05)

    var cur = report.trip.currency
    var sym = symbolFor(cur)
    var totals = C.totals(report)
    var money = function (cents) { return C.formatMoney(cents, sym) }

    var page = doc.addPage([W, H])
    var y = H - M

    function text(page, s, x, y, size, f, color) {
      page.drawText(safe(s), { x: x, y: y, size: size, font: f || font, color: color || ink })
    }
    function rtext(page, s, xRight, y, size, f, color) {
      var str = safe(s)
      var f2 = f || font
      page.drawText(str, { x: xRight - f2.widthOfTextAtSize(str, size), y: y, size: size, font: f2, color: color || ink })
    }
    function rule(page, y, x1, x2, color) {
      page.drawLine({ start: { x: x1 || M, y: y }, end: { x: x2 || W - M, y: y },
        thickness: LINE, color: color || soft })
    }

    // ── 1. Carátula ─────────────────────────────────────────────────────────
    text(page, t("pdf_kicker"), M, y, 9, bold, accent)
    y -= 22
    text(page, t("pdf_title"), M, y, 22, bold)
    y -= 26

    var trip = report.trip
    var left = [
      [t("pdf_traveler"), trip.traveler],
      [t("pdf_employee"), trip.employeeId],
      [t("pdf_company"), trip.company],
    ]
    var right = [
      [t("pdf_destination"), trip.destination],
      // Guion simple, no guion largo: safe() descarta lo que no está en WinAnsi
      // y un "–" desaparecería, dejando dos fechas pegadas sin separador.
      [t("pdf_period"), (trip.dateFrom || trip.dateTo) ? fmtDate(trip.dateFrom) + " - " + fmtDate(trip.dateTo) : ""],
      [t("pdf_purpose"), trip.purpose],
    ]
    var blockTop = y
    for (var i = 0; i < left.length; i++) {
      if (!left[i][1]) continue
      text(page, left[i][0].toUpperCase(), M, y, 7.5, bold, gray)
      text(page, fitText(left[i][1], font, 11, 210), M, y - 13, 11)
      y -= 30
    }
    var yr = blockTop
    for (var j = 0; j < right.length; j++) {
      if (!right[j][1]) continue
      text(page, right[j][0].toUpperCase(), M + 250, yr, 7.5, bold, gray)
      text(page, fitText(right[j][1], font, 11, 260), M + 250, yr - 13, 11)
      yr -= 30
    }
    y = Math.min(y, yr) - 8
    rule(page, y); y -= 26

    // Bloque de cifras
    text(page, t("pdf_total"), M, y, 11, font, gray)
    rtext(page, money(totals.totalCents) + " " + cur, W - M, y, 11, font)
    y -= 18

    // El desglose por método es lo que explica por qué el saldo no es el total:
    // lo de la tarjeta de la empresa no se liquida con el viajero.
    for (var pm = 0; pm < C.PAYMENTS.length; pm++) {
      var method = C.PAYMENTS[pm]
      if (!totals.byPayment[method]) continue
      text(page, "· " + t("pdf_pay_" + method), M + 12, y, 9.5, font, gray)
      rtext(page, money(totals.byPayment[method]), W - M, y, 9.5, font, gray)
      y -= 15
    }
    y -= 4

    var figs = [
      [t("pdf_tax"), money(totals.taxCents)],
      [t("pdf_settleable"), money(totals.settleableCents)],
      [t("pdf_advance"), money(totals.advanceCents)],
    ]
    for (var k = 0; k < figs.length; k++) {
      text(page, figs[k][0], M, y, 11, font, gray)
      rtext(page, figs[k][1] + " " + cur, W - M, y, 11, font)
      y -= 20
    }
    y -= 4; rule(page, y); y -= 30

    var kind = C.balanceKind(totals.balanceCents)
    var balLabel = kind === "refund" ? t("pdf_bal_refund")
      : kind === "return" ? t("pdf_bal_return") : t("pdf_bal_settled")
    text(page, balLabel.toUpperCase(), M, y + 6, 8.5, bold, kind === "return" ? warn : accent)
    rtext(page, money(Math.abs(totals.balanceCents)) + " " + cur, W - M, y - 8, 26, bold,
      kind === "return" ? warn : kind === "settled" ? gray : accent)
    y -= 34

    if (trip.notes) {
      rule(page, y); y -= 18
      text(page, t("pdf_notes").toUpperCase(), M, y, 7.5, bold, gray); y -= 14
      var words = safe(trip.notes).split(/\s+/), line = ""
      for (var w = 0; w < words.length; w++) {
        var probe = line ? line + " " + words[w] : words[w]
        if (font.widthOfTextAtSize(probe, 10) > W - 2 * M) {
          text(page, line, M, y, 10, font, gray); y -= 14; line = words[w]
        } else line = probe
      }
      if (line) { text(page, line, M, y, 10, font, gray); y -= 14 }
    }

    // ── 2. Tabla de gastos ──────────────────────────────────────────────────
    // El ancho útil es W - 2M = 516 pt, repartidos dejando aire entre columnas.
    // No hay columna de "facturado": la de IVA ya lo dice — trae importe cuando
    // hubo factura y un guion cuando no. Una columna menos y el mismo dato.
    var COLS = [
      { key: "n", label: "#", x: M, w: 14, align: "l" },
      { key: "date", label: t("pdf_col_date"), x: M + 16, w: 48, align: "l" },
      { key: "cat", label: t("pdf_col_category"), x: M + 68, w: 58, align: "l" },
      { key: "desc", label: t("pdf_col_description"), x: M + 132, w: 84, align: "l" },
      { key: "pay", label: t("pdf_col_payment"), x: M + 222, w: 56, align: "l" },
      { key: "curr", label: t("pdf_col_currency"), x: M + 284, w: 26, align: "l" },
      { key: "fx", label: t("pdf_col_fx"), x: M + 316, w: 30, align: "r" },
      { key: "tip", label: t("pdf_col_tip"), x: M + 354, w: 44, align: "r" },
      { key: "amt", label: t("pdf_col_amount"), x: M + 406, w: 60, align: "r" },
      { key: "tax", label: t("pdf_col_tax"), x: M + 474, w: 42, align: "r" },
    ]

    function newTablePage(title) {
      var p = doc.addPage([W, H])
      var yy = H - M
      text(p, title, M, yy, 13, bold); yy -= 20
      return { page: p, y: yy }
    }
    function tableHeader(p, yy) {
      for (var c = 0; c < COLS.length; c++) {
        var col = COLS[c]
        if (col.align === "r") rtext(p, col.label, col.x + col.w, yy, 7.5, bold, gray)
        else text(p, fitText(col.label, bold, 7.5, col.w), col.x, yy, 7.5, bold, gray)
      }
      rule(p, yy - 6)
      return yy - 20
    }

    var tp = newTablePage(t("pdf_table_title"))
    var tPage = tp.page
    var ty = tableHeader(tPage, tp.y)

    for (var e = 0; e < report.expenses.length; e++) {
      if (ty < M + 90) {
        tp = newTablePage(t("pdf_table_title_cont"))
        tPage = tp.page
        ty = tableHeader(tPage, tp.y)
      }
      var ex = report.expenses[e]
      var fx = C.expenseFx(ex, cur)
      var tipCents = C.expenseTipCents(ex, cur)
      var row = {
        n: String(e + 1),
        date: fmtDate(ex.date),
        cat: t("cat_" + ex.category),
        desc: ex.description || "—",
        pay: t("pdf_short_" + ex.payment),
        curr: ex.currency,
        fx: fx === 1 ? "—" : String(fx),
        tip: tipCents ? money(tipCents) : "—",
        amt: money(C.expenseGrossCents(ex, cur)),
        tax: ex.invoiced ? money(C.expenseTaxCents(ex, cur)) : "—",
      }
      for (var c2 = 0; c2 < COLS.length; c2++) {
        var col2 = COLS[c2]
        var val = row[col2.key]
        if (col2.align === "r") rtext(tPage, fitText(val, font, 8.5, col2.w), col2.x + col2.w, ty, 8.5)
        else text(tPage, fitText(val, font, 8.5, col2.w), col2.x, ty, 8.5)
      }
      rule(tPage, ty - 6, M, W - M, rgb(0.91, 0.93, 0.93))
      ty -= 18
    }

    ty -= 6
    rule(tPage, ty)
    ty -= 16
    text(tPage, t("pdf_total") + ": " + money(totals.totalCents) + " " + cur, M, ty, 10, bold)
    rtext(tPage, t("pdf_count", { n: totals.count }), W - M, ty, 9, font, gray)

    // Firmas — es lo que convierte la tabla en un comprobante entregable.
    var sy = Math.max(ty - 70, M + 40)
    rule(tPage, sy, M, M + 210)
    rule(tPage, sy, W - M - 210, W - M)
    text(tPage, t("pdf_signed_by"), M, sy - 13, 8.5, font, gray)
    text(tPage, t("pdf_approved_by"), W - M - 210, sy - 13, 8.5, font, gray)

    // ── 3. Anexo de comprobantes ────────────────────────────────────────────
    var annexNumbered = report.expenses
      .map(function (ex, idx) { return { ex: ex, n: idx + 1 } })
      .filter(function (r) { return r.ex.receiptId && receipts.get(r.ex.receiptId) })

    for (var a = 0; a < annexNumbered.length; a++) {
      var item = annexNumbered[a]
      var rec = receipts.get(item.ex.receiptId)
      var heading = t("pdf_annex_item", {
        n: item.n, date: fmtDate(item.ex.date),
        cat: t("cat_" + item.ex.category),
        amount: money(C.expenseGrossCents(item.ex, cur)) + " " + cur,
      })
      var bytes = new Uint8Array(await rec.blob.arrayBuffer())

      if (rec.type === "application/pdf") {
        var src = await PDFDocument.load(bytes, { ignoreEncryption: true })
        var copied = await doc.copyPages(src, src.getPageIndices())
        for (var cp = 0; cp < copied.length; cp++) {
          var cpage = copied[cp]
          doc.addPage(cpage)
          if (cp === 0) {
            var size = cpage.getSize()
            cpage.drawRectangle({ x: 0, y: size.height - 26, width: size.width, height: 26,
              color: rgb(1, 1, 1), opacity: 0.88 })
            cpage.drawText(fitText(heading, bold, 9, size.width - 24),
              { x: 12, y: size.height - 18, size: 9, font: bold, color: accent })
          }
        }
        continue
      }

      var ap = doc.addPage([W, H])
      text(ap, t("pdf_annex_title"), M, H - M, 9, bold, gray)
      text(ap, heading, M, H - M - 20, 12, bold)
      rule(ap, H - M - 32)

      var img = null
      try {
        img = rec.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      } catch (err) {
        text(ap, t("pdf_annex_failed"), M, H - M - 60, 10, font, warn)
      }
      if (img) {
        var availW = W - 2 * M, availH = H - M - 60 - M
        var s = Math.min(availW / img.width, availH / img.height, 1)
        var dw = img.width * s, dh = img.height * s
        ap.drawImage(img, { x: (W - dw) / 2, y: M + (availH - dh) / 2, width: dw, height: dh })
      }
    }

    // Pie en todas las páginas
    var pages = doc.getPages()
    for (var p2 = 0; p2 < pages.length; p2++) {
      rtext(pages[p2], t("pdf_footer") + "  ·  " + (p2 + 1) + "/" + pages.length,
        W - M, 30, 8, font, gray)
    }

    var out = await doc.save()
    return new Blob([out], { type: "application/pdf" })
  }

  return { buildPdf: buildPdf }
})()
