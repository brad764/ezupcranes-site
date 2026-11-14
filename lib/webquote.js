// Shared by /api/estimate and /api/quote.
import { getSettings } from "./cpq.js";
import { design } from "./craneDesign.js";
import { priceTable, priceDesign, publicPriceAllowed } from "./pricing.js";

export function pricingMode(env, request) {
  if (env.PUBLIC_PRICING) return String(env.PUBLIC_PRICING).toLowerCase();
  const host = new URL(request.url).hostname;
  // Preview deployments and local testing show sample prices so the flow can be reviewed.
  if (host.endsWith(".pages.dev") || host === "localhost" || host === "127.0.0.1") return "preview";
  return "verified";
}

export async function evaluate(env, request, inputs) {
  const settings = env.CPQ ? await getSettings(env.CPQ).catch(() => null) : null;
  const table = priceTable(settings);
  const d = design(inputs || {});
  if (d.status !== "ok") return { design: d, priced: null, allowed: { ok: false, reason: "engineer" }, table };
  const priced = priceDesign(d, table);
  const allowed = publicPriceAllowed(table, priced, pricingMode(env, request));
  return { design: d, priced, allowed, table };
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
