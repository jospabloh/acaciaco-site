(function () {
  'use strict';

  // Vercel serverless functions cap the whole request body at 4.5MB, and
  // base64 inflates raw bytes by ~4/3 — so the two attachments together must
  // stay well under that once encoded, with room for the JSON text fields.
  var CSF_MAX_BYTES = 3 * 1024 * 1024; // 3MB raw for the (required) CSF
  var COMBINED_MAX_BYTES = 3.2 * 1024 * 1024; // CSF + ticket raw, combined
  var RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

  // Régimen 605 (Sueldos y Salarios) receptors don't have deductible business
  // activity, so in practice only S01/CP01 apply to them — this is the one
  // régimen↔uso restriction corroborated consistently enough to encode here.
  // Everything else stays open: this form only *requests* an invoice, it
  // doesn't stamp the CFDI — Roseta's team confirms the final Uso de CFDI
  // with their invoicing software before timbrado.
  var USO_OPTIONS = [
    { value: 'G01', label: 'G01 · Adquisición de mercancías' },
    { value: 'G03', label: 'G03 · Gastos en general' },
    { value: 'I08', label: 'I08 · Otra maquinaria y equipo' },
    { value: 'P01', label: 'P01 · Por definir' },
    { value: 'S01', label: 'S01 · Sin efectos fiscales' },
    { value: 'CP01', label: 'CP01 · Pagos' }
  ];

  var form = document.getElementById('rf-form');
  if (!form) return;

  var statusEl = document.getElementById('rf-status');
  var submitBtn = document.getElementById('rf-submit');
  var successEl = document.getElementById('rf-success');
  var successTitleEl = document.getElementById('rf-success-title');
  var successBodyEl = document.getElementById('rf-success-body');
  var folioEl = document.getElementById('rf-folio');
  var statusLinkEl = document.getElementById('rf-status-link');

  var reviewEl = document.getElementById('rf-review');
  var reviewFiscalEl = document.getElementById('rf-review-fiscal');
  var reviewConsumoEl = document.getElementById('rf-review-consumo');
  var reviewStatusEl = document.getElementById('rf-review-status');
  var reviewEditBtn = document.getElementById('rf-review-edit');
  var reviewConfirmBtn = document.getElementById('rf-review-confirm');

  var rfcInput = document.getElementById('rfc');
  var razonInput = document.getElementById('razon');
  var regimenSelect = document.getElementById('regimen');
  var usocfdiSelect = document.getElementById('usocfdi');
  var regimenHint = document.getElementById('regimen-hint');
  var cpInput = document.getElementById('cp');
  var matchBox = document.getElementById('rfc-match');
  var matchData = document.getElementById('rfc-match-data');
  var matchUseBtn = document.getElementById('rfc-use');
  var matchDismissBtn = document.getElementById('rfc-dismiss');
  var lastMatch = null;

  var csfInput = document.getElementById('csf');
  var csfReqMark = document.getElementById('csf-req-mark');
  var csfHintEl = document.getElementById('csf-hint');
  var CSF_HINT_DEFAULT = csfHintEl.textContent;
  var CSF_HINT_KNOWN = 'Ya tenemos tu CSF en archivo — opcional, solo súbela si tu información fiscal cambió.';
  var csfOptional = false;

  // Roseta already has this customer's CSF on file from a prior request —
  // no need to make them dig it up and re-upload it every single time.
  // Re-validated server-side too; this only controls the client's UI/UX.
  function setCsfOptional(flag) {
    csfOptional = flag;
    csfInput.required = !flag;
    csfReqMark.style.display = flag ? 'none' : '';
    csfHintEl.textContent = flag ? CSF_HINT_KNOWN : CSF_HINT_DEFAULT;
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = kind || '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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

  // Prepares the CSF (required for new RFCs, optional for known ones — may
  // be null) and the ticket photo (always optional — dropped with a note if
  // it doesn't fit the combined budget, rather than blocking the submission).
  function prepareAttachments(csfFile, ticketFile) {
    return Promise.resolve()
      .then(function () {
        if (csfFile && csfFile.size > CSF_MAX_BYTES) {
          throw new Error('Tu CSF pesa más de 3 MB. Comprímela (o guárdala como PDF más ligero) e inténtalo de nuevo.');
        }
        if (!ticketFile) return [csfFile, null];
        return compressImageFile(ticketFile).then(function (compressed) { return [csfFile, compressed]; });
      })
      .then(function (pair) {
        var csf = pair[0], ticket = pair[1];
        var ticketDropped = false;
        if (csf && ticket && csf.size + ticket.size > COMBINED_MAX_BYTES) {
          ticket = null;
          ticketDropped = true;
        }
        return Promise.all([csf ? readAsBase64(csf) : Promise.resolve(null), ticket ? readAsBase64(ticket) : Promise.resolve(null)])
          .then(function (files) { return { csf: files[0], ticket: files[1], ticketDropped: ticketDropped }; });
      });
  }

  // Sends a document to Claude vision for a best-effort read. Always
  // resolves (never rejects) with { ok:false } on any failure — extraction is
  // a convenience, the form must stay usable without it.
  function extractDocument(kind, file) {
    return readAsBase64(file)
      .then(function (fileField) {
        return fetch('/api/roseta/factura-extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: kind, file: fileField })
        });
      })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false }; });
  }

  function fillIfEmpty(el, value) {
    if (el && value != null && value !== '' && !el.value) el.value = value;
  }

  function renderUsoOptions(regimenCode) {
    var current = usocfdiSelect.value;
    var opts = regimenCode === '605'
      ? USO_OPTIONS.filter(function (o) { return o.value === 'S01' || o.value === 'CP01'; })
      : USO_OPTIONS;
    usocfdiSelect.innerHTML = '<option value="">Selecciona…</option>' +
      opts.map(function (o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
    if (opts.some(function (o) { return o.value === current; })) usocfdiSelect.value = current;
  }
  regimenSelect.addEventListener('change', function () { renderUsoOptions(regimenSelect.value); });

  function renderRegimenFromCsf(regimenes) {
    if (!regimenes || !regimenes.length) return;
    var vigentes = regimenes.filter(function (r) { return r.vigente; });
    var list = vigentes.length ? vigentes : regimenes;
    var current = regimenSelect.value;
    regimenSelect.innerHTML = '<option value="">Selecciona…</option>' +
      list.map(function (r) {
        var label = escapeHtml(r.clave) + ' · ' + escapeHtml(r.descripcion || '');
        return '<option value="' + escapeHtml(r.clave) + '">' + label + '</option>';
      }).join('');
    if (list.some(function (r) { return r.clave === current; })) {
      regimenSelect.value = current;
    } else if (list.length === 1) {
      regimenSelect.value = list[0].clave;
    }
    regimenHint.classList.add('show');
    renderUsoOptions(regimenSelect.value);
  }

  function applyCsfData(data) {
    fillIfEmpty(razonInput, data.razon_social);
    fillIfEmpty(rfcInput, data.rfc ? String(data.rfc).toUpperCase() : null);
    fillIfEmpty(cpInput, data.codigo_postal);
    renderRegimenFromCsf(data.regimenes);
  }

  // Subtotal (before IVA) isn't shown on the form — it's only useful to
  // Roseta internally, so it rides along in the submit payload instead of
  // becoming another field the customer has to look at.
  var lastTicketSubtotal = null;

  function applyTicketData(data) {
    fillIfEmpty(document.getElementById('fecha'), data.fecha);
    if (data.monto != null) fillIfEmpty(document.getElementById('monto'), String(data.monto));
    if (data.forma_pago) {
      var sel = document.getElementById('forma_pago');
      if (sel && !sel.value) {
        var has = Array.prototype.some.call(sel.options, function (o) { return o.value === data.forma_pago; });
        if (has) sel.value = data.forma_pago;
      }
    }
    fillIfEmpty(document.getElementById('folio_ticket'), data.folio_ticket);
    lastTicketSubtotal = typeof data.subtotal === 'number' ? data.subtotal : null;
  }

  function setupDrop(dropId, inputId, filenameId, onFile) {
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
      if (onFile) onFile(f || null);
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

  var csfStatusEl = document.getElementById('csf-extract-status');
  setupDrop('csf-drop', 'csf', 'csf-filename', function (file) {
    if (!file) { csfStatusEl.textContent = ''; csfStatusEl.className = 'rf-extract-status'; return; }
    csfStatusEl.textContent = 'Leyendo tu CSF…';
    csfStatusEl.className = 'rf-extract-status busy';
    extractDocument('csf', file).then(function (res) {
      if (res && res.ok && res.data) {
        applyCsfData(res.data);
        csfStatusEl.textContent = '✓ Detectamos tus datos fiscales. Revísalos abajo.';
        csfStatusEl.className = 'rf-extract-status ok';
      } else {
        csfStatusEl.textContent = 'No pudimos leer tu CSF automáticamente. Llena tus datos fiscales a mano.';
        csfStatusEl.className = 'rf-extract-status warn';
      }
    });
  });

  var ticketStatusEl = document.getElementById('ticket-extract-status');
  setupDrop('ticket-drop', 'ticket_file', 'ticket-filename', function (file) {
    lastTicketSubtotal = null; // any previously-extracted subtotal no longer applies to this file
    if (!file) { ticketStatusEl.textContent = ''; ticketStatusEl.className = 'rf-extract-status'; return; }
    ticketStatusEl.textContent = 'Leyendo tu ticket…';
    ticketStatusEl.className = 'rf-extract-status busy';
    compressImageFile(file).then(function (compressed) {
      return extractDocument('ticket', compressed);
    }).then(function (res) {
      if (res && res.ok && res.data) {
        applyTicketData(res.data);
        ticketStatusEl.textContent = '✓ Detectamos datos de tu ticket. Revísalos en "Tu consumo".';
        ticketStatusEl.className = 'rf-extract-status ok';
      } else {
        ticketStatusEl.textContent = 'No pudimos leer tu ticket automáticamente. Llena "Tu consumo" a mano.';
        ticketStatusEl.className = 'rf-extract-status warn';
      }
    });
  });

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
    setCsfOptional(false);
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
    setCsfOptional(true);
    setStatus('Datos aplicados — no hace falta que subas tu CSF de nuevo, a menos que haya cambiado.', 'info');
    matchBox.classList.remove('show');
  });
  matchDismissBtn.addEventListener('click', function () {
    setCsfOptional(false);
    matchBox.classList.remove('show');
  });

  function selectedLabel(selectEl) {
    var opt = selectEl.options[selectEl.selectedIndex];
    return opt ? opt.textContent : '';
  }

  function addRow(dl, label, value) {
    if (!value) return;
    var dt = document.createElement('dt'); dt.textContent = label;
    var dd = document.createElement('dd'); dd.textContent = value;
    dl.appendChild(dt); dl.appendChild(dd);
  }

  function renderReview() {
    reviewFiscalEl.innerHTML = '';
    addRow(reviewFiscalEl, 'RFC', rfcInput.value.trim().toUpperCase());
    addRow(reviewFiscalEl, 'Razón social', form.razon_social.value.trim());
    addRow(reviewFiscalEl, 'Régimen fiscal', selectedLabel(regimenSelect));
    addRow(reviewFiscalEl, 'Uso de CFDI', selectedLabel(usocfdiSelect));
    addRow(reviewFiscalEl, 'Código postal', form.codigo_postal.value.trim());
    addRow(reviewFiscalEl, 'Correo', form.email.value.trim());
    addRow(reviewFiscalEl, 'Teléfono', form.telefono.value.trim());

    reviewConsumoEl.innerHTML = '';
    addRow(reviewConsumoEl, 'Sucursal', form.sucursal.value);
    addRow(reviewConsumoEl, 'Fecha de consumo', form.fecha_consumo.value);
    addRow(reviewConsumoEl, 'Monto', form.monto.value ? ('$' + form.monto.value + ' MXN') : '');
    addRow(reviewConsumoEl, 'Forma de pago', form.forma_pago.value);
    addRow(reviewConsumoEl, 'Movimiento', form.folio_ticket.value.trim());
    var csfFile = document.getElementById('csf').files[0];
    var ticketFile = document.getElementById('ticket_file').files[0];
    addRow(reviewConsumoEl, 'CSF adjunta', csfFile ? csfFile.name : (csfOptional ? 'No adjuntada — ya en archivo' : ''));
    addRow(reviewConsumoEl, 'Ticket adjunto', ticketFile ? ticketFile.name : 'No adjuntado');
  }

  function showReview() {
    renderReview();
    form.classList.add('hide');
    reviewEl.classList.add('show');
    reviewStatusEl.textContent = '';
  }

  function showForm() {
    reviewEl.classList.remove('show');
    form.classList.remove('hide');
  }

  reviewEditBtn.addEventListener('click', showForm);

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
      // Covers a missing CSF too: setCsfOptional() keeps #csf's `required`
      // attribute in lockstep with csfOptional, so the native check alone
      // is enough — no separate CSF presence check needed here.
      form.reportValidity();
      return;
    }

    showReview();
  });

  reviewConfirmBtn.addEventListener('click', function () {
    var rfc = rfcInput.value.trim().toUpperCase();
    var csfFile = document.getElementById('csf').files[0];
    var ticketFile = document.getElementById('ticket_file').files[0] || null;

    reviewConfirmBtn.disabled = true;
    reviewStatusEl.className = 'info';
    reviewStatusEl.textContent = 'Enviando tu solicitud…';

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
          ticket_subtotal: lastTicketSubtotal,
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
        reviewEl.classList.remove('show');
        successEl.classList.add('show');
        folioEl.textContent = res.json.folio || '';
        if (res.json.folio) {
          statusLinkEl.href = '/roseta/factura/estatus?folio=' + encodeURIComponent(res.json.folio);
        }
        if (res.json.duplicate) {
          // Same RFC + fecha + monto + correo as a request we already have —
          // reassure them it's covered rather than reading as an error.
          successTitleEl.textContent = 'Ya la teníamos registrada';
          successBodyEl.textContent = 'Ya nos habías pedido factura por este mismo consumo — no hace falta enviarla otra vez. Aquí está tu folio para dar seguimiento.';
        }
        if (res.ticketDropped) {
          var noteEl = document.getElementById('rf-success-note');
          if (noteEl) noteEl.textContent = 'Tu ticket no se adjuntó automáticamente por su tamaño — puedes enviarlo por WhatsApp a facturación (449 895 8291) para agilizar tu factura.';
        }
        if (window.acaciaTrack) window.acaciaTrack('roseta_factura_submit', { sucursal: sucursalForTracking });
      })
      .catch(function (err) {
        reviewStatusEl.className = 'error';
        reviewStatusEl.textContent = (err && err.message) || 'No se pudo enviar tu solicitud. Escríbenos a roseta.cafeteria@gmail.com.';
      })
      .finally(function () {
        reviewConfirmBtn.disabled = false;
      });
  });
})();
