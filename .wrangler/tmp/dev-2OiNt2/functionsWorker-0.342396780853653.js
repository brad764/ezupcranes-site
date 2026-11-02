var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-hwveT0/functionsWorker-0.342396780853653.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var DEFAULT_RULES = {
  quoteValidDays: 15,
  escalationPct: 10,
  targetMargin: 0.27,
  minMargin: 0.2,
  priceMaxAgeDays: 15,
  impact: 0.15,
  deflLimit: 600,
  maxColumnSpacing: 20,
  professionalMaxTons: 1,
  fabHrsPer1000lb: 6,
  fabBaseHrs: 12,
  installBaseHrs: 24,
  installHrsPerFtRunway: 0.6,
  installHrsPerColumnFree: 4,
  installHrsPerHanger: 3
};
var SAMPLE_PRICES = [
  { id: "steel_w", name: "Structural steel, W-shapes", cat: "Steel", cost: 1.1, unit: "lb" },
  { id: "steel_hss", name: "Structural steel, HSS columns", cat: "Steel", cost: 1.25, unit: "lb" },
  { id: "plate", name: "Plate and base plates", cat: "Steel", cost: 1.05, unit: "lb" },
  { id: "paint", name: "Paint and consumables", cat: "Steel", cost: 0.12, unit: "lb steel" },
  { id: "endtruck_m", name: "EZUP end truck pair, motorized", cat: "Components", cost: 4200, unit: "pair" },
  { id: "endtruck_p", name: "EZUP end truck pair, push", cat: "Components", cost: 2300, unit: "pair" },
  { id: "trolley_m", name: "EZUP trolley, motorized", cat: "Components", cost: 2600, unit: "ea" },
  { id: "trolley_p", name: "EZUP trolley, push", cat: "Components", cost: 1200, unit: "ea" },
  { id: "hanger", name: "Runway hanger assembly", cat: "Components", cost: 340, unit: "ea" },
  { id: "panel_vfd", name: "Control panel with VFDs", cat: "Electrical", cost: 3800, unit: "ea" },
  { id: "radio", name: "Radio control, 2 transmitters", cat: "Electrical", cost: 1900, unit: "set" },
  { id: "pendant", name: "Pendant station", cat: "Electrical", cost: 450, unit: "ea" },
  { id: "conductor", name: "Conductor bar, installed length", cat: "Electrical", cost: 28, unit: "ft" },
  { id: "hoist_pro", name: "Demag DC-Pro hoist (avg)", cat: "Hoist", cost: 6500, unit: "ea" },
  { id: "hoist_com", name: "Demag DC-Com hoist (avg)", cat: "Hoist", cost: 3600, unit: "ea" },
  { id: "fab", name: "Fabrication labor", cat: "Labor", cost: 75, unit: "hr" },
  { id: "install", name: "Installation labor", cat: "Labor", cost: 85, unit: "hr" },
  { id: "eng", name: "Engineering and drawings", cat: "Engineering", cost: 1800, unit: "job" },
  { id: "freight", name: "Freight", cat: "Freight", cost: 4.25, unit: "mile" }
];
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
  });
}
__name(json, "json");
__name2(json, "json");
function needKv(env) {
  if (!env.CPQ)
    throw new HttpError(503, "Storage is not connected. Bind a KV namespace named CPQ to this Pages project.");
  return env.CPQ;
}
__name(needKv, "needKv");
__name2(needKv, "needKv");
var HttpError = /* @__PURE__ */ __name(class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}, "HttpError");
__name2(HttpError, "HttpError");
function handle(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError)
        return json({ ok: false, error: e.message }, e.status);
      console.log("cpq error", e && e.stack || e);
      return json({ ok: false, error: "Server error: " + (e && e.message || e) }, 500);
    }
  };
}
__name(handle, "handle");
__name2(handle, "handle");
function todayIso() {
  return (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
__name(todayIso, "todayIso");
__name2(todayIso, "todayIso");
function daysBetween(fromIso, toIso) {
  const a = Date.UTC(...fromIso.split("-").map((n, i) => i === 1 ? n - 1 : +n));
  const b = Date.UTC(...toIso.split("-").map((n, i) => i === 1 ? n - 1 : +n));
  return Math.round((b - a) / 864e5);
}
__name(daysBetween, "daysBetween");
__name2(daysBetween, "daysBetween");
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
__name(addDays, "addDays");
__name2(addDays, "addDays");
async function getSettings(kv) {
  const s = await kv.get("settings", "json");
  if (s)
    return { prices: s.prices || [], rules: { ...DEFAULT_RULES, ...s.rules || {} }, updatedAt: s.updatedAt || null };
  return { prices: SAMPLE_PRICES.map((p) => ({ ...p, verified: null, sample: true })), rules: { ...DEFAULT_RULES }, updatedAt: null };
}
__name(getSettings, "getSettings");
__name2(getSettings, "getSettings");
function priceIsCurrent(p, rules, today = todayIso()) {
  if (!p || !p.verified)
    return false;
  return daysBetween(p.verified, today) <= (p.maxAge ?? rules.priceMaxAgeDays);
}
__name(priceIsCurrent, "priceIsCurrent");
__name2(priceIsCurrent, "priceIsCurrent");
function priceExpiry(p, rules) {
  return p && p.verified ? addDays(p.verified, p.maxAge ?? rules.priceMaxAgeDays) : null;
}
__name(priceExpiry, "priceExpiry");
__name2(priceExpiry, "priceExpiry");
async function nextQuoteNumber(kv) {
  const yy = todayIso().slice(2, 4);
  const key = "counter:" + yy;
  for (let i = 0; i < 5; i++) {
    const n = (Number(await kv.get(key)) || 0) + 1;
    await kv.put(key, String(n));
    const num2 = `Q${yy}-${String(n).padStart(4, "0")}`;
    if (!await kv.get("quote:" + num2))
      return num2;
  }
  throw new HttpError(500, "Could not assign a quote number");
}
__name(nextQuoteNumber, "nextQuoteNumber");
__name2(nextQuoteNumber, "nextQuoteNumber");
function listMeta(q) {
  return {
    number: q.number,
    status: q.status,
    customer: q.customer?.company || q.customer?.name || "",
    contact: q.customer?.name || "",
    sell: q.pricing?.sell || 0,
    date: q.issuedOn || q.createdOn,
    validThrough: q.validThrough || null,
    crmDealId: q.crm?.dealId || null,
    summary: q.summary || ""
  };
}
__name(listMeta, "listMeta");
__name2(listMeta, "listMeta");
async function saveQuote(kv, q) {
  await kv.put("quote:" + q.number, JSON.stringify(q), { metadata: listMeta(q) });
}
__name(saveQuote, "saveQuote");
__name2(saveQuote, "saveQuote");
async function loadQuote(kv, number) {
  if (!/^Q\d{2}-\d{4}(-R\d+)?$/.test(number || ""))
    throw new HttpError(400, "Bad quote number");
  const q = await kv.get("quote:" + number, "json");
  if (!q)
    throw new HttpError(404, "Quote not found");
  return q;
}
__name(loadQuote, "loadQuote");
__name2(loadQuote, "loadQuote");
function validateForIssue(q, settings) {
  const { prices, rules } = settings;
  const problems = [];
  const today = todayIso();
  const byId = Object.fromEntries(prices.map((p) => [p.id, p]));
  const ids = [...new Set((q.bom || []).map((l) => l.id).filter(Boolean))];
  const stale = ids.filter((id) => !priceIsCurrent(byId[id], rules, today)).map((id) => byId[id]?.name || id);
  if (stale.length)
    problems.push("Costs out of date or never verified: " + stale.join("; "));
  const cost = Number(q.pricing?.cost) || 0;
  const sell = Number(q.pricing?.sell) || 0;
  if (cost <= 0 || sell <= 0)
    problems.push("Quote has no cost or price");
  else if ((sell - cost) / sell < rules.minMargin - 1e-6)
    problems.push(`Margin is below the ${Math.round(rules.minMargin * 100)}% minimum`);
  if (!q.customer?.name && !q.customer?.company)
    problems.push("Customer name or company is required");
  let valid = addDays(today, rules.quoteValidDays);
  for (const id of ids) {
    const exp = priceExpiry(byId[id], rules);
    if (exp && exp >= today && exp < valid)
      valid = exp;
  }
  return { problems, validThrough: valid };
}
__name(validateForIssue, "validateForIssue");
__name2(validateForIssue, "validateForIssue");
function crmClient(env) {
  if (!env.ONEPAGE_USER_ID || !env.ONEPAGE_API_KEY)
    throw new HttpError(503, "OnePageCRM keys are not set");
  const auth = "Basic " + btoa(`${env.ONEPAGE_USER_ID}:${env.ONEPAGE_API_KEY}`);
  return async (method, path, data) => {
    const res = await fetch("https://app.onepagecrm.com/api/v3" + path, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : void 0
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.status && out.status !== 0) {
      throw new HttpError(502, `OnePageCRM ${method} ${path.split("?")[0]} ${res.status}: ${JSON.stringify(out.errors || out.message || out).slice(0, 300)}`);
    }
    return out.data || {};
  };
}
__name(crmClient, "crmClient");
__name2(crmClient, "crmClient");
var STAGE_SEND_PROPOSAL = 60;
var onRequestPost = handle(async ({ env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  if (q.status === "draft")
    throw new HttpError(409, "Issue the quote before sending it to OnePageCRM.");
  const call = crmClient(env);
  const c = q.customer || {};
  let contactId = c.contactId || q.crm?.contactId || null;
  if (!contactId && c.email) {
    const found = await call("GET", `/contacts.json?email=${encodeURIComponent(c.email)}&per_page=1`);
    const first = (found.contacts || [])[0];
    if (first)
      contactId = (first.contact || first).id;
  }
  if (!contactId) {
    const parts = (c.name || "").split(/\s+/).filter(Boolean);
    const contact = {
      first_name: parts.length > 1 ? parts[0] : "",
      last_name: parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || c.company || "Unknown",
      company_name: c.company || void 0,
      emails: c.email ? [{ type: "work", value: c.email }] : void 0,
      phones: c.phone ? [{ type: "work", value: c.phone }] : void 0,
      tags: ["EZUP"]
    };
    const created = await call("POST", "/contacts.json", contact);
    contactId = (created.contact || created).id;
  }
  if (!contactId)
    throw new HttpError(502, "OnePageCRM returned no contact");
  const name = `EZUP ${q.number}${q.project ? " " + q.project : ""}`.slice(0, 60);
  const text = [
    q.summary,
    `Valid through ${q.validThrough}. Material escalation clause at ${q.terms?.escalationPct ?? 10}%.`,
    "",
    ...(q.scope || []).map((s) => "- " + s)
  ].join("\n").slice(0, 2e3);
  const deal = {
    contact_id: contactId,
    name,
    text,
    status: "pending",
    stage: STAGE_SEND_PROPOSAL,
    amount: q.pricing.sell,
    cost: Math.round(q.pricing.cost),
    expected_close_date: q.validThrough
  };
  let dealId = q.crm?.dealId || null;
  if (dealId && q.crm?.syncedNumber === q.number) {
    throw new HttpError(409, "This quote is already in OnePageCRM.");
  } else if (dealId) {
    const { contact_id, ...update } = deal;
    await call("PUT", `/deals/${dealId}.json`, update);
  } else {
    const created = await call("POST", "/deals.json", deal);
    dealId = (created.deal || created).id;
  }
  await call("POST", "/notes.json", { contact_id: contactId, text: `Quote ${q.number} sent: $${q.pricing.sell.toLocaleString("en-US")}. ${q.summary || ""}`.slice(0, 2e3) });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = {
    ...q,
    crm: { contactId, dealId, sentAt: now, syncedNumber: q.number },
    customer: { ...c, contactId },
    history: [...q.history || [], { at: now, by: data.user, event: "Sent to OnePageCRM" }]
  };
  await saveQuote(kv, next);
  return json({ ok: true, quote: next });
});
var str = /* @__PURE__ */ __name2((v, n = 200) => String(v ?? "").trim().slice(0, n), "str");
var num = /* @__PURE__ */ __name2((v) => Number.isFinite(Number(v)) ? Number(v) : 0, "num");
function cleanQuoteBody(b) {
  const c = b.customer || {};
  const bom = Array.isArray(b.bom) ? b.bom.slice(0, 200).map((l) => ({
    id: str(l.id, 40),
    label: str(l.label, 160),
    cat: str(l.cat, 30),
    qty: num(l.qty),
    unit: str(l.unit, 20),
    cost: num(l.cost),
    ext: num(l.ext)
  })) : [];
  const cost = bom.reduce((s, l) => s + l.qty * l.cost, 0);
  const sell = num(b.pricing?.sell);
  if (bom.length && Math.abs(cost - num(b.pricing?.cost)) > 1)
    throw new HttpError(400, "Cost total does not match the line items");
  return {
    customer: {
      name: str(c.name, 100),
      company: str(c.company, 100),
      email: str(c.email, 120),
      phone: str(c.phone, 40),
      site: str(c.site, 200),
      contactId: str(c.contactId, 40) || void 0
    },
    project: str(b.project, 120),
    inputs: typeof b.inputs === "object" && b.inputs ? b.inputs : {},
    summary: str(b.summary, 200),
    rec: Array.isArray(b.rec) ? b.rec.slice(0, 12).map((r) => [str(r?.[0], 40), str(r?.[1], 120)]) : [],
    scope: Array.isArray(b.scope) ? b.scope.slice(0, 40).map((s) => str(s, 300)) : [],
    bom,
    pricing: { cost: Math.round(cost * 100) / 100, sell: Math.round(sell), margin: sell > 0 ? (sell - cost) / sell : 0 },
    notes: str(b.notes, 2e3),
    internalNotes: str(b.internalNotes, 2e3)
  };
}
__name(cleanQuoteBody, "cleanQuoteBody");
__name2(cleanQuoteBody, "cleanQuoteBody");
var onRequestGet = handle(async ({ env, params }) => {
  return json({ ok: true, quote: await loadQuote(needKv(env), params.id) });
});
var onRequestPut = handle(async ({ request, env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  if (q.status !== "draft")
    throw new HttpError(409, "This quote was issued and is locked. Use Revise to change it.");
  const body = await request.json().catch(() => null);
  if (!body)
    throw new HttpError(400, "Expected a quote");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = { ...q, ...cleanQuoteBody(body), updatedAt: now };
  next.history = [...q.history || [], { at: now, by: data.user, event: "Saved" }].slice(-50);
  await saveQuote(kv, next);
  return json({ ok: true, quote: next });
});
var onRequestPost2 = handle(async ({ request, env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  const { action } = await request.json().catch(() => ({})) || {};
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (action === "issue") {
    if (q.status !== "draft")
      throw new HttpError(409, "Already issued");
    const settings = await getSettings(kv);
    const { problems, validThrough } = validateForIssue(q, settings);
    if (problems.length)
      throw new HttpError(422, problems.join(". "));
    const issued = {
      ...q,
      status: "issued",
      issuedOn: todayIso(),
      validThrough,
      updatedAt: now,
      terms: { validDays: settings.rules.quoteValidDays, escalationPct: settings.rules.escalationPct },
      history: [...q.history || [], { at: now, by: data.user, event: `Issued, valid through ${validThrough}` }]
    };
    await saveQuote(kv, issued);
    return json({ ok: true, quote: issued });
  }
  if (action === "revise") {
    if (q.status === "draft")
      throw new HttpError(409, "Drafts can be edited directly");
    const base = q.number.replace(/-R\d+$/, "");
    let n = 1;
    while (await kv.get(`quote:${base}-R${n}`))
      n++;
    const rev = {
      ...q,
      number: `${base}-R${n}`,
      status: "draft",
      revisionOf: q.number,
      issuedOn: void 0,
      validThrough: void 0,
      terms: void 0,
      crm: q.crm,
      createdOn: todayIso(),
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, by: data.user, event: `Revision of ${q.number}` }]
    };
    await saveQuote(kv, rev);
    await saveQuote(kv, { ...q, status: "superseded", updatedAt: now, history: [...q.history || [], { at: now, by: data.user, event: `Superseded by ${rev.number}` }] });
    return json({ ok: true, quote: rev });
  }
  throw new HttpError(400, "Unknown action");
});
var onRequestGet2 = handle(async ({ env }) => {
  const kv = needKv(env);
  const rows = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "quote:", cursor, limit: 1e3 });
    for (const k of page.keys)
      rows.push(k.metadata || { number: k.name.slice(6) });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  rows.sort((a, b) => String(b.number).localeCompare(String(a.number)));
  return json({ ok: true, quotes: rows });
});
var onRequestPost3 = handle(async ({ request, env, data }) => {
  const kv = needKv(env);
  const body = await request.json().catch(() => null);
  if (!body)
    throw new HttpError(400, "Expected a quote");
  const number = await nextQuoteNumber(kv);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const q = {
    ...cleanQuoteBody(body),
    number,
    status: "draft",
    createdOn: todayIso(),
    createdAt: now,
    updatedAt: now,
    createdBy: data.user,
    history: [{ at: now, by: data.user, event: "Created" }]
  };
  await saveQuote(kv, q);
  return json({ ok: true, quote: q }, 201);
});
var onRequestGet3 = handle(async ({ env, data }) => {
  const s = await getSettings(needKv(env));
  return json({ ok: true, ...s, today: todayIso(), user: data.user });
});
var onRequestPut2 = handle(async ({ request, env }) => {
  const kv = needKv(env);
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.prices))
    throw new HttpError(400, "Expected prices");
  const seen = /* @__PURE__ */ new Set();
  const prices = body.prices.map((p) => {
    const id = String(p.id || "").trim();
    if (!/^[a-z0-9_]{1,40}$/.test(id) || seen.has(id))
      throw new HttpError(400, `Bad or duplicate price id: ${id}`);
    seen.add(id);
    const cost = Number(p.cost);
    if (!Number.isFinite(cost) || cost < 0)
      throw new HttpError(400, `Bad cost for ${id}`);
    const verified = p.verified && /^\d{4}-\d{2}-\d{2}$/.test(p.verified) ? p.verified : null;
    if (verified && verified > todayIso())
      throw new HttpError(400, `Verified date for ${id} is in the future`);
    const out = { id, name: String(p.name || id).slice(0, 80), cat: String(p.cat || "Other").slice(0, 30), cost, unit: String(p.unit || "ea").slice(0, 20), verified };
    if (p.maxAge != null && p.maxAge !== "")
      out.maxAge = Math.max(1, Math.min(365, Math.round(Number(p.maxAge))));
    if (p.sample && !verified)
      out.sample = true;
    return out;
  });
  const rules = { ...DEFAULT_RULES };
  for (const [k, v] of Object.entries(body.rules || {})) {
    if (k in DEFAULT_RULES && Number.isFinite(Number(v)))
      rules[k] = Number(v);
  }
  rules.minMargin = Math.max(0.2, Math.min(rules.minMargin, 0.6));
  rules.targetMargin = Math.max(rules.minMargin, Math.min(rules.targetMargin, 0.6));
  rules.quoteValidDays = Math.max(1, Math.min(60, Math.round(rules.quoteValidDays)));
  rules.priceMaxAgeDays = Math.max(1, Math.min(365, Math.round(rules.priceMaxAgeDays)));
  const settings = { prices, rules, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await kv.put("settings", JSON.stringify(settings));
  return json({ ok: true, ...settings, today: todayIso() });
});
var OPC = "https://app.onepagecrm.com/api/v3";
var MAX_FIELD = 4e3;
var LABELS = {
  type: "I am a",
  product: "Needs",
  capacity: "Capacity",
  operation: "Operation",
  girder: "Girder",
  span: "Bridge span (ft)",
  runway_length: "Runway length (ft)",
  clear_height: "Clear height (ft)",
  support: "Support",
  power: "Power",
  notes: "Details",
  name: "Name",
  company: "Company",
  email: "Email",
  phone: "Phone",
  site_zip: "Site ZIP",
  timing: "Timing",
  territory: "Territory"
};
async function onRequestPost4({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json2({ ok: false, error: "Bad request" }, 400);
  }
  const type = clean(body.type, 120) || "Website request";
  const f = {};
  for (const [k, v] of Object.entries(body.fields || {}))
    f[k] = clean(v, MAX_FIELD);
  if (f.website)
    return json2({ ok: true });
  if (!f.name || !isEmail(f.email))
    return json2({ ok: false, error: "Name and a valid email are required." }, 400);
  const summary = Object.entries(f).filter(([k, v]) => v && k !== "website").map(([k, v]) => `${LABELS[k] || k}: ${v}`).join("\n");
  const crm = await toCrm(env, type, f, summary).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
  const mail = await sendEmail(env, type, f, summary, crm).catch((e) => ({ ok: false, error: String(e && e.message || e) }));
  if (!mail.ok)
    console.log("email failed:", mail.error);
  if (!crm.ok)
    console.log("crm failed:", crm.error);
  if (mail.ok || crm.ok)
    return json2({ ok: true, email: mail.ok, crm: crm.ok });
  return json2({ ok: false, error: "Could not deliver the request." }, 502);
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
function onRequest({ request }) {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204 });
  return json2({ ok: false, error: "Use POST" }, 405);
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
async function sendEmail(env, type, f, summary, crm) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL)
    return { ok: false, error: "email not configured" };
  const who = f.company ? `${f.name}, ${f.company}` : f.name;
  const crmLine = crm && crm.ok ? "Added to OnePageCRM with a note and an ASAP next action." : `NOT added to OnePageCRM. Add this lead by hand. Reason: ${crm && crm.error || "unknown"}`;
  const html = `<h2 style="font-family:Arial,sans-serif">${esc(type)}</h2>
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
${Object.entries(f).filter(([k, v]) => v && k !== "website").map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${esc(LABELS[k] || k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join("\n")}
</table>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Reply to this email to answer ${esc(f.name)} directly.</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:${crm && crm.ok ? "#1E6B3A" : "#B3261E"}">${esc(crmLine)}</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "EZUP Website <onboarding@resend.dev>",
      to: [env.NOTIFY_EMAIL],
      reply_to: f.email,
      subject: `${type}: ${who}`,
      text: `${type}

${summary}

Reply to this email to answer ${f.name} directly.
${crmLine}`,
      html
    })
  });
  if (!res.ok)
    return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}
__name(sendEmail, "sendEmail");
__name2(sendEmail, "sendEmail");
async function toCrm(env, type, f, summary) {
  if (!env.ONEPAGE_USER_ID || !env.ONEPAGE_API_KEY)
    return { ok: false, error: "crm not configured" };
  const auth = "Basic " + btoa(`${env.ONEPAGE_USER_ID}:${env.ONEPAGE_API_KEY}`);
  const call = /* @__PURE__ */ __name2(async (method, path, data) => {
    const res = await fetch(OPC + path, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : void 0
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.status && out.status !== 0)
      throw new Error(`OnePageCRM ${method} ${path} ${res.status}: ${JSON.stringify(out).slice(0, 300)}`);
    return out.data || {};
  }, "call");
  let contactId = null;
  const found = await call("GET", `/contacts.json?email=${encodeURIComponent(f.email)}&per_page=1`);
  const first = (found.contacts || [])[0];
  if (first)
    contactId = (first.contact || first).id;
  if (!contactId) {
    const [firstName, ...rest] = f.name.split(/\s+/);
    const contact = {
      first_name: rest.length ? firstName : "",
      last_name: rest.length ? rest.join(" ") : firstName,
      company_name: f.company || void 0,
      emails: [{ type: "work", value: f.email }],
      phones: f.phone ? [{ type: "work", value: f.phone }] : void 0,
      zip_code: f.site_zip || void 0,
      // status defaults to Lead; the API rejects "lead" as a status_id
      lead_source_id: "email_web",
      tags: ["EZUP"]
    };
    const created = await call("POST", "/contacts.json", contact);
    contactId = (created.contact || created).id;
  }
  if (!contactId)
    throw new Error("OnePageCRM returned no contact id");
  await call("POST", "/notes.json", { contact_id: contactId, text: `${type} (ezupcranes.com)

${summary}` });
  const product = f.product || f.type || "request";
  await call("POST", "/actions.json", {
    contact_id: contactId,
    status: "asap",
    text: `Reply to website ${type.toLowerCase().includes("dealer") ? "dealer inquiry" : "quote request"}: ${product}`.slice(0, 140)
  });
  return { ok: true };
}
__name(toCrm, "toCrm");
__name2(toCrm, "toCrm");
function clean(v, max) {
  return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}
__name(clean, "clean");
__name2(clean, "clean");
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}
__name(isEmail, "isEmail");
__name2(isEmail, "isEmail");
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
__name(esc, "esc");
__name2(esc, "esc");
function json2(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
__name(json2, "json2");
__name2(json2, "json");
var certCache = { at: 0, keys: null, team: null };
async function onRequest2(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  if (env.DEV_AUTH_BYPASS === "1" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    ctx.data.user = "dev@localhost";
    return ctx.next();
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) {
    return json({ ok: false, error: "Login is not configured yet (Cloudflare Access settings missing)." }, 503);
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || cookie(request, "CF_Authorization");
  if (!token)
    return json({ ok: false, error: "Please sign in." }, 401);
  try {
    const claims = await verify(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    const allowed = env.ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const email = String(claims.email || "").toLowerCase();
    if (!allowed.includes(email))
      return json({ ok: false, error: "This account is not allowed." }, 403);
    ctx.data.user = email;
  } catch (e) {
    return json({ ok: false, error: "Sign-in could not be verified. Reload the page to sign in again." }, 401);
  }
  return ctx.next();
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
function cookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
__name(cookie, "cookie");
__name2(cookie, "cookie");
function b64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4)
    s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
__name(b64url, "b64url");
__name2(b64url, "b64url");
async function keys(team) {
  const now = Date.now();
  if (certCache.keys && certCache.team === team && now - certCache.at < 36e5)
    return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok)
    throw new Error("certs " + res.status);
  const { keys: jwks } = await res.json();
  certCache = { at: now, team, keys: jwks };
  return jwks;
}
__name(keys, "keys");
__name2(keys, "keys");
async function verify(token, team, aud) {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig)
    throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
  const jwk = (await keys(team)).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256")
    throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(h + "." + p));
  if (!ok)
    throw new Error("bad signature");
  const now = Math.floor(Date.now() / 1e3);
  if (claims.exp && claims.exp < now)
    throw new Error("expired");
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(aud))
    throw new Error("wrong audience");
  if (claims.iss && claims.iss !== `https://${team}`)
    throw new Error("wrong issuer");
  return claims;
}
__name(verify, "verify");
__name2(verify, "verify");
var routes = [
  {
    routePath: "/api/cpq/quotes/:id/crm",
    mountPath: "/api/cpq/quotes/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/cpq/quotes/:id",
    mountPath: "/api/cpq/quotes",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/cpq/quotes/:id",
    mountPath: "/api/cpq/quotes",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/cpq/quotes/:id",
    mountPath: "/api/cpq/quotes",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/cpq/quotes",
    mountPath: "/api/cpq/quotes",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/cpq/quotes",
    mountPath: "/api/cpq/quotes",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/cpq/settings",
    mountPath: "/api/cpq",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/cpq/settings",
    mountPath: "/api/cpq",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/request",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/cpq",
    mountPath: "/api/cpq",
    method: "",
    middlewares: [onRequest2],
    modules: []
  },
  {
    routePath: "/api/request",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str2, options) {
  var keys2 = [];
  var re = pathToRegexp(str2, keys2, options);
  return regexpToFunction(re, keys2, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys2, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys2[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys2) {
  if (!keys2)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys2.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys2, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys2, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys2, options) {
  return tokensToRegexp(parse(path, options), keys2, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys2, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys2)
          keys2.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys2, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys2);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys2, options);
  return stringToRegexp(path, keys2, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = /* @__PURE__ */ __name(class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
}, "__Facade_ScheduledController__");
__name2(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../tmp/claude-0/-home-claude/f03ab0d6-b411-5196-9f19-67f334d23884/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../tmp/claude-0/-home-claude/f03ab0d6-b411-5196-9f19-67f334d23884/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-gu2pxX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../tmp/claude-0/-home-claude/f03ab0d6-b411-5196-9f19-67f334d23884/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-gu2pxX/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__2, "__Facade_ScheduledController__");
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.342396780853653.js.map
