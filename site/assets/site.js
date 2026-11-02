// EZUP Crane Systems — site behavior
(function () {
  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  // Request forms.
  // When the site goes live, set data-endpoint on the form to the Cloudflare
  // Worker URL; requests are then POSTed as JSON. Until then the visitor gets a
  // formatted copy of the request to send by email.
  document.querySelectorAll('form[data-request]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var old = form.querySelector('.form-result, .form-error');
      if (old) old.remove();

      var missing = [];
      form.querySelectorAll('[required]').forEach(function (el) {
        if (!String(el.value).trim()) {
          var l = form.querySelector('label[for="' + el.id + '"]');
          missing.push(l ? l.textContent.replace('*', '').trim() : el.name);
        }
      });
      var btn = form.querySelector('button[type="submit"]');
      if (missing.length) {
        var err = document.createElement('p');
        err.className = 'form-error';
        err.setAttribute('role', 'alert');
        err.textContent = 'Please fill in: ' + missing.join(', ') + '.';
        btn.insertAdjacentElement('beforebegin', err);
        return;
      }

      var data = {};
      var lines = [form.getAttribute('data-request')];
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        if (!el.name || el.name === 'website' && !el.value) return;
        var v = String(el.value).trim();
        data[el.name] = v;
        if (v) {
          var l = form.querySelector('label[for="' + el.id + '"]');
          lines.push((l ? l.textContent.replace('*', '').trim() : el.name) + ': ' + v);
        }
      });
      var text = lines.join('\n');

      var endpoint = form.getAttribute('data-endpoint');
      if (endpoint) {
        btn.disabled = true;
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: form.getAttribute('data-request'), fields: data }) })
          .then(function (r) { if (!r.ok) throw new Error(); form.reset(); showDone(form, btn, 'Thank you. Your request was sent to EZUP. We reply within one business day.', null); })
          .catch(function () { showDone(form, btn, 'We could not send this automatically. Copy it below and email it to brad@ezupcranes.com, or call (276) 582-1970.', text); })
          .finally(function () { btn.disabled = false; });
      } else {
        showDone(form, btn, 'Your request is ready. Copy it and email it to brad@ezupcranes.com, or call (276) 582-1970.', text);
      }
    });
  });

  function showDone(form, btn, message, text) {
    var box = document.createElement('div');
    box.className = 'form-result';
    box.setAttribute('role', 'status');
    var p = document.createElement('p');
    p.textContent = message;
    box.appendChild(p);
    if (text) {
      var pre = document.createElement('pre');
      pre.textContent = text;
      box.appendChild(pre);
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn-ghost';
      copy.textContent = 'Copy request';
      copy.addEventListener('click', function () {
        var done = function () { copy.textContent = 'Copied'; };
        var fallback = function () {
          var r = document.createRange(); r.selectNodeContents(pre);
          var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          copy.textContent = 'Selected. Press Ctrl+C to copy';
        };
        try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
      });
      box.appendChild(copy);
    }
    btn.insertAdjacentElement('beforebegin', box);
    box.scrollIntoView({ block: 'nearest' });
  }
})();
