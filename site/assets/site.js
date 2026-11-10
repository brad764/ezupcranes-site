// EZUP Crane Systems — site behavior
(function () {
  var scriptBase = (document.currentScript && document.currentScript.src) || (location.origin + '/assets/site.js');
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
          lines.push((l ? l.textContent.replace('*', '').trim() : (el.getAttribute('data-label') || el.name)) + ': ' + v);
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


  // Home hero: item balloons on the crane and the numbered list under it highlight each other.
  (function () {
    var keys = document.querySelectorAll('.ga-key li');
    var balloons = document.querySelectorAll('.balloon[data-key]');
    if (!keys.length || !balloons.length) return;
    function set(n, on) {
      balloons.forEach(function (b) { if (b.getAttribute('data-key') === n) b.classList.toggle('is-on', on); });
      keys.forEach(function (k, i) { if (String(i + 1) === n) k.classList.toggle('is-on', on); });
    }
    balloons.forEach(function (b) {
      var n = b.getAttribute('data-key');
      b.addEventListener('mouseenter', function () { set(n, true); });
      b.addEventListener('mouseleave', function () { set(n, false); });
    });
    keys.forEach(function (k, i) {
      var n = String(i + 1);
      k.addEventListener('mouseenter', function () { set(n, true); });
      k.addEventListener('mouseleave', function () { set(n, false); });
    });
  })();

  // Product line-up. On wide screens the list of names works as tabs for one large panel;
  // on narrow screens the panels stay a swipeable row and the list is hidden by the stylesheet.
  (function () {
    var root = document.querySelector('[data-lineup]');
    if (!root || !window.matchMedia) return;
    var list = root.querySelector('.lineup-list');
    var tabs = [].slice.call(root.querySelectorAll('[data-lu]'));
    var panels = [].slice.call(root.querySelectorAll('[data-lu-panel]'));
    var mq = window.matchMedia('(min-width: 960px)');
    var current = 0;

    function select(i, focus) {
      current = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', k === current ? 'true' : 'false');
        t.tabIndex = k === current ? 0 : -1;
      });
      panels.forEach(function (p, k) { p.classList.toggle('is-active', k === current); });
      if (focus) tabs[current].focus();
    }
    function apply() {
      var on = mq.matches;
      root.classList.toggle('is-explorer', on);
      if (on) {
        list.setAttribute('role', 'tablist');
        list.setAttribute('aria-orientation', 'vertical');
        tabs.forEach(function (t, k) { t.setAttribute('role', 'tab'); t.setAttribute('aria-controls', panels[k].id); });
        panels.forEach(function (p, k) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', tabs[k].id); });
        select(current, false);
      } else {
        list.removeAttribute('role');
        list.removeAttribute('aria-orientation');
        tabs.forEach(function (t) { t.removeAttribute('role'); t.removeAttribute('aria-controls'); t.tabIndex = 0; });
        panels.forEach(function (p) { p.removeAttribute('role'); p.removeAttribute('aria-labelledby'); });
      }
    }
    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { select(k, false); });
      t.addEventListener('mouseenter', function () { if (mq.matches) select(k, false); });
      t.addEventListener('focus', function () { if (mq.matches && k !== current) select(k, false); });
      t.addEventListener('keydown', function (e) {
        if (!mq.matches) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(current + 1, true); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(current - 1, true); }
        else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
    apply();
  })();

  // Quote form: arriving from a product ("quote.html?product=jib&item=Jib%20cranes") preselects
  // the product type and records which product the visitor was looking at.
  (function () {
    var sel = document.getElementById('q-product');
    if (!sel || !window.URLSearchParams) return;
    var q = new URLSearchParams(window.location.search);
    var map = { bridge: 'Workstation / bridge crane', monorail: 'Monorail', jib: 'Jib crane', gantry: 'Gantry crane',
                tarping: 'Tarping crane', beam: 'Lifting beam or spreader', hoist: 'Hoist only', upgrade: 'Upgrade or retrofit' };
    var want = map[q.get('product')];
    if (want) {
      [].forEach.call(sel.options, function (o) { if (o.text === want) sel.value = o.value || o.text; });
    }
    function setNum(id, key, lo, hi) {
      var v = parseFloat(q.get(key));
      var el = document.getElementById(id);
      if (el && isFinite(v) && v >= lo && v <= hi) el.value = String(v);
      return isFinite(v) && v >= lo && v <= hi ? v : null;
    }
    setNum('q-span', 'span', 5, 100);
    setNum('q-runway', 'runway', 5, 500);
    var capMap = { '0.5': '1/4 to 1/2 ton', '1': '1/2 to 1 ton', '2': '1 to 2 tons', '3': '2 to 3 tons' };
    var capSel = document.getElementById('q-capacity');
    if (capSel && capMap[q.get('cap')]) capSel.value = capMap[q.get('cap')];
    var under = parseFloat(q.get('under'));
    var notes = document.getElementById('q-notes');
    if (notes && isFinite(under) && under >= 6 && under <= 40 && !notes.value) {
      notes.value = 'Layout from the website: ' + under + ' ft clear under the bridge, free-standing runway.\n';
      var sup = document.getElementById('q-support');
      if (sup) sup.value = 'Free-standing on the floor';
    }
    var item = (q.get('item') || '').slice(0, 80);
    var box = document.getElementById('q-interest-box');
    var input = document.getElementById('q-interest');
    if (item && box && input) {
      input.value = item;
      box.querySelector('strong').textContent = item;
      box.hidden = false;
      box.querySelector('button').addEventListener('click', function () { input.value = ''; box.hidden = true; });
    }
  })();


  // Crane layout tool: sliders drive a 3D model that is fetched only when the section comes near.
  (function () {
    var root = document.querySelector('[data-layout3d]');
    if (!root) return;
    var form = root.querySelector('.l3-controls');
    var host = root.querySelector('.l3-canvas');
    var link = document.getElementById('l3-quote');
    var hint = root.querySelector('.l3-hint');
    var dims = {};
    [].forEach.call(root.querySelectorAll('.l3-dim'), function (d) { dims[d.getAttribute('data-dim')] = d; });
    var api = null;
    function num(n) { return String(n).replace(/\.0$/, ''); }
    function read() {
      var cap = form.querySelector('input[name="l3cap"]:checked');
      return { cap: parseFloat(cap.value), capLabel: cap.getAttribute('data-label'),
               span: parseFloat(form.elements.l3span.value), runway: parseFloat(form.elements.l3runway.value),
               under: parseFloat(form.elements.l3under.value) };
    }
    function sync() {
      var s = read();
      document.getElementById('l3-span-out').textContent = num(s.span) + ' ft';
      document.getElementById('l3-runway-out').textContent = num(s.runway) + ' ft';
      document.getElementById('l3-under-out').textContent = num(s.under) + ' ft';
      document.getElementById('l3-foot').textContent = num(s.span) + ' ft × ' + num(s.runway) + ' ft';
      if (dims.span) dims.span.textContent = num(s.span) + ' ft span';
      if (dims.runway) dims.runway.textContent = num(s.runway) + ' ft runway';
      if (dims.under) dims.under.textContent = num(s.under) + ' ft';
      link.href = 'quote.html?product=bridge&item=' + encodeURIComponent('EZUP crane layout') + '&span=' + s.span +
        '&runway=' + s.runway + '&cap=' + s.cap + '&under=' + s.under;
      if (api) api.update(s);
    }
    function place(p) {
      for (var k in dims) {
        if (!p[k]) continue;
        dims[k].style.left = p[k].x.toFixed(1) + 'px';
        dims[k].style.top = p[k].y.toFixed(1) + 'px';
        dims[k].style.visibility = p[k].on ? 'visible' : 'hidden';
      }
    }
    form.hidden = false;
    form.addEventListener('input', sync);
    sync();
    function start() {
      var load;
      try { load = new Function('u', 'return import(u)'); } catch (e) { return; }
      load(new URL('layout3d.js', scriptBase).href).then(function (m) {
        root.classList.add('is-live');
        api = m.mount(host, { logo: new URL('logo.svg', scriptBase).href, ink: getComputedStyle(root).color, onLabels: place,
                              onInteract: function () { if (hint) hint.style.display = 'none'; } });
        if (!api) { root.classList.remove('is-live'); return; }
        api.resize();
        api.update(read());
      }).catch(function () { root.classList.remove('is-live'); });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '500px' });
      io.observe(root);
    } else { start(); }
  })();

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
