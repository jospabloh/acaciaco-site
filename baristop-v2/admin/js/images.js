/* Baristop admin — image resize / compress pipeline (design spec §4.4).
 *
 * process(file, spec) -> Promise<result>
 *   spec   { w, h, maxKB, keepAlpha, allowSvg }
 *   result { blob, mime, ext, width, height, bytes, aspectWarning, svg }
 * Rejects with Error whose message is Spanish and safe to show. */
(function () {
  "use strict";

  var MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  var SVG_MAX_BYTES = 150 * 1024;
  var webpSupport = null;

  function fail(msg) { return new Error(msg); }

  function supportsWebp() {
    if (webpSupport === null) {
      try {
        var c = document.createElement("canvas");
        c.width = c.height = 1;
        webpSupport = c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
      } catch (e) { webpSupport = false; }
    }
    return webpSupport;
  }

  function readText(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = function () { reject(fail("No pudimos leer el archivo.")); };
      r.readAsText(blob);
    });
  }

  function toBlob(canvas, mime, quality) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) { resolve(b); }, mime, quality);
      } else {
        resolve(null);
      }
    });
  }

  function decode(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
        return createImageBitmap(file);
      }).catch(function () { return decodeWithImage(file); });
    }
    return decodeWithImage(file);
  }

  function decodeWithImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: function () { URL.revokeObjectURL(url); } });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(fail("x")); };
      img.src = url;
    });
  }

  function dimsOf(decoded) {
    if (decoded.source) return decoded;
    return { source: decoded, width: decoded.width, height: decoded.height, release: function () { if (decoded.close) decoded.close(); } };
  }

  function baseName(name) {
    var n = String(name || "imagen").replace(/\.[^.]*$/, "").toLowerCase();
    n = n.normalize ? n.normalize("NFD").replace(/[̀-ͯ]/g, "") : n;
    n = n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return n || "imagen";
  }

  function processSvg(file, spec) {
    if (!spec.allowSvg) return Promise.reject(fail("Este campo no admite SVG. Usa una imagen JPG, WebP o PNG."));
    if (file.size > SVG_MAX_BYTES) return Promise.reject(fail("El SVG pesa más de 150 KB. Usa una versión más ligera."));
    return readText(file).then(function (text) {
      var head = text.replace(/^﻿/, "").trim().slice(0, 600).toLowerCase();
      if (head.indexOf("<svg") === -1 && !(head.indexOf("<?xml") === 0 && head.indexOf("<svg") !== -1)) {
        throw fail("Ese archivo no parece un SVG válido.");
      }
      if (/<script/i.test(text) || /\son[a-z]+\s*=/i.test(text) || /javascript:/i.test(text)) {
        throw fail("El SVG contiene código que no se permite. Exporta uno limpio.");
      }
      return {
        blob: new Blob([text], { type: "image/svg+xml" }), mime: "image/svg+xml", ext: "svg",
        width: 0, height: 0, bytes: file.size, aspectWarning: false, svg: true, baseName: baseName(file.name)
      };
    });
  }

  function process(file, spec) {
    if (!file) return Promise.reject(fail("No se eligió ningún archivo."));
    var isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "");
    if (!isSvg && (!file.type || file.type.indexOf("image/") !== 0)) {
      return Promise.reject(fail("Ese archivo no es una imagen. Elige un JPG, PNG o WebP."));
    }
    if (file.size > MAX_SOURCE_BYTES) {
      return Promise.reject(fail("La imagen es demasiado grande para procesarla aquí. Intenta con una de menos de 12 MB."));
    }
    if (isSvg) return processSvg(file, spec);

    return decode(file).then(function (raw) {
      var d = dimsOf(raw);
      var srcW = d.width;
      var srcH = d.height;
      if (!srcW || !srcH) { d.release(); throw fail("No pudimos leer esa imagen. Prueba con un JPG, PNG o WebP."); }

      // Only formats that can carry transparency stay PNG; a JPEG has none to keep.
      var canAlpha = /image\/(png|webp|gif|avif)/.test(file.type);
      var usePng = !!spec.keepAlpha && canAlpha;
      var scale = Math.min(1, spec.w / srcW, spec.h / srcH);
      var targetAspect = spec.w / spec.h;
      var aspectWarning = Math.abs(srcW / srcH - targetAspect) / targetAspect > 0.15;
      var maxBytes = spec.maxKB * 1024;
      var useWebp = supportsWebp();

      var attempts;
      if (usePng) {
        attempts = [1, 0.85, 0.7, 0.55].map(function (f) { return { mime: "image/png", q: undefined, f: f }; });
      } else {
        var m = useWebp ? "image/webp" : "image/jpeg";
        var qs = useWebp ? [0.82, 0.72, 0.6] : [0.85, 0.72, 0.6];
        attempts = qs.map(function (q) { return { mime: m, q: q, f: 1 }; });
      }

      var i = 0;
      function next() {
        if (i >= attempts.length) {
          d.release();
          throw fail("No pudimos reducir la imagen por debajo de " + spec.maxKB + " KB. Usa una imagen más sencilla.");
        }
        var a = attempts[i++];
        var w = Math.max(1, Math.round(srcW * scale * a.f));
        var h = Math.max(1, Math.round(srcH * scale * a.f));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (a.mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(d.source, 0, 0, w, h);
        return toBlob(canvas, a.mime, a.q).then(function (blob) {
          if (!blob) throw fail("No pudimos procesar la imagen en este navegador.");
          if (blob.size > maxBytes) return next();
          d.release();
          return {
            blob: blob, mime: a.mime, ext: a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg",
            width: w, height: h, bytes: blob.size, aspectWarning: aspectWarning, svg: false, baseName: baseName(file.name)
          };
        });
      }
      return next();
    }, function (e) {
      if (e && e.message && e.message !== "x" && e.name !== "DOMException" && e.name !== "InvalidStateError") throw e;
      throw fail("No pudimos leer esa imagen. Prueba con un JPG, PNG o WebP.");
    });
  }

  /* Blob -> { dataUrl, base64 } */
  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || "");
        resolve({ dataUrl: s, base64: s.slice(s.indexOf(",") + 1) });
      };
      r.onerror = function () { reject(fail("No pudimos leer la imagen procesada.")); };
      r.readAsDataURL(blob);
    });
  }

  window.AdminImages = { process: process, toDataUrl: toDataUrl };
})();
