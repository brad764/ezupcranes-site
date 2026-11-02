// Shared helpers for the EZUP CPQ API (functions/api/cpq/*).
// Storage is a Cloudflare KV namespace bound as CPQ:
//   settings          -> { prices: [...], rules: {...}, updatedAt }
//   counter:<yy>      -> last quote number used that year
//   quote:<number>    -> full quote record (metadata holds list columns)

export const DEFAULT_RULES = {
  quoteValidDays: 15,
  escalationPct: 10,
  targetMargin: 0.27,
  minMargin: 0.20,
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

// SAMPLE prices only. Every one must be replaced with a verified cost.
export const SAMPLE_PRICES = [
  { id: "steel_w", name: "Structural steel, W-shapes", cat: "Steel", cost: 1.10, unit: "lb" },
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

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
  });
}

export function needKv(env) {
  if (!env.CPQ) throw new HttpError(503, "Storage is not connected. Bind a KV namespace named CPQ to this Pages project.");
  return env.CPQ;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function handle(fn) {
  return async (ctx) => {
    try { return await fn(ctx); }
    catch (e) {
      if (e instanceof HttpError) return json({ ok: false, error: e.message }, e.status);
      console.log("cpq error", e && e.stack || e);
      return json({ ok: false, error: "Server error: " + (e && e.message || e) }, 500);
    }
  };
}

export function todayIso() {
  // Business dates follow Eastern time.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function daysBetween(fromIso, toIso) {
  const a = Date.UTC(...fromIso.split("-").map((n, i) => (i === 1 ? n - 1 : +n)));
  const b = Date.UTC(...toIso.split("-").map((n, i) => (i === 1 ? n - 1 : +n)));
  return Math.round((b - a) / 86400000);
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export async function getSettings(kv) {
  const s = await kv.get("settings", "json");
  if (s) return { prices: s.prices || [], rules: { ...DEFAULT_RULES, ...(s.rules || {}) }, updatedAt: s.updatedAt || null };
  // First run: sample prices, all marked as never verified so nothing can be issued until checked.
  return { prices: SAMPLE_PRICES.map(p => ({ ...p, verified: null, sample: true })), rules: { ...DEFAULT_RULES }, updatedAt: null };
}

export function priceIsCurrent(p, rules, today = todayIso()) {
  if (!p || !p.verified) return false;
  return daysBetween(p.verified, today) <= (p.maxAge ?? rules.priceMaxAgeDays);
}

export function priceExpiry(p, rules) {
  return p && p.verified ? addDays(p.verified, p.maxAge ?? rules.priceMaxAgeDays) : null;
}

export async function nextQuoteNumber(kv) {
  const yy = todayIso().slice(2, 4);
  const key = "counter:" + yy;
  // Single-user tool: a read-then-write counter is adequate. Collisions are checked on save.
  for (let i = 0; i < 5; i++) {
    const n = (Number(await kv.get(key)) || 0) + 1;
    await kv.put(key, String(n));
    const num = `Q${yy}-${String(n).padStart(4, "0")}`;
    if (!(await kv.get("quote:" + num))) return num;
  }
  throw new HttpError(500, "Could not assign a quote number");
}

export function listMeta(q) {
  return {
    number: q.number, status: q.status, customer: q.customer?.company || q.customer?.name || "",
    contact: q.customer?.name || "", sell: q.pricing?.sell || 0, date: q.issuedOn || q.createdOn,
    validThrough: q.validThrough || null, crmDealId: q.crm?.dealId || null, summary: q.summary || ""
  };
}

export async function saveQuote(kv, q) {
  await kv.put("quote:" + q.number, JSON.stringify(q), { metadata: listMeta(q) });
}

export async function loadQuote(kv, number) {
  if (!/^Q\d{2}-\d{4}(-R\d+)?$/.test(number || "")) throw new HttpError(400, "Bad quote number");
  const q = await kv.get("quote:" + number, "json");
  if (!q) throw new HttpError(404, "Quote not found");
  return q;
}

// Checks run on the server so they cannot be skipped from the browser.
export function validateForIssue(q, settings) {
  const { prices, rules } = settings;
  const problems = [];
  const today = todayIso();
  const byId = Object.fromEntries(prices.map(p => [p.id, p]));
  const ids = [...new Set((q.bom || []).map(l => l.id).filter(Boolean))];
  const stale = ids.filter(id => !priceIsCurrent(byId[id], rules, today)).map(id => byId[id]?.name || id);
  if (stale.length) problems.push("Costs out of date or never verified: " + stale.join("; "));

  const cost = Number(q.pricing?.cost) || 0;
  const sell = Number(q.pricing?.sell) || 0;
  if (cost <= 0 || sell <= 0) problems.push("Quote has no cost or price");
  else if ((sell - cost) / sell < rules.minMargin - 1e-6) problems.push(`Margin is below the ${Math.round(rules.minMargin * 100)}% minimum`);
  if (!q.customer?.name && !q.customer?.company) problems.push("Customer name or company is required");

  // Validity: the earlier of quoteValidDays or the first cost expiry.
  let valid = addDays(today, rules.quoteValidDays);
  for (const id of ids) {
    const exp = priceExpiry(byId[id], rules);
    if (exp && exp >= today && exp < valid) valid = exp;
  }
  return { problems, validThrough: valid };
}

// ---------- OnePageCRM ----------
export function crmClient(env) {
  if (!env.ONEPAGE_USER_ID || !env.ONEPAGE_API_KEY) throw new HttpError(503, "OnePageCRM keys are not set");
  const auth = "Basic " + btoa(`${env.ONEPAGE_USER_ID}:${env.ONEPAGE_API_KEY}`);
  return async (method, path, data) => {
    const res = await fetch("https://app.onepagecrm.com/api/v3" + path, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : undefined
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || (out.status && out.status !== 0)) {
      throw new HttpError(502, `OnePageCRM ${method} ${path.split("?")[0]} ${res.status}: ${JSON.stringify(out.errors || out.message || out).slice(0, 300)}`);
    }
    return out.data || {};
  };
}
