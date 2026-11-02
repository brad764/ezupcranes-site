// Shared by the quote routes. Files starting with "_" are not routes.
import { HttpError } from "./cpq.js";

const str = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function cleanQuoteBody(b) {
  const c = b.customer || {};
  const bom = Array.isArray(b.bom) ? b.bom.slice(0, 200).map(l => ({
    id: str(l.id, 40), label: str(l.label, 160), cat: str(l.cat, 30), qty: num(l.qty), unit: str(l.unit, 20),
    cost: num(l.cost), ext: num(l.ext)
  })) : [];
  const cost = bom.reduce((s, l) => s + l.qty * l.cost, 0);
  const sell = num(b.pricing?.sell);
  if (bom.length && Math.abs(cost - num(b.pricing?.cost)) > 1) throw new HttpError(400, "Cost total does not match the line items");
  return {
    customer: {
      name: str(c.name, 100), company: str(c.company, 100), email: str(c.email, 120), phone: str(c.phone, 40),
      site: str(c.site, 200), contactId: str(c.contactId, 40) || undefined
    },
    project: str(b.project, 120),
    inputs: typeof b.inputs === "object" && b.inputs ? b.inputs : {},
    summary: str(b.summary, 200),
    rec: Array.isArray(b.rec) ? b.rec.slice(0, 12).map(r => [str(r?.[0], 40), str(r?.[1], 120)]) : [],
    scope: Array.isArray(b.scope) ? b.scope.slice(0, 40).map(s => str(s, 300)) : [],
    bom,
    pricing: { cost: Math.round(cost * 100) / 100, sell: Math.round(sell), margin: sell > 0 ? (sell - cost) / sell : 0 },
    notes: str(b.notes, 2000),
    internalNotes: str(b.internalNotes, 2000)
  };
}
