// POST /api/estimate  {inputs}  ->  budget price for the configurator (no costs or margins).
import { evaluate, json } from "../../lib/webquote.js";
import { PRICE_PENDING } from "../../lib/quoteText.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  try {
    const { design, priced, allowed } = await evaluate(env, request, body && body.inputs);
    if (design.status !== "ok") return json({ ok: true, status: design.status, price: null, note: design.message });
    return json({
      ok: true, status: "ok",
      price: allowed.ok ? { sell: priced.sell, sample: !!allowed.sample } : null,
      note: allowed.ok ? null : PRICE_PENDING,
      freight: { state: priced.state, miles: priced.milesKnown ? priced.miles : null }
    });
  } catch (e) {
    console.log("estimate error", e && e.stack || e);
    return json({ ok: false, error: "Could not price this configuration." }, 500);
  }
}

export function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  return json({ ok: false, error: "Use POST" }, 405);
}
