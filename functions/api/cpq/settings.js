// GET  /api/cpq/settings  -> prices and rules
// PUT  /api/cpq/settings  -> save prices and rules (minimum margin can never go below 20%)
import { json, handle, needKv, getSettings, DEFAULT_RULES, HttpError, todayIso } from "../../../lib/cpq.js";

export const onRequestGet = handle(async ({ env, data }) => {
  const s = await getSettings(needKv(env));
  return json({ ok: true, ...s, today: todayIso(), user: data.user });
});

export const onRequestPut = handle(async ({ request, env }) => {
  const kv = needKv(env);
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.prices)) throw new HttpError(400, "Expected prices");

  const seen = new Set();
  const prices = body.prices.map(p => {
    const id = String(p.id || "").trim();
    if (!/^[a-z0-9_]{1,40}$/.test(id) || seen.has(id)) throw new HttpError(400, `Bad or duplicate price id: ${id}`);
    seen.add(id);
    const cost = Number(p.cost);
    if (!Number.isFinite(cost) || cost < 0) throw new HttpError(400, `Bad cost for ${id}`);
    const verified = p.verified && /^\d{4}-\d{2}-\d{2}$/.test(p.verified) ? p.verified : null;
    if (verified && verified > todayIso()) throw new HttpError(400, `Verified date for ${id} is in the future`);
    const out = { id, name: String(p.name || id).slice(0, 80), cat: String(p.cat || "Other").slice(0, 30), cost, unit: String(p.unit || "ea").slice(0, 20), verified };
    if (p.maxAge != null && p.maxAge !== "") out.maxAge = Math.max(1, Math.min(365, Math.round(Number(p.maxAge))));
    if (p.sample && !verified) out.sample = true;
    return out;
  });

  const rules = { ...DEFAULT_RULES };
  for (const [k, v] of Object.entries(body.rules || {})) {
    if (k in DEFAULT_RULES && Number.isFinite(Number(v))) rules[k] = Number(v);
  }
  // Company policy: never below a 20% margin, and the minimum can't exceed the default.
  rules.minMargin = Math.max(0.20, Math.min(rules.minMargin, 0.6));
  rules.targetMargin = Math.max(rules.minMargin, Math.min(rules.targetMargin, 0.6));
  rules.quoteValidDays = Math.max(1, Math.min(60, Math.round(rules.quoteValidDays)));
  rules.priceMaxAgeDays = Math.max(1, Math.min(365, Math.round(rules.priceMaxAgeDays)));

  const settings = { prices, rules, updatedAt: new Date().toISOString() };
  await kv.put("settings", JSON.stringify(settings));
  return json({ ok: true, ...settings, today: todayIso() });
});
