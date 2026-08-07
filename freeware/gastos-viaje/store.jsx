/* Gastos de Viaje — persistencia local (IndexedDB) y manejo de comprobantes.
 * No sabe de React ni de PDF. Dos object stores: `meta` guarda el reporte en
 * curso bajo la llave "report"; `receipts` guarda los blobs, referenciados por
 * receiptId desde cada gasto. Viven separados a propósito: si las fotos
 * estuvieran dentro del reporte, cada tecla reescribiría veinte megabytes.
 * Cuando IndexedDB no está disponible (modo privado, navegador viejo) nada
 * lanza: todo resuelve a un valor inofensivo y la app sigue en memoria. */
window.GVStore = (function () {
  var DB_NAME = "gastos-viaje", DB_VERSION = 1
  var META = "meta", RECEIPTS = "receipts", REPORT_KEY = "report"
  var MAX_SIDE = 1600, JPEG_QUALITY = 0.8
  var available = typeof indexedDB !== "undefined" && indexedDB !== null
  var dbPromise = null

  function openDb() {
    if (!available) return Promise.reject(new Error("unavailable"))
    if (dbPromise) return dbPromise
    dbPromise = new Promise(function (resolve, reject) {
      var req
      try { req = indexedDB.open(DB_NAME, DB_VERSION) } catch (e) { return reject(e) }
      req.onupgradeneeded = function () {
        var db = req.result
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
        if (!db.objectStoreNames.contains(RECEIPTS)) db.createObjectStore(RECEIPTS, { keyPath: "id" })
      }
      req.onsuccess = function () { resolve(req.result) }
      req.onerror = function () { reject(req.error || new Error("open-failed")) }
      req.onblocked = function () { reject(new Error("blocked")) }
    }).catch(function (e) { available = false; throw e })
    return dbPromise
  }

  function tx(storeName, mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode)
        var req = run(t.objectStore(storeName))
        t.oncomplete = function () { resolve(req ? req.result : undefined) }
        t.onerror = function () { reject(t.error || new Error("tx-failed")) }
        t.onabort = function () { reject(t.error || new Error("tx-aborted")) }
      })
    })
  }

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }

  // ── Reporte ───────────────────────────────────────────────────────────────
  function load() {
    if (!available) return Promise.resolve(null)
    return tx(META, "readonly", function (s) { return s.get(REPORT_KEY) })
      .then(function (r) { return r || null })
      .catch(function () { return null })
  }
  function save(report) {
    if (!available) return Promise.resolve()
    return tx(META, "readwrite", function (s) { return s.put(report, REPORT_KEY) })
      .catch(function (e) { return Promise.reject(quotaError(e)) })
  }
  function quotaError(e) {
    var name = e && e.name ? e.name : ""
    return new Error(name === "QuotaExceededError" ? "quota" : "write")
  }

  // ── Comprobantes ──────────────────────────────────────────────────────────
  function putReceipt(blob, name, type) {
    var id = uid()
    if (!available) return Promise.resolve(id)
    return tx(RECEIPTS, "readwrite", function (s) {
      return s.put({ id: id, blob: blob, name: name, type: type })
    }).then(function () { return id })
      .catch(function (e) { return Promise.reject(quotaError(e)) })
  }
  function getReceipt(id) {
    if (!available || !id) return Promise.resolve(null)
    return tx(RECEIPTS, "readonly", function (s) { return s.get(id) })
      .then(function (r) { return r || null })
      .catch(function () { return null })
  }
  function deleteReceipt(id) {
    if (!available || !id) return Promise.resolve()
    return tx(RECEIPTS, "readwrite", function (s) { return s.delete(id) }).catch(function () {})
  }
  function clearAll() {
    if (!available) return Promise.resolve()
    return Promise.all([
      tx(META, "readwrite", function (s) { return s.clear() }),
      tx(RECEIPTS, "readwrite", function (s) { return s.clear() }),
    ]).then(function () {}).catch(function () {})
  }

  // ── Reescalado de imágenes ────────────────────────────────────────────────
  // Seis fotos de celular sin tocar producen un PDF de 40 MB que ningún correo
  // corporativo deja pasar. HEIC entra aquí y, si el navegador no lo decodifica
  // (todo lo que no sea Safari), se rechaza con un motivo claro en vez de
  // guardar una imagen en blanco.
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file)
      var img = new Image()
      img.onload = function () {
        URL.revokeObjectURL(url)
        var w = img.naturalWidth, h = img.naturalHeight
        if (!w || !h) return reject(new Error("unreadable"))
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h))
        var canvas = document.createElement("canvas")
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error("unreadable"))
        }, "image/jpeg", JPEG_QUALITY)
      }
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable")) }
      img.src = url
    })
  }

  // ── Archivo .json portable ────────────────────────────────────────────────
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader()
      fr.onload = function () { resolve(fr.result) }
      fr.onerror = function () { reject(new Error("read")) }
      fr.readAsDataURL(blob)
    })
  }
  function dataUrlToBlob(durl) {
    var parts = String(durl).split(",")
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || "application/octet-stream"
    var bin = atob(parts[1] || "")
    var arr = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr], { type: mime })
  }

  function exportJson(report) {
    var ids = report.expenses.map(function (e) { return e.receiptId }).filter(Boolean)
    return Promise.all(ids.map(getReceipt)).then(function (recs) {
      return Promise.all(recs.filter(Boolean).map(function (r) {
        return blobToDataUrl(r.blob).then(function (d) {
          return { id: r.id, name: r.name, type: r.type, data: d }
        })
      }))
    }).then(function (receipts) {
      var payload = { v: 1, report: report, receipts: receipts }
      return new Blob([JSON.stringify(payload)], { type: "application/json" })
    })
  }

  function importJson(file) {
    return file.text().then(function (text) {
      var payload
      try { payload = JSON.parse(text) } catch (e) { throw new Error("parse") }
      if (!payload || payload.v !== 1 || !payload.report) throw new Error("version")
      var receipts = payload.receipts || []
      return Promise.all(receipts.map(function (r) {
        if (!available) return Promise.resolve()
        return tx(RECEIPTS, "readwrite", function (s) {
          return s.put({ id: r.id, blob: dataUrlToBlob(r.data), name: r.name, type: r.type })
        }).catch(function () {})
      })).then(function () { return payload.report })
    })
  }

  return {
    get available() { return available },
    load: load, save: save,
    putReceipt: putReceipt, getReceipt: getReceipt, deleteReceipt: deleteReceipt,
    clearAll: clearAll, shrinkImage: shrinkImage,
    exportJson: exportJson, importJson: importJson,
    uid: uid,
  }
})()
