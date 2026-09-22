(function () {
  'use strict';

  // Internal panel for Roseta. The password lives in sessionStorage only —
  // it is gone when the tab closes — and travels in a header on every call.
  // Every value rendered here comes from the Sheet, which the public form
  // fills in, so the DOM is built with textContent and never innerHTML.
  var KEY = 'roseta-admin-key';
  var HEADER = 'x-roseta-admin';
  var MAX_COMBINED_BYTES = 1.4 * 1024 * 1024; // raw; base64 inflates by ~4/3

  // Mirrors FICO_3C_SUCURSAL / ARCHIVOS_AVISO_SUCURSAL in
  // api/roseta/_facturaRows.ts — that copy is canonical (factura-admin-list.ts
  // and factura-admin-redirect.ts both read from it); this one only decides
  // what to show, never what actually gets sent or written to the Sheet.
  // Note there's no local copy of sucursalRedirectEstatus(): once a row is
  // redirected, s.estatus already IS the label to show ("Roseta Plaza
  // Universidad") — admin.js displays it, it doesn't recompute it.
  var FICO_3C_SUCURSAL = 'Fico 3C (Tres Centurias)';
  var ARCHIVOS_AVISO_SUCURSAL = 'Aviso de sucursal';

  var gateWrap = document.getElementById('ad-gate-wrap');
  var gateForm = document.getElementById('ad-gate-form');
  var passInput = document.getElementById('ad-pass');
  var gateMsg = document.getElementById('ad-gate-msg');
  var panel = document.getElementById('ad-panel');
  var listEl = document.getElementById('ad-list');
  var msgEl = document.getElementById('ad-msg');
  var countEl = document.getElementById('ad-count');
  var filterBtns = [].slice.call(document.querySelectorAll('.ad-filter'));

  var filtro = 'pendientes';
  var openFolio = null; // survives a reload of the list

  function key() {
    try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function setKey(v) {
    try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function say(el, text, kind) {
    el.className = 'ad-msg' + (kind ? ' ' + kind : '');
    el.textContent = text || '';
  }

  // A 401 anywhere means the stored password is no longer good: drop it and
  // send the operator back to the gate rather than leaving a dead panel.
  function toGate(message) {
    setKey('');
    panel.hidden = true;
    gateWrap.hidden = false;
    passInput.value = '';
    say(gateMsg, message || '', message ? 'error' : '');
    passInput.focus();
  }

  function api(path, options) {
    var opts = options || {};
    opts.headers = opts.headers || {};
    opts.headers[HEADER] = key();
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (r.status === 401) { toGate('Contraseña incorrecta.'); throw new Error('unauthorized'); }
        return { ok: r.ok, status: r.status, json: json };
      });
    });
  }

  function fmtMoney(v) {
    var n = Number(v);
    return isFinite(n) && v !== '' ? '$' + n.toFixed(2) + ' MXN' : (v || '—');
  }

  // What gets copied for a money field is not what gets displayed: Roseta
  // pastes this straight into her stamping/accounting software, which wants
  // a bare number, not "$123.45 MXN".
  function plainAmount(v) {
    var n = Number(v);
    return isFinite(n) && v !== '' ? n.toFixed(2) : (v || '');
  }

  function copyButton(value) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ad-copy';
    btn.textContent = 'Copiar';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var done = function () {
        btn.textContent = 'Copiado';
        btn.classList.add('done');
        setTimeout(function () { btn.textContent = 'Copiar'; btn.classList.remove('done'); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () { btn.textContent = 'No se pudo'; });
      } else {
        // Older browsers: select a throwaway field and use the legacy call.
        var ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'No se pudo'; }
        document.body.removeChild(ta);
      }
    });
    return btn;
  }

  // copyValue defaults to the displayed value, but a money field passes a
  // plain ###.## in its place — see plainAmount above.
  function captureRow(label, value, isCode, copyValue) {
    var wrap = document.createElement('div');
    wrap.className = 'ad-cap' + (isCode ? ' code' : '');
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = value || '—';
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    if (value) wrap.appendChild(copyButton(copyValue !== undefined ? copyValue : value));
    return wrap;
  }

  function fileDrop(kind, accept, onPick) {
    var label = document.createElement('label');
    label.className = 'ad-drop';
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    var kindEl = document.createElement('span');
    kindEl.className = 'ad-drop-kind';
    kindEl.textContent = kind.toUpperCase();
    var state = document.createElement('span');
    state.className = 'ad-drop-state';
    state.textContent = 'Sin archivo';
    label.appendChild(input);
    label.appendChild(kindEl);
    label.appendChild(state);

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) { label.classList.remove('has-file'); state.textContent = 'Sin archivo'; onPick(null); return; }
      var reader = new FileReader();
      reader.onload = function () {
        label.classList.add('has-file');
        state.textContent = file.name;
        onPick({ name: file.name, dataUrl: String(reader.result), size: file.size });
      };
      reader.onerror = function () {
        label.classList.remove('has-file');
        state.textContent = 'No se pudo leer';
        onPick(null);
      };
      reader.readAsDataURL(file);
    });
    return label;
  }

  // Heat bar toward the 33-hour ("3 días hábiles" × 11 business hours/day)
  // promise. The server already did the hour math (businessHoursElapsed in
  // _facturaRows.ts, counted from the request's actual timestamp so a
  // request filed late in the day isn't credited with hours it never had)
  // and sends horas_habiles_transcurridas + horas_habiles_meta; this only
  // turns that into a bar and a caption.
  //
  // The fill's width is elapsed/meta as normal, but its background-size is
  // stretched so the exposed slice of the green→amber→red gradient lines up
  // with where elapsed/meta actually sits on the full 0–100% scale — a bar
  // at 20% shows green, not a full rainbow squeezed into a fifth of the
  // width. That's what makes it read as "heating up" while it fills, per
  // Roseta's ask, rather than just widening in one flat color.
  function slaHeatBarNode(s, facturada) {
    var elapsed = Number(s.horas_habiles_transcurridas);
    var meta = Number(s.horas_habiles_meta);
    if (!isFinite(elapsed) || !isFinite(meta) || meta <= 0) return null;

    var pct = (elapsed / meta) * 100;
    var clamped = Math.max(0, Math.min(100, pct));
    var late = pct > 100;
    var horas = Math.round(elapsed);
    var metaHoras = Math.round(meta);

    var wrap = document.createElement('div');
    wrap.className = 'ad-heat' + (facturada ? ' ad-heat-done' : '') + (late ? ' ad-heat-late' : '');

    var track = document.createElement('div');
    track.className = 'ad-heat-track';
    var fill = document.createElement('div');
    fill.className = 'ad-heat-fill';
    fill.style.width = clamped + '%';
    // Undoes the gradient's own re-stretch to the fill's (narrower) box: at
    // 20% width, a background-size of 500% makes the gradient act as if it
    // were painted across the full-width track all along.
    fill.style.backgroundSize = (clamped > 0 ? (10000 / clamped) : 100) + '% 100%';
    track.appendChild(fill);
    wrap.appendChild(track);

    var caption = document.createElement('span');
    caption.className = 'ad-heat-caption';
    if (facturada) {
      caption.textContent = horas === 0
        ? 'Entregada dentro de la misma hora'
        : 'Entregada en ' + horas + (horas === 1 ? ' hora hábil' : ' horas hábiles');
    } else if (late) {
      caption.textContent = horas + 'h de ' + metaHoras + 'h hábiles · ' + (horas - metaHoras) + 'h tarde';
    } else {
      caption.textContent = horas + 'h de ' + metaHoras + 'h hábiles';
    }
    wrap.appendChild(caption);

    return wrap;
  }

  function itemNode(s) {
    var facturada = s.estatus === 'Facturada';
    // Estatus can't be string-matched for this anymore — it's the branch
    // name now ("Roseta Plaza Universidad"), which varies per row. Archivos
    // enviados is the marker: factura-admin-send.ts always writes real
    // PDF/XML filenames there, so this exact string only ever means one
    // thing.
    var wrongBranch = s.archivos === ARCHIVOS_AVISO_SUCURSAL;
    // Still worth flagging even though nothing has been sent yet — this is
    // what surfaces the backlog of requests filed before this feature
    // existed: they're already sitting in Pendientes, unmarked, and this is
    // the only thing that makes them stand out in that list instead of
    // requiring Roseta to open every row and read the sucursal by hand.
    var needsRedirect = !facturada && !wrongBranch && s.sucursal && s.sucursal !== FICO_3C_SUCURSAL;
    var notified = !!s.notificado_el;

    var item = document.createElement('article');
    item.className = 'ad-item' + (facturada ? ' facturada' : '') + (wrongBranch ? ' otra-sucursal' : '');
    if (s.folio === openFolio) item.classList.add('open');

    // Header ------------------------------------------------------------
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'ad-head';
    head.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

    var left = document.createElement('span');
    var folio = document.createElement('span');
    folio.className = 'ad-folio';
    folio.textContent = s.folio;
    var who = document.createElement('span');
    who.className = 'ad-who';
    who.textContent = [s.razon_social, s.rfc, s.sucursal, s.fecha_consumo].filter(Boolean).join(' · ');
    left.appendChild(folio);
    left.appendChild(document.createElement('br'));
    left.appendChild(who);
    // No heat bar once redirected — there's no invoice coming, so "hours
    // toward delivery" no longer means anything for this row.
    var heat = wrongBranch ? null : slaHeatBarNode(s, facturada);
    if (heat) left.appendChild(heat);

    var right = document.createElement('span');
    right.className = 'ad-right';
    var amount = document.createElement('span');
    amount.className = 'ad-amount';
    amount.textContent = fmtMoney(s.monto);
    if (needsRedirect) {
      var flag = document.createElement('span');
      flag.className = 'ad-badge ad-badge-flag';
      flag.textContent = 'Otra sucursal';
      right.appendChild(flag);
    }
    var badge = document.createElement('span');
    badge.className = 'ad-badge ' + (facturada ? 'facturada' : wrongBranch ? 'otra-sucursal' : 'pendiente');
    // wrongBranch shows the Sheet's own Estatus text directly — it already
    // IS the branch the customer was sent to ("Roseta Plaza Universidad"),
    // not a value this file recomputes.
    badge.textContent = facturada ? 'Facturada' : wrongBranch ? s.estatus : 'Pendiente';
    right.appendChild(amount);
    right.appendChild(badge);

    head.appendChild(left);
    head.appendChild(right);
    head.addEventListener('click', function () {
      var nowOpen = !item.classList.contains('open');
      item.classList.toggle('open', nowOpen);
      head.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      openFolio = nowOpen ? s.folio : null;
    });
    item.appendChild(head);

    // Body --------------------------------------------------------------
    var body = document.createElement('div');
    body.className = 'ad-body';

    var capture = document.createElement('dl');
    capture.className = 'ad-capture';
    [
      ['RFC', s.rfc, true],
      ['Razón social', s.razon_social, false],
      // Shows clave + name, copies the bare clave (see factura-admin-list).
      // Not marked as code: `.ad-cap.code dd` is monospaced with letter
      // spacing, which suits "601" but turns a 40-character Spanish name into
      // a wrapped wall. The clave still leads the line.
      ['Régimen fiscal', s.regimen_fiscal, false, s.regimen_clave],
      ['Uso de CFDI', s.uso_cfdi, true],
      ['Código postal', s.codigo_postal, true],
      ['Correo', s.email, false],
      ['Teléfono', s.telefono, false],
      ['Fecha de consumo', s.fecha_consumo, false],
      ['Forma de pago', s.forma_pago, false],
      ['Movimiento', s.folio_ticket, true],
      ['Subtotal', s.subtotal ? fmtMoney(s.subtotal) : '', true, plainAmount(s.subtotal)],
      ['IVA', s.iva ? fmtMoney(s.iva) : '', true, plainAmount(s.iva)],
      ['Total', fmtMoney(s.monto), true, plainAmount(s.monto)]
    ].forEach(function (f) { capture.appendChild(captureRow(f[0], f[1], f[2], f[3])); });
    body.appendChild(capture);

    if (notified) {
      var note = document.createElement('p');
      note.className = 'ad-sent-note';
      note.textContent = (wrongBranch ? 'Se avisó al cliente el ' : 'Enviada al cliente el ') +
        s.notificado_el.slice(0, 10) + (s.archivos ? ' · ' + s.archivos : '');
      // The Sheet records that we sent it. Whether it actually landed — or
      // bounced, or is sitting in spam — only Resend knows, so link straight
      // to that message's delivery record. Missing on requests sent before
      // the id was stored.
      if (s.resend_url) {
        note.appendChild(document.createTextNode(' · '));
        var link = document.createElement('a');
        link.className = 'ad-resend-link';
        link.href = s.resend_url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Ver entrega en Resend ↗';
        note.appendChild(link);
      }
      body.appendChild(note);
    }

    // Sucursal redirect ---------------------------------------------------
    // Only for requests that aren't Fico 3C — this system doesn't invoice
    // any other branch, so this is where that gets resolved instead of a
    // PDF/XML. Shown whether the row is brand-new or was filed before this
    // existed: sucursal is the only thing that decides it, not estatus.
    if (s.sucursal && s.sucursal !== FICO_3C_SUCURSAL) {
      var redirectBox = document.createElement('div');
      redirectBox.className = 'ad-redirect';
      var rh4 = document.createElement('h4');
      rh4.textContent = wrongBranch ? 'Aviso enviado a ' + s.estatus : 'Esta solicitud no es de Fico 3C';
      var rwhy = document.createElement('p');
      rwhy.className = 'ad-why';
      rwhy.textContent = 'Este sistema sólo factura consumos de Fico 3C (Tres Centurias). Avísale al cliente y dale el contacto correcto de ' + s.sucursal + '.';
      redirectBox.appendChild(rh4);
      redirectBox.appendChild(rwhy);

      var redirectBtn = document.createElement('button');
      redirectBtn.type = 'button';
      redirectBtn.className = 'btn btn-ghost ad-redirect-send';
      redirectBtn.textContent = wrongBranch ? 'Reenviar aviso' : 'Enviar aviso de sucursal';
      redirectBox.appendChild(redirectBtn);

      var redirectMsg = document.createElement('p');
      redirectMsg.className = 'ad-item-msg';
      redirectMsg.setAttribute('role', 'status');
      redirectMsg.setAttribute('aria-live', 'polite');
      redirectBox.appendChild(redirectMsg);

      redirectBtn.addEventListener('click', function () {
        if (wrongBranch && !window.confirm(
          'Ya se le avisó a este cliente el ' + s.notificado_el.slice(0, 10) +
          '. ¿Enviarlo otra vez?')) return;

        redirectBtn.disabled = true;
        redirectMsg.className = 'ad-item-msg';
        redirectMsg.textContent = 'Enviando…';

        api('/api/roseta/factura-admin-redirect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folio: s.folio })
        }).then(function (res) {
          if (!res.ok || !res.json.ok) {
            redirectMsg.className = 'ad-item-msg error';
            redirectMsg.textContent = res.json.error || 'No se pudo enviar. Intenta de nuevo.';
            redirectBtn.disabled = false;
            return;
          }
          if (res.json.warning) {
            redirectMsg.className = 'ad-item-msg warn';
            redirectMsg.textContent = res.json.warning;
            return;
          }
          redirectMsg.className = 'ad-item-msg ok';
          redirectMsg.textContent = 'Aviso enviado a ' + res.json.email + '.';
          setTimeout(load, 900);
        }).catch(function (err) {
          if (err && err.message === 'unauthorized') return;
          redirectMsg.className = 'ad-item-msg error';
          redirectMsg.textContent = 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
          redirectBtn.disabled = false;
        });
      });

      body.appendChild(redirectBox);
    }

    // Upload ------------------------------------------------------------
    var upload = document.createElement('div');
    upload.className = 'ad-upload';
    var h4 = document.createElement('h4');
    h4.textContent = notified ? 'Reenviar la factura' : 'Enviar la factura al cliente';
    var why = document.createElement('p');
    why.className = 'ad-why';
    why.textContent = 'Se piden los dos archivos: el XML es el comprobante fiscal válido y el PDF es su representación impresa.';
    upload.appendChild(h4);
    upload.appendChild(why);

    var picked = { pdf: null, xml: null };
    var drops = document.createElement('div');
    drops.className = 'ad-drops';
    drops.appendChild(fileDrop('pdf', '.pdf', function (f) { picked.pdf = f; sync(); }));
    drops.appendChild(fileDrop('xml', '.xml,text/xml,application/xml', function (f) { picked.xml = f; sync(); }));
    upload.appendChild(drops);

    var send = document.createElement('button');
    send.type = 'button';
    send.className = 'btn btn-primary ad-send';
    send.disabled = true;
    send.textContent = notified ? 'Reenviar al cliente' : 'Enviar al cliente';
    upload.appendChild(send);

    var itemMsg = document.createElement('p');
    itemMsg.className = 'ad-item-msg';
    itemMsg.setAttribute('role', 'status');
    itemMsg.setAttribute('aria-live', 'polite');
    upload.appendChild(itemMsg);

    function sync() {
      var both = !!(picked.pdf && picked.xml);
      var tooBig = both && (picked.pdf.size + picked.xml.size) > MAX_COMBINED_BYTES;
      send.disabled = !both || tooBig;
      if (tooBig) {
        itemMsg.className = 'ad-item-msg error';
        itemMsg.textContent = 'Los dos archivos juntos pesan demasiado. Un CFDI normal pesa mucho menos — revisa que sean los correctos.';
      } else if (itemMsg.classList.contains('error')) {
        itemMsg.className = 'ad-item-msg';
        itemMsg.textContent = '';
      }
    }

    send.addEventListener('click', function () {
      if (send.disabled) return;
      if (notified && !window.confirm(
        'Esta solicitud ya se le envió al cliente el ' + s.notificado_el.slice(0, 10) +
        '. ¿Enviar otra copia?')) return;

      send.disabled = true;
      itemMsg.className = 'ad-item-msg';
      itemMsg.textContent = 'Enviando…';

      api('/api/roseta/factura-admin-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          folio: s.folio,
          pdf: { name: picked.pdf.name, dataUrl: picked.pdf.dataUrl },
          xml: { name: picked.xml.name, dataUrl: picked.xml.dataUrl }
        })
      }).then(function (res) {
        if (!res.ok || !res.json.ok) {
          itemMsg.className = 'ad-item-msg error';
          itemMsg.textContent = res.json.error || 'No se pudo enviar. Intenta de nuevo.';
          send.disabled = false;
          return;
        }
        if (res.json.warning) {
          // The mail went out; do not offer to send again.
          itemMsg.className = 'ad-item-msg warn';
          itemMsg.textContent = res.json.warning;
          return;
        }
        itemMsg.className = 'ad-item-msg ok';
        itemMsg.textContent = 'Enviada a ' + res.json.email + '.';
        setTimeout(load, 900);
      }).catch(function (err) {
        if (err && err.message === 'unauthorized') return;
        itemMsg.className = 'ad-item-msg error';
        itemMsg.textContent = 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
        send.disabled = false;
      });
    });

    body.appendChild(upload);
    item.appendChild(body);
    return item;
  }

  function load() {
    say(msgEl, 'Cargando…');
    listEl.innerHTML = '';
    countEl.textContent = '';
    api('/api/roseta/factura-admin-list?filtro=' + encodeURIComponent(filtro))
      .then(function (res) {
        if (!res.ok || !res.json.ok) {
          say(msgEl, res.json.error || 'No se pudo cargar la lista.', 'error');
          return;
        }
        say(msgEl, '');
        var list = res.json.solicitudes || [];
        countEl.textContent = list.length === 1 ? '1 solicitud' : list.length + ' solicitudes';
        if (!list.length) {
          var empty = document.createElement('p');
          empty.className = 'ad-empty';
          empty.textContent = filtro === 'pendientes'
            ? 'No hay solicitudes pendientes. Todo al día.'
            : 'No hay solicitudes en este filtro.';
          listEl.appendChild(empty);
          return;
        }
        list.forEach(function (s) { listEl.appendChild(itemNode(s)); });
      })
      .catch(function (err) {
        if (err && err.message === 'unauthorized') return;
        say(msgEl, 'No se pudo cargar la lista. Revisa tu conexión.', 'error');
      });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filtro = btn.getAttribute('data-filtro');
      filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      openFolio = null;
      load();
    });
  });

  function enterPanel() {
    gateWrap.hidden = true;
    panel.hidden = false;
    load();
  }

  gateForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = passInput.value;
    if (!value) return;
    setKey(value);
    say(gateMsg, 'Verificando…');
    // The listing call is the credential check: a 401 sends us back here.
    api('/api/roseta/factura-admin-list?filtro=pendientes')
      .then(function (res) {
        if (!res.ok || !res.json.ok) {
          say(gateMsg, res.json.error || 'No se pudo entrar.', 'error');
          return;
        }
        say(gateMsg, '');
        enterPanel();
      })
      .catch(function (err) {
        if (err && err.message === 'unauthorized') return;
        say(gateMsg, 'No se pudo conectar. Intenta de nuevo.', 'error');
      });
  });

  if (key()) enterPanel(); else passInput.focus();
})();
