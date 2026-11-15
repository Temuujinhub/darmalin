// DAR AL RIMAL — Request for Quotation form
// Validates in the browser for fast feedback, then POSTs to /api/rfq,
// where the same rules are enforced again and the request is stored.
// The "thank you" screen appears only after the server confirms the
// request was saved; if it could not be, the buyer is offered a one-tap
// WhatsApp or email hand-off with the details already written out.

(function () {
  var form = document.getElementById('rfq-form');
  if (!form) return;

  var WA_NUMBER = '971523527887';
  var DESK_EMAIL = 'info@dar-rimal.ae';
  var MAX_FILE = 5 * 1024 * 1024;
  var FREE_MAIL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com',
    'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.ru',
    'yandex.ru', 'yandex.com', 'qq.com', '163.com', '126.com', 'gmx.com', 'gmx.net'];
  var EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

  var loadedAt = Date.now();
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    product: $('rfq-product'), quantity: $('rfq-quantity'), unit: $('rfq-unit'),
    incoterm: $('rfq-incoterm'), destination: $('rfq-destination'), payment: $('rfq-payment'),
    company: $('rfq-company'), role: $('rfq-role'), name: $('rfq-name'), email: $('rfq-email'),
    cc: $('rfq-cc'), phone: $('rfq-phone'), file: $('rfq-file'), notes: $('rfq-notes'),
    trap: $('rfq-ref-code'), btn: $('rfq-submit-btn'), formError: $('rfq-form-error'),
    success: $('rfq-success'), fallback: $('rfq-fallback')
  };

  // ---- helpers ----
  function orderType() {
    var r = form.querySelector('input[name="orderType"]:checked');
    return r ? r.value : '';
  }

  function fullPhone() {
    var raw = el.phone.value.replace(/[\s().-]/g, '');
    if (raw.charAt(0) === '+') return raw;
    if (raw.indexOf('00') === 0) return '+' + raw.slice(2);
    return el.cc.value + raw.replace(/^0+/, '');
  }

  function group(field) { return form.querySelector('[data-field="' + field + '"]'); }

  function setError(field, msg) {
    var g = group(field);
    if (!g) return;
    var box = g.querySelector('.field-error');
    if (box) box.textContent = msg || '';
    g.classList.toggle('has-error', !!msg);
    g.querySelectorAll('input, select, textarea').forEach(function (c) {
      if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    });
  }

  var rules = {
    product: function () { return el.product.value ? '' : 'Select a product.'; },
    orderType: function () { return orderType() ? '' : 'Choose spot purchase or term contract.'; },
    quantity: function () {
      var q = parseFloat(el.quantity.value);
      return isFinite(q) && q > 0 ? '' : 'Enter a quantity greater than zero.';
    },
    unit: function () { return el.unit.value ? '' : 'Select a unit.'; },
    incoterm: function () { return el.incoterm.value ? '' : 'Select delivery terms.'; },
    destination: function () {
      var inc = el.incoterm.value;
      if (inc && inc !== 'FOB' && el.destination.value.trim().length < 2) {
        return 'Destination port or country is needed for ' + inc + ' delivery.';
      }
      return '';
    },
    payment: function () { return el.payment.value ? '' : 'Select a payment method.'; },
    company: function () { return el.company.value.trim().length >= 2 ? '' : 'Enter your company name.'; },
    buyerRole: function () { return el.role.value ? '' : 'Select your role.'; },
    contactName: function () { return el.name.value.trim().length >= 2 ? '' : 'Enter the contact person\'s name.'; },
    email: function () { return EMAIL_RE.test(el.email.value.trim()) ? '' : 'Enter a valid email address, e.g. name@company.com.'; },
    phone: function () {
      var msg = 'Enter the number with country code, e.g. +971 52 352 7887.';
      var full = fullPhone();
      if (!/^\+[1-9]\d{7,14}$/.test(full)) return msg;
      // With a country code picked from the list, the local part alone
      // must still look like a phone number.
      var raw = el.phone.value.replace(/[\s().-]/g, '');
      if (raw.charAt(0) !== '+' && raw.indexOf('00') !== 0 && raw.replace(/^0+/, '').length < 6) return msg;
      return '';
    },
    file: function () {
      var f = el.file.files && el.file.files[0];
      if (!f) return '';
      if (!/\.(pdf|docx?)$/i.test(f.name)) return 'Attach a PDF or Word document (.pdf, .docx, .doc).';
      if (f.size > MAX_FILE) return 'Attachment is larger than 5 MB.';
      return '';
    }
  };

  function validateField(field) {
    var msg = rules[field] ? rules[field]() : '';
    setError(field, msg);
    return !msg;
  }

  function validateAll() {
    var firstBad = null;
    Object.keys(rules).forEach(function (f) {
      if (!validateField(f) && !firstBad) firstBad = f;
    });
    return firstBad;
  }

  // ---- live behaviour ----
  var fieldOf = {
    'rfq-product': 'product', 'rfq-quantity': 'quantity', 'rfq-unit': 'unit', 'rfq-incoterm': 'incoterm',
    'rfq-destination': 'destination', 'rfq-payment': 'payment', 'rfq-company': 'company', 'rfq-role': 'buyerRole',
    'rfq-name': 'contactName', 'rfq-email': 'email', 'rfq-phone': 'phone', 'rfq-cc': 'phone'
  };
  Object.keys(fieldOf).forEach(function (id) {
    var c = $(id);
    c.addEventListener('blur', function () { validateField(fieldOf[id]); });
    c.addEventListener('input', function () {
      if (group(fieldOf[id]).classList.contains('has-error')) validateField(fieldOf[id]);
    });
  });

  function syncDestination() {
    var needed = el.incoterm.value && el.incoterm.value !== 'FOB';
    $('rfq-dest-req').hidden = !needed;
    if (group('destination').classList.contains('has-error')) validateField('destination');
  }
  el.incoterm.addEventListener('change', syncDestination);

  form.querySelectorAll('input[name="orderType"]').forEach(function (r) {
    r.addEventListener('change', function () {
      $('rfq-qty-hint').textContent = orderType() === 'Term Contract' ? 'Per month.' : 'Per shipment.';
    });
  });

  el.email.addEventListener('blur', function () {
    var m = EMAIL_RE.exec(el.email.value.trim());
    $('rfq-email-hint').hidden = !(m && FREE_MAIL.indexOf(m[1].toLowerCase()) !== -1);
  });

  el.file.addEventListener('change', function () {
    var f = el.file.files && el.file.files[0];
    $('rfq-file-label').textContent = f
      ? f.name + ' (' + (f.size / 1024 / 1024).toFixed(2) + ' MB)'
      : 'Attach a PDF or Word file — 5 MB maximum';
    $('rfq-file-clear').hidden = !f;
    validateField('file');
  });
  $('rfq-file-clear').addEventListener('click', function () {
    el.file.value = '';
    el.file.dispatchEvent(new Event('change'));
  });

  // Arriving from a product page: contact.html?product=Crude%20Oil
  try {
    var wanted = new URLSearchParams(window.location.search).get('product');
    if (wanted) {
      Array.prototype.forEach.call(el.product.options, function (o) {
        if (o.value === wanted || o.text === wanted) el.product.value = o.value || o.text;
      });
    }
  } catch (e) { /* no preselection */ }

  // ---- payload ----
  function collect() {
    return {
      product: el.product.value,
      orderType: orderType(),
      quantity: el.quantity.value,
      unit: el.unit.value,
      incoterm: el.incoterm.value,
      destination: el.destination.value.trim(),
      payment: el.payment.value,
      company: el.company.value.trim(),
      buyerRole: el.role.value,
      contactName: el.name.value.trim(),
      email: el.email.value.trim(),
      phone: fullPhone(),
      notes: el.notes.value.trim()
    };
  }

  function summaryText(d) {
    return [
      'Request for Quotation — Dar Al Rimal',
      '',
      'Product: ' + d.product,
      'Order type: ' + d.orderType,
      'Quantity: ' + d.quantity + ' ' + d.unit,
      'Incoterms: ' + d.incoterm,
      'Destination: ' + (d.destination || '—'),
      'Payment: ' + d.payment,
      '',
      'Company: ' + d.company + ' (' + d.buyerRole + ')',
      'Contact: ' + d.contactName,
      'Email: ' + d.email,
      'Phone / WhatsApp: ' + d.phone,
      d.notes ? '\nNotes: ' + d.notes : ''
    ].join('\n').trim();
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('read')); };
      r.readAsDataURL(file);
    });
  }

  // ---- states ----
  function setLoading(on) {
    el.btn.disabled = on;
    el.btn.classList.toggle('is-loading', on);
    el.btn.querySelector('.btn-label').textContent = on ? 'Submitting…' : 'Submit request';
    form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function show(panel) {
    form.hidden = panel !== 'form';
    el.success.hidden = panel !== 'success';
    el.fallback.hidden = panel !== 'fallback';
    var target = panel === 'form' ? form : (panel === 'success' ? el.success : el.fallback);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (panel !== 'form') target.focus({ preventScroll: true });
  }

  function showSuccess(d, ref) {
    $('rfq-ref').textContent = ref;
    $('rfq-sum-product').textContent = d.product + ' · ' + d.orderType;
    $('rfq-sum-qty').textContent = Number(d.quantity).toLocaleString('en-US') + ' ' + d.unit;
    $('rfq-sum-terms').textContent = d.incoterm + (d.destination ? ' ' + d.destination : '') + ' · ' + d.payment;
    $('rfq-wa-followup').href = 'https://wa.me/' + WA_NUMBER + '?text=' +
      encodeURIComponent('Hello, I have submitted request ' + ref + ' (' + d.product + ', ' + d.quantity + ' ' + d.unit + ') on dar-rimal.ae.');
    show('success');
  }

  function showFallback(d, hadFile) {
    var text = summaryText(d);
    $('rfq-fb-wa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
    $('rfq-fb-mail').href = 'mailto:' + DESK_EMAIL +
      '?subject=' + encodeURIComponent('RFQ — ' + d.product + ' — ' + d.company) +
      '&body=' + encodeURIComponent(text);
    $('rfq-fb-filenote').hidden = !hadFile;
    show('fallback');
  }

  // ---- submit ----
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    el.formError.hidden = true;

    var bad = validateAll();
    if (bad) {
      el.formError.textContent = 'Please correct the highlighted fields.';
      el.formError.hidden = false;
      var g = group(bad);
      var c = g && g.querySelector('input:not([type="file"]), select, textarea');
      if (c) c.focus();
      if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var d = collect();
    var file = el.file.files && el.file.files[0];
    setLoading(true);

    var filePart = file
      ? readFile(file).then(function (b64) { return { name: file.name, type: file.type, data: b64 }; })
      : Promise.resolve(null);

    filePart
      .then(function (f) {
        var body = Object.assign({}, d, { hp: el.trap.value, elapsedMs: Date.now() - loadedAt });
        if (f) body.file = f;
        return fetch('/api/rfq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (out) { return { res: res, out: out }; });
      })
      .then(function (r) {
        setLoading(false);
        if (r.res.ok && r.out && r.out.ok === true && r.out.ref) {
          showSuccess(d, r.out.ref);
          return;
        }
        if (r.res.status === 422 && r.out && r.out.error === 'validation' && r.out.fields) {
          var first = null;
          Object.keys(r.out.fields).forEach(function (f) {
            setError(f, r.out.fields[f]);
            if (!first) first = f;
          });
          el.formError.textContent = 'Please correct the highlighted fields.';
          el.formError.hidden = false;
          var g = first && group(first);
          if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        showFallback(d, !!file);
      })
      .catch(function () {
        setLoading(false);
        showFallback(d, !!file);
      });
  });

  $('rfq-again').addEventListener('click', function () {
    form.reset();
    el.file.dispatchEvent(new Event('change'));
    Object.keys(rules).forEach(function (f) { setError(f, ''); });
    $('rfq-email-hint').hidden = true;
    $('rfq-qty-hint').textContent = 'Per shipment.';
    syncDestination();
    loadedAt = Date.now();
    show('form');
  });
  $('rfq-fb-retry').addEventListener('click', function () { show('form'); });
})();
