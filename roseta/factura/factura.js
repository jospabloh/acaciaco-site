(function () {
  'use strict';

  // Vercel serverless functions cap the whole request body at 4.5MB, and
  // base64 inflates raw bytes by ~4/3 — so the two attachments together must
  // stay well under that once encoded, with room for the JSON text fields.
  var CSF_MAX_BYTES = 3 * 1024 * 1024; // 3MB raw for the (required) CSF
  var COMBINED_MAX_BYTES = 3.2 * 1024 * 1024; // CSF + ticket raw, combined
  var RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

  var form = document.getElementById('rf-form');
  if (!form) return;

  var statusEl = document.getElementById('rf-status');
  var submitBtn = document.getElementById('rf-submit');
  var successEl = document.getElementById('rf-success');
  var folioEl = document.getElementById('rf-folio');
  var statusLinkEl = document.getElementById('rf-status-link');

  var rfcInput = document.getElementById('rfc');
  var matchBox = document.getElementById('rfc-match');
  var matchData = document.getElementById('rfc-match-data');
  var matchUseBtn = document.getElementById('rfc-use');
  var matchDismissBtn = document.getElementById('rfc-dismiss');
  var lastMatch = null;

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = kind || '';
  }

  // Downscales a photo client-side (max 1400px, JPEG ~0.72) so ticket photos
  // taken straight from a phone camera don't blow past the request-size
  // budget. PDFs pass through untouched.
  function compressImageFile(file) {
    return new Promise(function (resolve) {
      if (!file.type || file.type.indexOf('image/') !== 0) return resolve(file);
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxDim = 1400;
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function readAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve({ name: file.name, type: file.type, dataUrl: reader.result }); };
      reader.onerror = function () { reject(new Error('No se pudo leer el archivo "' + file.name + '".')); };
      reader.readAsDataURL(file);
    });
  }

  // Prepares the CSF (required, must fit on its own) and the ticket photo
  // (optional — dropped with a note if it doesn't fit the combined budget,
  // rather than blocking the whole submission).
  function prepareAttachments(csfFile, ticketFile) {
    return Promise.resolve()
      .then(function () {
        if (csfFile.size > CSF_MAX_BYTES) {
          throw new Error('Tu CSF pesa más de 3 MB. Comprímela (o guárdala como PDF más ligero) e inténtalo de nuevo.');
        }
        if (!ticketFile) return [csfFile, null];
        return compressImageFile(ticketFile).then(function (compressed) { return [csfFile, compressed]; });
      })
      .then(function (pair) {
        var csf = pair[0], ticket = pair[1];
        var ticketDropped = false;
        if (ticket && csf.size + ticket.size > COMBINED_MAX_BYTES) {
          ticket = null;
          ticketDropped = true;
        }
        return Promise.all([readAsBase64(csf), ticket ? readAsBase64(ticket) : Promise.resolve(null)])
          .then(function (files) { return { csf: files[0], ticket: files[1], ticketDropped: ticketDropped }; });
      });
  }

  function setupDrop(dropId, inputId, filenameId) {
    var drop = document.getElementById(dropId);
    var input = document.getElementById(inputId);
    var filenameEl = document.getElementById(filenameId);
    if (!drop || !input) return;

    function updateName() {
      var f = input.files && input.files[0];
      if (f) {
        filenameEl.textContent = f.name;
        drop.classList.add('has-file');
      } else {
        filenameEl.textContent = '';
        drop.classList.remove('has-file');
      }
    }
    input.addEventListener('change', updateName);
    ['dragenter', 'dragover'].forEach(function (evt) {
      drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      drop.addEventListener(evt, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        input.files = e.dataTransfer.files;
        updateName();
      }
    });
  }
  setupDrop('csf-drop', 'csf', 'csf-filename');
  setupDrop('ticket-drop', 'ticket_file', 'ticket-filename');

  function fieldLabels() {
    return {
      razon_social: 'Razón social',
      regimen_fiscal: 'Régimen fiscal',
      uso_cfdi: 'Uso de CFDI',
      codigo_postal: 'Código postal',
      email: 'Correo',
      telefono: 'Teléfono'
    };
  }

  function renderMatch(data) {
    lastMatch = data;
    var labels = fieldLabels();
    matchData.innerHTML = '';
    Object.keys(labels).forEach(function (key) {
      if (!data[key]) return;
      var dt = document.createElement('dt');
      dt.textContent = labels[key];
      var dd = document.createElement('dd');
      dd.textContent = data[key];
      matchData.appendChild(dt);
      matchData.appendChild(dd);
    });
    matchBox.classList.add('show');
  }

  var lookupTimer = null;
  rfcInput.addEventListener('input', function () {
    rfcInput.value = rfcInput.value.toUpperCase();
    matchBox.classList.remove('show');
  });
  rfcInput.addEventListener('blur', function () {
    var rfc = rfcInput.value.trim();
    if (!RFC_RE.test(rfc)) return;
    clearTimeout(lookupTimer);
    lookupTimer = setTimeout(function () {
      fetch('/api/roseta/factura-lookup?rfc=' + encodeURIComponent(rfc))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
          if (json && json.found && json.data) renderMatch(json.data);
        })
        .catch(function () {});
    }, 150);
  });

  matchUseBtn.addEventListener('click', function () {
    if (!lastMatch) return;
    var map = {
      razon_social: 'razon',
      regimen_fiscal: 'regimen',
      uso_cfdi: 'usocfdi',
      codigo_postal: 'cp',
      email: 'email',
      telefono: 'telefono'
    };
    Object.keys(map).forEach(function (key) {
      if (lastMatch[key] != null) {
        var el = document.getElementById(map[key]);
        if (el) el.value = lastMatch[key];
      }
    });
    setStatus('Datos aplicados. Revisa que todo esté correcto antes de enviar.', 'info');
    matchBox.classList.remove('show');
  });
  matchDismissBtn.addEventListener('click', function () {
    matchBox.classList.remove('show');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('', '');

    if (form.website.value) return; // honeypot tripped, silently drop

    var rfc = rfcInput.value.trim().toUpperCase();
    if (!RFC_RE.test(rfc)) {
      setStatus('Revisa tu RFC, no tiene un formato válido.', 'error');
      rfcInput.focus();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var csfFile = document.getElementById('csf').files[0];
    if (!csfFile) {
      setStatus('Adjunta tu Constancia de Situación Fiscal vigente.', 'error');
      return;
    }
    var ticketFile = document.getElementById('ticket_file').files[0] || null;

    submitBtn.disabled = true;
    setStatus('Enviando tu solicitud…', 'info');

    var sucursalForTracking = form.sucursal.value;
    prepareAttachments(csfFile, ticketFile)
      .then(function (prepared) {
        var payload = {
          rfc: rfc,
          razon_social: form.razon_social.value.trim(),
          regimen_fiscal: form.regimen_fiscal.value,
          uso_cfdi: form.uso_cfdi.value,
          codigo_postal: form.codigo_postal.value.trim(),
          email: form.email.value.trim(),
          telefono: form.telefono.value.trim(),
          sucursal: form.sucursal.value,
          fecha_consumo: form.fecha_consumo.value,
          monto: form.monto.value,
          forma_pago: form.forma_pago.value,
          folio_ticket: form.folio_ticket.value.trim(),
          csf: prepared.csf,
          ticket: prepared.ticket,
          ticket_dropped: prepared.ticketDropped
        };
        return fetch('/api/roseta/factura-submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) {
          return r.json().then(function (json) { return { ok: r.ok, json: json, ticketDropped: prepared.ticketDropped }; });
        });
      })
      .then(function (res) {
        if (!res.ok || !res.json || !res.json.ok) {
          throw new Error((res.json && res.json.error) || 'No se pudo enviar tu solicitud.');
        }
        form.style.display = 'none';
        successEl.classList.add('show');
        folioEl.textContent = res.json.folio || '';
        if (res.json.folio) {
          statusLinkEl.href = '/roseta/factura/estatus?folio=' + encodeURIComponent(res.json.folio);
        }
        if (res.ticketDropped) {
          var noteEl = document.getElementById('rf-success-note');
          if (noteEl) noteEl.textContent = 'Tu ticket no se adjuntó automáticamente por su tamaño — puedes enviarlo por WhatsApp a facturación (449 895 8291) para agilizar tu factura.';
        }
        if (window.acaciaTrack) window.acaciaTrack('roseta_factura_submit', { sucursal: sucursalForTracking });
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'No se pudo enviar tu solicitud. Escríbenos a roseta.cafeteria@gmail.com.', 'error');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
