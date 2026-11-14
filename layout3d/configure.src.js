// EZUP crane configurator (configure.html). Bundled to site/assets/configure.js.
// Design and drawing run in the browser on every keystroke; prices come from /api/estimate so
// costs and margins stay on the server.
import { design, TYPES, CAP_SHORT, DEFAULTS } from "../lib/craneDesign.js";
import { draw } from "../lib/craneDraw.js";
import { DISCLAIMER, TERMS, PRICE_PENDING } from "../lib/quoteText.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => "$" + Math.round(n).toLocaleString("en-US");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const base = new URL(".", document.currentScript ? document.currentScript.src : import.meta.url);

const root = $("[data-configurator]");
const form = $("#cfg-form");
const startedAt = Date.now();
let state = readUrl();
let current = null;
let priceSeq = 0, priceTimer = null, lastPrice = null;
let three = null, threeLoading = null;
let viewMode = "drawing";

const SIZE = {
  span: { industrial: "Bridge span", professional: "Bridge span", jib: "Boom reach", gantry: "Span between legs" },
  length: { industrial: "Runway length", professional: "Runway length", monorail: "Monorail length" },
  height: { industrial: "Height under the bridge", professional: "Height under the bridge", jib: "Height under the boom", gantry: "Height under the beam", monorail: "Height under the beam" }
};
const HINT = {
  span: { industrial: "Centre to centre of the runway beams", professional: "Centre to centre of the runway beams", jib: "Mast centre to the end of the boom", gantry: "Between the A-frame legs" },
  length: { industrial: "Length of travel along the bay", professional: "Length of travel along the bay", monorail: "Straight run" },
  height: { industrial: "Floor to the underside of the bridge", professional: "Floor to the underside of the bridge", jib: "Floor to the underside of the boom", gantry: "Floor to the underside of the beam", monorail: "Floor to the underside of the beam" }
};

function readUrl() {
  const q = new URLSearchParams(location.search);
  const s = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (q.has(k)) s[k] = q.get(k);
  if (!TYPES[s.type]) s.type = DEFAULTS.type;
  return s;
}
function writeUrl(inp) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(inp)) if (v != null && v !== "") q.set(k, v);
  history.replaceState(null, "", "?" + q.toString());
}

// ---------------------------------------------------------------- controls
function setupType() {
  $$('input[name="type"]').forEach(r => { r.checked = r.value === state.type; });
}
function setupCaps(T, cap) {
  const box = $("#cfg-caps");
  box.innerHTML = T.caps.map(c => `<label><input type="radio" name="cap" value="${c}"${c === cap ? " checked" : ""}><span>${CAP_SHORT[c]}</span></label>`).join("");
}
function setupRange(key, range, value, t) {
  const row = $(`[data-size="${key}"]`);
  row.hidden = !range;
  if (!range) return;
  $("label", row).textContent = SIZE[key][t];
  $(".cfg-hint", row).textContent = HINT[key][t];
  const r = $('input[type="range"]', row), n = $('input[type="number"]', row);
  for (const el of [r, n]) { el.min = range[0]; el.max = range[1]; el.value = value; }
  r.setAttribute("aria-label", SIZE[key][t] + ", feet");
}
function show(sel, on) { $$(sel).forEach(el => { el.hidden = !on; }); }

function applyControls(d) {
  const t = d.inputs.type, T = TYPES[t];
  setupCaps(T, d.inputs.cap);
  setupRange("span", T.span, d.inputs.span, t);
  setupRange("length", T.length, d.inputs.length, t);
  setupRange("height", T.height, d.inputs.height, t);
  show("[data-for-support]", t === "industrial" || t === "professional" || t === "monorail");
  show("[data-for-mobility]", t === "gantry");
  show("[data-for-travel]", t !== "industrial");
  show("[data-for-power]", t !== "professional");
  show("[data-for-120v]", t === "professional");
  const setRadio = (name, v) => $$(`input[name="${name}"]`).forEach(r => { r.checked = r.value === String(v); });
  setRadio("support", d.inputs.support);
  setRadio("mobility", d.inputs.mobility || "casters");
  setRadio("travel", d.inputs.travel);
  setRadio("control", d.inputs.control);
  setRadio("install", d.inputs.install);
  const pw = $("#cfg-power"); if (pw && t !== "professional") pw.value = d.inputs.power;
  const z = $("#cfg-zip"); if (z && document.activeElement !== z) z.value = d.inputs.zip || "";
}

function readForm() {
  const fd = new FormData(form);
  const s = {};
  for (const k of ["type", "cap", "support", "mobility", "travel", "control", "install"]) if (fd.get(k) != null) s[k] = fd.get(k);
  for (const k of ["span", "length", "height"]) {
    const row = $(`[data-size="${k}"]`);
    if (row && !row.hidden) s[k] = $('input[type="number"]', row).value;
  }
  s.power = $("#cfg-power").value;
  s.zip = $("#cfg-zip").value;
  return s;
}

// ---------------------------------------------------------------- output
function renderDrawing(d) {
  const { views } = draw(d);
  $("#cfg-drawing").innerHTML = views.map(v => `<figure class="cfg-view">${v.svg}</figure>`).join("");
}

function renderFacts(d) {
  const facts = $("#cfg-facts");
  if (d.status !== "ok") {
    facts.innerHTML = `<p class="cfg-engineer">${esc(d.message)}</p>`;
    return;
  }
  const rows = [
    ["Hook height", `about ${ftIn(d.hookFt)}`],
    ["Hoist", d.hoist.model],
    ...d.members.filter(m => m.lengthFt || /Base/.test(m.role) === false).slice(0, 4).map(m => [m.role, `${m.qty > 1 ? m.qty + " × " : ""}${m.size}`]),
    ["Steel weight", `about ${Math.round(d.steelLb / 10) * 10} lb`]
  ];
  facts.innerHTML = `<dl class="cfg-dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
    (d.warnings.length ? `<ul class="cfg-warn">${d.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : "") +
    (d.inputNotes && d.inputNotes.length ? `<ul class="cfg-warn">${d.inputNotes.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : "");
}
function ftIn(ft) {
  const t = Math.round(ft * 12), f = Math.floor(t / 12), i = t - f * 12;
  return `${f}'-${i}"`;
}

function setPrice(p) {
  const el = $("#cfg-price");
  el.classList.remove("is-busy");
  if (!p) { el.innerHTML = ""; return; }
  if (p.busy) { el.classList.add("is-busy"); return; }
  if (p.error) { el.innerHTML = `<span class="cfg-price-note">${esc(p.error)}</span>`; return; }
  if (p.price) {
    el.innerHTML = `<span class="cfg-price-label">Budget estimate</span><span class="cfg-price-num">${money(p.price.sell)}</span>` +
      `<span class="cfg-price-note">${current.inputs.install === "ezup" ? "Includes installation and " : "Includes "}${p.freight && p.freight.state ? `freight to ${esc(p.freight.state)}.` : "estimated freight. Add your site ZIP code for a closer number."}</span>` +
      (p.price.sample ? `<span class="cfg-sample">Preview: sample costs</span>` : "");
  } else {
    el.innerHTML = `<span class="cfg-price-label">Budget estimate</span><span class="cfg-price-note">${esc(p.note || PRICE_PENDING)}</span>`;
  }
}

function schedulePrice(d) {
  clearTimeout(priceTimer);
  if (d.status !== "ok") { setPrice({ note: d.message }); lastPrice = null; return; }
  setPrice({ busy: true });
  const seq = ++priceSeq;
  priceTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs: d.inputs }) });
      const out = await res.json();
      if (seq !== priceSeq) return;
      if (!out.ok) throw new Error(out.error || "error");
      lastPrice = out;
      setPrice(out);
    } catch (e) {
      if (seq !== priceSeq) return;
      lastPrice = null;
      setPrice({ error: "Pricing is not available right now. You can still request your quote." });
    }
  }, 450);
}

function update(fromForm) {
  const raw = fromForm ? readForm() : state;
  if (fromForm && raw.type !== current?.inputs.type) {
    // switching type: start from that type's typical sizes
    for (const k of ["cap", "span", "length", "height"]) delete raw[k];
  }
  current = design(raw);
  state = { ...current.inputs };
  applyControls(current);
  $("#cfg-title").textContent = current.title;
  $("#cfg-summary").textContent = current.summary;
  renderDrawing(current);
  renderFacts(current);
  schedulePrice(current);
  if (three && viewMode === "3d") three.update(current);
  writeUrl(current.inputs);
  $("#cfg-get").disabled = false;
}

// ---------------------------------------------------------------- 3D
async function load3d() {
  if (three) return three;
  if (!threeLoading) {
    threeLoading = import(new URL("cpq3d.js", base).href).then(m => {
      const api = m.mount($("#cfg-3d"), { logo: new URL("logo.svg", base).href });
      if (!api) throw new Error("no webgl");
      three = api;
      return api;
    });
  }
  return threeLoading;
}
function setView(mode) {
  viewMode = mode;
  $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === mode ? "true" : "false"));
  $("#cfg-drawing").hidden = mode !== "drawing";
  $("#cfg-3d").hidden = mode !== "3d";
  if (mode === "3d") {
    load3d().then(api => { api.resize(); api.update(current); })
      .catch(() => { $("#cfg-3d").innerHTML = `<p class="cfg-price-note" style="padding:24px">The 3D view needs WebGL, which this browser has turned off. The drawing shows the same layout.</p>`; });
  }
}

// ---------------------------------------------------------------- quote
function openContact() {
  const c = $("#cfg-contact");
  c.hidden = false;
  $("#cfg-get").hidden = true;
  $("#q-name").focus();
}

async function submitQuote(e) {
  e.preventDefault();
  const f = e.target;
  const err = $(".form-error", f);
  if (err) err.remove();
  const name = f.elements.name.value.trim(), email = f.elements.email.value.trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const p = document.createElement("p");
    p.className = "form-error"; p.setAttribute("role", "alert");
    p.textContent = "Please enter your name and a valid email address.";
    f.querySelector("button[type=submit]").before(p);
    return;
  }
  const btn = f.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Preparing your quote…";
  const customer = { name, email, company: f.elements.company.value, phone: f.elements.phone.value, notes: f.elements.notes.value };
  let out = null;
  try {
    const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: current.inputs, customer, website: f.elements.website.value, elapsedMs: Date.now() - startedAt }) });
    out = await res.json();
    if (!out.ok) throw new Error(out.error || "error");
  } catch (e2) {
    // Server not reachable: still give the visitor a document, numbered locally, and say so.
    const d = new Date();
    out = { ok: true, offline: true, number: "Draft", date: d.toISOString().slice(0, 10), validThrough: new Date(d.getTime() + 15 * 864e5).toISOString().slice(0, 10),
      price: lastPrice && lastPrice.price, priceNote: PRICE_PENDING, disclaimer: DISCLAIMER, terms: TERMS, emailed: { ezup: false } };
  }
  btn.disabled = false; btn.textContent = "Get my quote";
  let img = null;
  try { const api = await load3d(); api.update(current); img = api.snapshot(1200, 900); if (viewMode !== "3d") $("#cfg-3d").hidden = true; } catch (e3) { img = null; }
  renderQuote(out, customer, img);
}

function renderQuote(q, c, img) {
  const d = current;
  const doc = $("#quote-doc");
  const views = draw(d).views;
  const price = q.price ? `<p class="qd-price"><span>Budget estimate</span><strong>${money(q.price.sell)}</strong></p>` +
      (q.price.sample ? `<p class="cfg-sample">Preview: sample costs, not a real price</p>` : "")
    : `<p class="qd-price"><span>Budget estimate</span><em>${esc(q.priceNote || PRICE_PENDING)}</em></p>`;
  doc.innerHTML = `
<header class="qd-head">
  <img src="${new URL("logo.svg", base).href}" alt="EZUP Crane Systems" width="160" height="53">
  <div class="qd-id"><h2>Budget quotation</h2><dl>
    <dt>Number</dt><dd>${esc(q.number)}</dd><dt>Date</dt><dd>${esc(q.date)}</dd><dt>Valid through</dt><dd>${esc(q.validThrough)}</dd></dl></div>
</header>
<p class="qd-disclaimer"><strong>Estimate only.</strong> ${esc(q.disclaimer || DISCLAIMER)}</p>
<div class="qd-parties">
  <div><h3>Prepared for</h3><p>${esc(c.name)}${c.company ? `<br>${esc(c.company)}` : ""}<br>${esc(c.email)}${c.phone ? `<br>${esc(c.phone)}` : ""}${d.inputs.zip ? `<br>Site ZIP ${esc(d.inputs.zip)}` : ""}</p></div>
  <div><h3>From</h3><p>EZUP Crane Systems<br>627 Claypool Hill Mall Road<br>Cedar Bluff, VA 24609<br>(276) 582-1970 · brad@ezupcranes.com</p></div>
</div>
<section><h3>${esc(d.title)}</h3><p class="qd-sum">${esc(d.summary)}</p>${price}</section>
<section><h3>Scope</h3><ul>${d.scope.map(s => `<li>${esc(s)}</li>`).join("")}
  <li>${d.inputs.install === "ezup" ? "Delivery and installation by EZUP; load test and certificate" : "Delivery to site; installation by others; EZUP load test on request"}</li>
  <li>Engineering and general-arrangement drawings</li></ul></section>
<section class="qd-figs">
  <h3>General arrangement</h3>
  <div class="qd-views">${views.map(v => `<figure>${v.svg}</figure>`).join("")}</div>
  ${img ? `<figure class="qd-3d"><img src="${img}" alt="3D model of the configured crane"><figcaption>3D model of the configured system</figcaption></figure>` : ""}
</section>
<section><h3>Preliminary member sizes</h3>
  <table><thead><tr><th scope="col">Member</th><th scope="col">Size</th><th scope="col">Qty</th><th scope="col">Length</th></tr></thead>
  <tbody>${d.members.map(m => `<tr><td>${esc(m.role)}</td><td>${esc(m.size)}</td><td>${m.qty}</td><td>${m.lengthFt ? ftIn(m.lengthFt) : ""}</td></tr>`).join("")}</tbody></table>
  <p class="qd-small">Approximate hook height ${ftIn(d.hookFt)}. Rated capacity ${esc(CAP_SHORT[d.inputs.cap])}; design load includes 15% impact.</p></section>
<section><h3>Design basis and assumptions</h3><ul class="qd-small">${d.assumptions.concat(d.warnings).map(a => `<li>${esc(a)}</li>`).join("")}</ul></section>
<section><h3>Terms</h3><ul class="qd-small">${(q.terms || TERMS).map(t => `<li>${esc(t)}</li>`).join("")}</ul></section>
<section class="qd-confirm"><p><strong>Confirmed by EZUP sales management</strong> (required before order)</p>
  <div class="qd-sign"><span>Name</span><span>Signature</span><span>Date</span></div></section>
<p class="qd-disclaimer qd-foot">${esc(q.disclaimer || DISCLAIMER)}</p>`;
  const wrap = $("#quote-wrap");
  wrap.hidden = false;
  const st = $("#quote-status");
  st.textContent = q.offline
    ? "We could not reach our server, so this draft was not sent to EZUP. Print it or save it as a PDF and email it to brad@ezupcranes.com, or call (276) 582-1970."
    : `Quote ${q.number} is ready${q.emailed && q.emailed.ezup ? " and has been sent to EZUP sales" : ""}. ${q.emailed && q.emailed.customer ? "A copy is on its way to your email. " : ""}Print it or save it as a PDF.`;
  wrap.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  $("#quote-print").focus({ preventScroll: true });
}

// ---------------------------------------------------------------- wire up
function init() {
  if (!root) return;
  setupType();
  form.addEventListener("input", e => {
    const t = e.target;
    if (t.type === "range") { const n = t.closest("[data-size]").querySelector('input[type="number"]'); n.value = t.value; }
    if (t.type === "number") { const r = t.closest("[data-size]").querySelector('input[type="range"]'); r.value = t.value; }
    if (t.id === "cfg-zip" && t.value.replace(/\D/g, "").length > 0 && t.value.replace(/\D/g, "").length < 5) return;
    update(true);
  });
  form.addEventListener("change", e => { if (e.target.type === "number") update(true); });
  form.addEventListener("submit", e => e.preventDefault());
  $$("[data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#cfg-get").addEventListener("click", openContact);
  $("#cfg-contact").addEventListener("submit", submitQuote);
  $("#quote-print").addEventListener("click", () => window.print());
  $("#quote-edit").addEventListener("click", () => { $("#quote-wrap").hidden = true; root.scrollIntoView(); });
  root.classList.add("is-live");
  update(false);
}
init();
