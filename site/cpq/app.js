// EZUP CPQ — browser app. Talks to /api/cpq/* (protected by Cloudflare Access).
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = n => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const money2 = n => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = n => (Number(n) || 0).toLocaleString("en-US");
  const CORE_IDS = new Set(["steel_w", "steel_hss", "plate", "paint", "endtruck_m", "endtruck_p", "trolley_m", "trolley_p", "hanger", "panel_vfd", "radio", "pendant", "conductor", "hoist_pro", "hoist_com", "fab", "install", "eng", "freight"]);
  const RULE_FIELDS = [
    ["targetMargin", "Default margin (%)", "pct"], ["minMargin", "Minimum margin (%) — never below 20", "pct"],
    ["quoteValidDays", "Quote valid (days)"], ["priceMaxAgeDays", "Cost valid after verifying (days)"],
    ["escalationPct", "Escalation trigger (%)"], ["impact", "Hoist impact allowance (%)", "pct"],
    ["deflLimit", "Deflection limit (span / x)"], ["maxColumnSpacing", "Max column / hanger spacing (ft)"],
    ["professionalMaxTons", "Professional line max (tons)"], ["fabHrsPer1000lb", "Fab hours per 1,000 lb steel"],
    ["fabBaseHrs", "Fab base hours per crane"], ["installBaseHrs", "Install base hours"],
    ["installHrsPerFtRunway", "Install hours per ft of runway"], ["installHrsPerColumnFree", "Install hours per column"],
    ["installHrsPerHanger", "Install hours per hanger"]
  ];

  const state = { settings: null, quotes: [], quote: null, priceDraft: null, dirtyPrices: false, calc: null };

  // ---------- API ----------
  async function api(method, path, body) {
    const res = await fetch("/api/cpq" + path, {
      method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin"
    });
    let out = {};
    try { out = await res.json(); } catch { /* non-JSON, e.g. an Access login page */ }
    if (res.status === 401 || res.status === 403 || (!res.ok && !out.error && res.redirected)) {
      throw new Error(out.error || "Your sign-in expired. Reload the page to sign in again.");
    }
    if (!res.ok || out.ok === false) throw new Error(out.error || `Request failed (${res.status})`);
    return out;
  }
  function banner(msg, kind = "bad") {
    const b = $("banner");
    if (!msg) { b.hidden = true; return; }
    b.className = "notice " + kind; b.textContent = msg; b.hidden = false;
    if (kind === "ok") setTimeout(() => { if (b.textContent === msg) b.hidden = true; }, 4000);
  }
  async function busy(btn, fn) {
    const label = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Working…"; }
    try { return await fn(); }
    catch (e) { banner(e.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }

  // ---------- dates and price status ----------
  const today = () => state.settings?.today || new Date().toISOString().slice(0, 10);
  const dayNum = iso => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const addDays = (iso, n) => new Date((dayNum(iso) + n) * 86400000).toISOString().slice(0, 10);
  const fmtDate = iso => iso ? new Date(dayNum(iso) * 86400000).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }) : "";
  function priceStatus(p) {
    const rules = state.settings.rules;
    if (!p) return { cls: "stale", label: "Missing", left: -1 };
    if (!p.verified) return { cls: "stale", label: p.sample ? "Sample, not verified" : "Not verified", left: -1 };
    const left = (p.maxAge ?? rules.priceMaxAgeDays) - (dayNum(today()) - dayNum(p.verified));
    if (left < 0) return { cls: "stale", label: "Out of date", left };
    if (left <= 3) return { cls: "soon", label: `Due in ${left} d`, left };
    return { cls: "ok", label: `Good ${left} d`, left };
  }

  // ---------- routing ----------
  async function route() {
    banner(null);
    const h = location.hash || "#quotes";
    for (const v of ["quote", "quotes", "prices"]) $("view-" + v).hidden = true;
    document.querySelectorAll(".tabs a").forEach(a => a.removeAttribute("aria-current"));
    if (state.dirtyPrices && h !== "#prices" && !confirmLeave()) { location.hash = "#prices"; return; }
    if (h === "#new") { tab("new"); openQuote(null); }
    else if (h.startsWith("#q/")) { tab("quotes"); await loadQuote(decodeURIComponent(h.slice(3))); }
    else if (h === "#prices") { tab("prices"); showPrices(); }
    else { tab("quotes"); await showQuotes(); }
  }
  function tab(name) { const a = document.querySelector(`.tabs a[data-tab="${name}"]`); if (a) a.setAttribute("aria-current", "page"); }
  function confirmLeave() { banner("You have unsaved price changes. Save them or reload the page to discard."); return false; }

  // ---------- quote list ----------
  async function showQuotes() {
    $("view-quotes").hidden = false;
    try { state.quotes = (await api("GET", "/quotes")).quotes; } catch (e) { banner(e.message); state.quotes = []; }
    renderList();
  }
  function renderList() {
    const term = $("q-search").value.trim().toLowerCase();
    const rows = state.quotes.filter(q => !term || [q.number, q.customer, q.contact, q.summary].join(" ").toLowerCase().includes(term));
    $("q-list").innerHTML = rows.length ? rows.map(q => `<tr data-n="${esc(q.number)}" tabindex="0">
      <td><strong>${esc(q.number)}</strong></td><td><span class="pill ${esc(q.status)}">${esc(q.status)}</span></td>
      <td>${esc(q.customer)}${q.contact && q.contact !== q.customer ? `<br><span class="hint">${esc(q.contact)}</span>` : ""}</td>
      <td class="wrapcell">${esc(q.summary)}</td><td class="n">${money(q.sell)}</td><td>${esc(q.date || "")}</td>
      <td>${esc(q.validThrough || "")}</td><td>${q.crmDealId ? "Sent" : ""}</td></tr>`).join("")
      : `<tr><td colspan="8" class="hint">${state.quotes.length ? "No quotes match." : "No quotes yet. Start one with New quote."}</td></tr>`;
  }
  $("q-search").addEventListener("input", renderList);
  $("q-list").addEventListener("click", e => { const tr = e.target.closest("tr[data-n]"); if (tr) location.hash = "#q/" + encodeURIComponent(tr.dataset.n); });
  $("q-list").addEventListener("keydown", e => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-n]"); if (tr) location.hash = "#q/" + encodeURIComponent(tr.dataset.n); } });

  // ---------- quote editor ----------
  const INPUT_IDS = { cap: "i-cap", power: "i-power", op: "i-op", span: "i-span", runway: "i-runway", height: "i-height", support: "i-support", install: "i-install", miles: "i-miles", margin: "i-margin" };
  const CUSTOMER_IDS = { name: "c-name", company: "c-company", email: "c-email", phone: "c-phone", site: "c-site" };

  async function loadQuote(number) {
    try { const { quote } = await api("GET", "/quotes/" + encodeURIComponent(number)); openQuote(quote); }
    catch (e) { banner(e.message); location.hash = "#quotes"; }
  }

  function openQuote(q) {
    state.quote = q;
    $("view-quote").hidden = false;
    const inp = q?.inputs || {};
    const defaults = { cap: "3", power: "480", op: "radio", span: 30, runway: 60, height: 16, support: "free", install: "ezup", miles: 150, margin: Math.round(state.settings.rules.targetMargin * 100) };
    for (const [k, id] of Object.entries(INPUT_IDS)) $(id).value = inp[k] ?? defaults[k];
    for (const [k, id] of Object.entries(CUSTOMER_IDS)) $(id).value = q?.customer?.[k] || "";
    $("c-project").value = q?.project || "";
    $("q-notes").value = q?.notes || "";
    $("q-internal").value = q?.internalNotes || "";
    $("extras").innerHTML = "";
    for (const x of inp.extras || []) addExtra(x);
    const locked = q && q.status !== "draft";
    for (const fs of ["fs-customer", "fs-system", "fs-extras", "fs-notes"]) $(fs).disabled = !!locked;
    $("btn-save").hidden = !!locked; $("btn-issue").hidden = !!locked;
    $("btn-revise").hidden = !(q && q.status === "issued");
    $("btn-crm").hidden = !(q && q.status === "issued");
    const synced = q?.crm?.syncedNumber === q?.number;
    $("btn-crm").textContent = synced ? "In OnePageCRM" : q?.crm?.dealId ? "Update OnePageCRM deal" : "Send to OnePageCRM";
    $("btn-crm").disabled = !!synced;
    $("btn-print").hidden = !q;
    $("q-state").textContent = q ? `${q.status}${q.revisionOf ? " · revision of " + q.revisionOf : ""}` : "New quote";
    $("q-title").textContent = q ? q.number : "New quote";
    const hist = q?.history || [];
    $("q-history-wrap").hidden = !hist.length;
    $("q-history").innerHTML = hist.map(h => `<li>${esc(new Date(h.at).toLocaleString())} — ${esc(h.event)}</li>`).join("");
    recalc();
  }

  function addExtra(x = {}) {
    const row = document.createElement("div");
    row.className = "extra-row";
    row.innerHTML = `<input class="cell-input" aria-label="Item description" placeholder="Description" value="${esc(x.label || "")}">
      <input class="cell-input" aria-label="Quantity" type="number" min="0" step="any" placeholder="Qty" value="${esc(x.qty ?? 1)}">
      <input class="cell-input" aria-label="Unit" placeholder="Unit" value="${esc(x.unit || "ea")}">
      <input class="cell-input num" aria-label="Unit cost" type="number" min="0" step="0.01" placeholder="Cost" value="${esc(x.cost ?? "")}">
      <button type="button" class="btn link" aria-label="Remove item">Remove</button>`;
    row.querySelector("button").addEventListener("click", () => { row.remove(); recalc(); });
    row.querySelectorAll("input").forEach(i => i.addEventListener("input", recalc));
    $("extras").appendChild(row);
  }
  $("btn-add-extra").addEventListener("click", () => { addExtra(); });

  function readForm() {
    const inputs = {};
    for (const [k, id] of Object.entries(INPUT_IDS)) inputs[k] = $(id).value;
    inputs.extras = [...$("extras").children].map(r => { const [l, q, u, c] = r.querySelectorAll("input"); return { label: l.value.trim(), qty: Number(q.value) || 0, unit: u.value.trim() || "ea", cost: Number(c.value) || 0 }; }).filter(x => x.label);
    const customer = {};
    for (const [k, id] of Object.entries(CUSTOMER_IDS)) customer[k] = $(id).value.trim();
    if (state.quote?.customer?.contactId) customer.contactId = state.quote.customer.contactId;
    return { inputs, customer, project: $("c-project").value.trim(), notes: $("q-notes").value.trim(), internalNotes: $("q-internal").value.trim() };
  }

  function recalc() {
    const q = state.quote;
    const locked = q && q.status !== "draft";
    const s = state.settings;
    let view;
    if (locked) {
      // Issued quotes show their saved snapshot, not today's prices.
      view = { snapshot: true, bom: q.bom, cost: q.pricing.cost, sell: q.pricing.sell, margin: q.pricing.margin, scope: q.scope, summary: q.summary, notes: [], rec: q.rec || null, check: null };
    } else {
      const f = readForm();
      const r = EZUPEngine.configure(f.inputs, s.prices, s.rules, Number(f.inputs.margin));
      view = { ...r, snapshot: false, rec: recRows(r) };
    }
    state.calc = view;
    $("o-price").textContent = money(view.sell);
    $("o-price-sub").textContent = `Cost ${money(view.cost)} · ${Math.round(view.margin * 100)}% margin (minimum ${Math.round(s.rules.minMargin * 100)}%) · rounded to $50`;

    const ids = [...new Set(view.bom.map(b => b.id).filter(Boolean))];
    const byId = Object.fromEntries(s.prices.map(p => [p.id, p]));
    const stale = locked ? [] : ids.filter(id => priceStatus(byId[id]).cls === "stale");
    let validThrough = addDays(today(), s.rules.quoteValidDays);
    for (const id of ids) { const p = byId[id]; if (p?.verified) { const exp = addDays(p.verified, p.maxAge ?? s.rules.priceMaxAgeDays); if (exp >= today() && exp < validThrough) validThrough = exp; } }
    const st = $("o-status");
    if (locked) {
      st.className = "notice " + (q.status === "issued" ? "ok" : "warn");
      st.innerHTML = q.status === "issued" ? `<strong>Issued ${esc(fmtDate(q.issuedOn))}.</strong><span>Valid through ${esc(fmtDate(q.validThrough))}.${q.crm?.dealId ? " In OnePageCRM." : ""}</span>` : `<strong>Superseded.</strong><span>A newer revision replaced this quote.</span>`;
    } else if (stale.length) {
      st.className = "notice bad";
      st.innerHTML = `<strong>Can't issue yet.</strong><span>${stale.length} cost${stale.length > 1 ? "s need" : " needs"} verifying: ${stale.map(id => esc(byId[id]?.name || id)).join("; ")}. Update them under Prices &amp; rules.</span>`;
    } else {
      const days = dayNum(validThrough) - dayNum(today());
      st.className = "notice " + (days < 10 ? "warn" : "ok");
      st.innerHTML = `<strong>Ready to issue.</strong><span>Would be valid through ${esc(fmtDate(validThrough))} (${days} days).${days < 10 ? " Re-verify older costs to give the full " + s.rules.quoteValidDays + " days." : ""}</span>`;
    }
    $("btn-issue").disabled = !!stale.length;
    $("o-notes").hidden = !view.notes.length;
    $("o-notes").innerHTML = view.notes.map(n => `<span>${esc(n)}</span>`).join("");

    $("o-rec").innerHTML = (view.rec || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("") || `<dt>System</dt><dd>${esc(view.summary)}</dd>`;
    const c = view.check;
    $("o-check").innerHTML = c ? `<span>Wheel load per girder: <strong>${num(Math.round(c.Pg))} lb</strong></span>
      <span>Bending stress at midspan: <strong>${num(Math.round(c.fb))} psi</strong></span>
      <span>Live load deflection: <strong>${c.defl.toFixed(2)} in, L/${Math.round(c.ratio)}</strong> <span class="pill ${c.deflOk ? "ok" : "stale"}">${c.deflOk ? "within" : "exceeds"} L/${s.rules.deflLimit}</span></span>
      <span class="hint">Lateral-torsional buckling, local, fatigue and end-truck checks are not run here. Sizing tables are preliminary until tied to the Girder Designer. Final design by PE.</span>` : `<span class="hint">Saved with the issued quote.</span>`;

    $("o-bom").innerHTML = view.bom.map(b => {
      const pst = b.id ? (locked ? null : priceStatus(byId[b.id])) : null;
      return `<tr><td class="wrapcell">${esc(b.label)}</td><td>${esc(b.cat)}</td><td class="n">${num(b.qty)}</td><td>${esc(b.unit)}</td>
        <td class="n">${b.cost < 10 ? money2(b.cost) : money(b.cost)}</td><td class="n">${money(b.qty * b.cost)}</td>
        <td>${pst ? `<span class="pill ${pst.cls}">${esc(pst.label)}</span>` : (b.id ? "Saved" : "Added item")}</td></tr>`;
    }).join("");
    $("o-bom-foot").innerHTML = `<tr><td colspan="5">Total cost</td><td class="n">${money(view.cost)}</td><td></td></tr><tr><td colspan="5">Selling price at ${Math.round(view.margin * 100)}% margin</td><td class="n">${money(view.sell)}</td><td></td></tr>`;
    renderSheet(view, locked ? q.validThrough : validThrough);
  }

  function recRows(r) {
    return [
      ["System", `${r.lineName}, double girder, top running`], ["Capacity", r.capLabel],
      ["Bridge", `2 x ${r.girder} x ${r.span} ft`], ["Runway", `2 x ${r.runwayBeam} x ${r.runway} ft`],
      ["Support", r.free ? `${2 * r.colsPerSide} free-standing columns` : `${2 * r.colsPerSide} hangers to building steel`],
      ["Hoist", `Demag ${r.hoistModel}`], ["Steel", `${num(Math.round(r.steelTotal))} lb`]
    ];
  }

  function renderSheet(view, validThrough) {
    const q = state.quote;
    const f = q && q.status !== "draft" ? { customer: q.customer, project: q.project, notes: q.notes } : readForm();
    const c = f.customer || {};
    const rules = state.settings.rules;
    const terms = q?.terms || { validDays: rules.quoteValidDays, escalationPct: rules.escalationPct };
    const issued = q && q.status !== "draft";
    const custLines = [c.name, c.company, c.site, c.email, c.phone].filter(Boolean).map(esc).join("<br>");
    $("sheet").innerHTML = `
      <div class="sheet-head">
        <div><img src="/assets/logo.svg" alt="EZUP Crane Systems" width="170" height="56">
          <div class="muted small">627 Claypool Hill Mall Road, Cedar Bluff, VA 24609<br>(276) 582-1970 · brad@ezupcranes.com · ezupcranes.com</div></div>
        <div style="text-align:right"><div><strong>Quotation ${esc(q?.number || "(not saved)")}</strong></div>
          <div class="muted">Date: ${esc(fmtDate(issued ? q.issuedOn : today()))}</div>
          <div class="muted">Valid through: ${esc(fmtDate(validThrough))}</div></div>
      </div>
      ${issued ? "" : `<span class="draft-mark">Draft · not an offer until issued</span>`}
      <div class="row between" style="align-items:flex-start">
        <div><h3>Prepared for</h3><div>${custLines || '<span class="muted">Customer details</span>'}</div></div>
        ${f.project ? `<div><h3>Project</h3><div>${esc(f.project)}</div></div>` : ""}
      </div>
      <div><h3>Scope of supply</h3><ul>${(view.scope || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
      <div class="table-box"><table>
        <tbody><tr><td>${esc(view.summary || "Crane system as described")}</td><td class="n">${money(view.sell)}</td></tr></tbody>
        <tfoot><tr><td>Total, excluding taxes</td><td class="n">${money(view.sell)}</td></tr></tfoot>
      </table></div>
      ${f.notes ? `<div><h3>Notes</h3><p style="white-space:pre-wrap">${esc(f.notes)}</p></div>` : ""}
      <div><h3>Terms</h3>
        <p class="muted small">Price valid through ${esc(fmtDate(validThrough))}. Excludes foundations, building modifications and electrical service to the crane disconnect unless stated. Lead time confirmed at order.</p></div>
      <div class="clause">
        <p><strong>Material cost escalation.</strong> This price is based on EZUP's costs for structural steel, purchased crane components, hoists and electrical equipment on the quotation date. If, before those materials are purchased for this order, EZUP's cost for any one of those categories rises by more than ${esc(terms.escalationPct)}% over the cost used in this quotation, EZUP may adjust the price for that category by the amount of the increase, supported by supplier documentation. EZUP will notify the buyer in writing before proceeding. The buyer may accept the adjusted price or cancel the order and receive a refund of any deposit, less costs already incurred.</p>
      </div>
      <div class="row between small muted" style="border-top:1px solid #DDDBD4;padding-top:12px">
        <span>Accepted by: ______________________________ Date: ____________</span>
        <span>EZUP Crane Systems</span>
      </div>`;
  }

  document.querySelectorAll("#fs-customer input, #fs-system input, #fs-system select, #fs-notes textarea, #c-project").forEach(el => el.addEventListener("input", recalc));

  function quoteBody() {
    const f = readForm();
    const v = state.calc;
    return { ...f, summary: v.summary, rec: v.rec, scope: v.scope, bom: v.bom.map(b => ({ ...b, ext: b.qty * b.cost })), pricing: { cost: v.bom.reduce((s, b) => s + b.qty * b.cost, 0), sell: v.sell } };
  }
  async function saveDraft() {
    const body = quoteBody();
    if (!body.customer.name && !body.customer.company) throw new Error("Enter a customer name or company first.");
    const out = state.quote ? await api("PUT", "/quotes/" + encodeURIComponent(state.quote.number), body) : await api("POST", "/quotes", body);
    state.quote = out.quote;
    if (location.hash !== "#q/" + out.quote.number) history.replaceState(null, "", "#q/" + out.quote.number);
    return out.quote;
  }
  $("btn-save").addEventListener("click", e => busy(e.target, async () => { await saveDraft(); openQuote(state.quote); banner(`Saved ${state.quote.number}.`, "ok"); }));
  $("btn-issue").addEventListener("click", e => busy(e.target, async () => {
    const q = await saveDraft();
    const { quote } = await api("POST", "/quotes/" + encodeURIComponent(q.number), { action: "issue" });
    openQuote(quote); banner(`Issued ${quote.number}, valid through ${fmtDate(quote.validThrough)}.`, "ok");
  }));
  $("btn-revise").addEventListener("click", e => busy(e.target, async () => {
    const { quote } = await api("POST", "/quotes/" + encodeURIComponent(state.quote.number), { action: "revise" });
    history.replaceState(null, "", "#q/" + quote.number); openQuote(quote);
    banner(`Created ${quote.number} as an editable copy. ${state.quote.revisionOf} is marked superseded.`, "ok");
  }));
  $("btn-crm").addEventListener("click", e => busy(e.target, async () => {
    const { quote } = await api("POST", "/quotes/" + encodeURIComponent(state.quote.number) + "/crm");
    openQuote(quote); banner(`${quote.number} is in OnePageCRM as a deal at Send Proposal.`, "ok");
  }));
  $("btn-print").addEventListener("click", () => window.print());

  // ---------- prices & rules ----------
  function showPrices() {
    $("view-prices").hidden = false;
    if (!state.priceDraft) state.priceDraft = JSON.parse(JSON.stringify({ prices: state.settings.prices, rules: state.settings.rules }));
    renderPrices();
  }
  function renderPrices() {
    const d = state.priceDraft;
    const saved = state.settings;
    $("p-list").innerHTML = d.prices.map((p, i) => {
      const st = priceStatusFor(p, d.rules);
      return `<tr data-i="${i}">
        <td>${CORE_IDS.has(p.id) ? esc(p.name) : `<input class="cell-input" data-k="name" aria-label="Item name" value="${esc(p.name)}">`}</td>
        <td>${CORE_IDS.has(p.id) ? esc(p.cat) : `<input class="cell-input short" data-k="cat" aria-label="Category" value="${esc(p.cat)}">`}</td>
        <td class="n"><input class="cell-input num" data-k="cost" type="number" min="0" step="0.01" aria-label="Cost for ${esc(p.name)}" value="${esc(p.cost)}"></td>
        <td>${CORE_IDS.has(p.id) ? esc(p.unit) : `<input class="cell-input short" data-k="unit" aria-label="Unit" value="${esc(p.unit)}">`}</td>
        <td>${p.verified ? esc(p.verified) : '<span class="hint">never</span>'}</td>
        <td class="n"><input class="cell-input short" data-k="maxAge" type="number" min="1" max="365" placeholder="${esc(d.rules.priceMaxAgeDays)}" aria-label="Max age in days" value="${esc(p.maxAge ?? "")}"></td>
        <td><span class="pill ${st.cls}">${esc(st.label)}</span></td>
        <td class="row" style="flex-wrap:nowrap"><button type="button" class="btn small" data-act="verify">Verified today</button>${CORE_IDS.has(p.id) ? "" : '<button type="button" class="btn link" data-act="del">Delete</button>'}</td></tr>`;
    }).join("");
    $("r-fields").innerHTML = RULE_FIELDS.map(([k, label, kind]) => `<div class="field"><label for="r-${k}">${esc(label)}</label>
      <input id="r-${k}" data-rule="${k}" data-kind="${kind || ""}" type="number" step="any" value="${kind === "pct" ? Math.round(d.rules[k] * 1000) / 10 : d.rules[k]}"></div>`).join("");
    $("btn-save-prices").disabled = !state.dirtyPrices;
    $("btn-save-prices").textContent = state.dirtyPrices ? "Save changes" : "Saved";
    if (!saved.updatedAt) banner("These are sample costs. Enter your real costs and press Verified today on each one before issuing quotes.", "warn");
  }
  function priceStatusFor(p, rules) {
    const keep = state.settings.rules; state.settings.rules = rules;
    try { return priceStatus(p); } finally { state.settings.rules = keep; }
  }
  function markDirty() { state.dirtyPrices = true; $("btn-save-prices").disabled = false; $("btn-save-prices").textContent = "Save changes"; }
  $("p-list").addEventListener("change", e => {
    const tr = e.target.closest("tr[data-i]"); const k = e.target.dataset.k; if (!tr || !k) return;
    const p = state.priceDraft.prices[tr.dataset.i];
    if (k === "cost") { const v = Number(e.target.value); if (!(v >= 0)) return banner("Cost must be a number of 0 or more."); if (v !== p.cost) { p.cost = v; p.verified = today(); delete p.sample; } }
    else if (k === "maxAge") { p.maxAge = e.target.value === "" ? undefined : Math.max(1, Math.round(Number(e.target.value))); }
    else p[k] = e.target.value.trim();
    markDirty(); renderPrices();
  });
  $("p-list").addEventListener("click", e => {
    const act = e.target.dataset.act; if (!act) return;
    const i = Number(e.target.closest("tr").dataset.i);
    if (act === "verify") { state.priceDraft.prices[i].verified = today(); delete state.priceDraft.prices[i].sample; }
    if (act === "del") state.priceDraft.prices.splice(i, 1);
    markDirty(); renderPrices();
  });
  $("r-fields").addEventListener("change", e => {
    const k = e.target.dataset.rule; if (!k) return;
    let v = Number(e.target.value); if (!Number.isFinite(v)) return;
    if (e.target.dataset.kind === "pct") v = v / 100;
    state.priceDraft.rules[k] = v; markDirty(); renderPrices();
  });
  $("btn-add-price").addEventListener("click", () => {
    const name = "New cost item";
    let id = "item_" + Date.now().toString(36);
    state.priceDraft.prices.push({ id, name, cat: "Other", cost: 0, unit: "ea", verified: null });
    markDirty(); renderPrices();
  });
  $("btn-save-prices").addEventListener("click", e => busy(e.target, async () => {
    const out = await api("PUT", "/settings", state.priceDraft);
    state.settings = { ...state.settings, prices: out.prices, rules: out.rules, updatedAt: out.updatedAt, today: out.today };
    state.priceDraft = JSON.parse(JSON.stringify({ prices: out.prices, rules: out.rules }));
    state.dirtyPrices = false; banner(null); renderPrices(); banner("Prices and rules saved.", "ok");
  }));
  window.addEventListener("beforeunload", e => { if (state.dirtyPrices) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- start ----------
  async function start() {
    try {
      state.settings = await api("GET", "/settings");
      $("who").textContent = state.settings.user || "";
    } catch (e) {
      banner(e.message + " If this is a new setup, see the CPQ setup steps.");
      return;
    }
    window.addEventListener("hashchange", route);
    route();
  }
  start();
})();
