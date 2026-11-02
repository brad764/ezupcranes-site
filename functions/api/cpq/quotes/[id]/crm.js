// POST /api/cpq/quotes/:id/crm
// Finds or creates the customer in OnePageCRM and creates (or updates) a deal for the quote
// in the Sales pipeline at "Send Proposal", with a note listing the scope.
import { json, handle, needKv, loadQuote, saveQuote, crmClient, HttpError } from "../../../../../lib/cpq.js";

const STAGE_SEND_PROPOSAL = 60;

export const onRequestPost = handle(async ({ env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  if (q.status === "draft") throw new HttpError(409, "Issue the quote before sending it to OnePageCRM.");
  const call = crmClient(env);
  const c = q.customer || {};

  let contactId = c.contactId || q.crm?.contactId || null;
  if (!contactId && c.email) {
    const found = await call("GET", `/contacts.json?email=${encodeURIComponent(c.email)}&per_page=1`);
    const first = (found.contacts || [])[0];
    if (first) contactId = (first.contact || first).id;
  }
  if (!contactId) {
    const parts = (c.name || "").split(/\s+/).filter(Boolean);
    const contact = {
      first_name: parts.length > 1 ? parts[0] : "",
      last_name: parts.length > 1 ? parts.slice(1).join(" ") : (parts[0] || c.company || "Unknown"),
      company_name: c.company || undefined,
      emails: c.email ? [{ type: "work", value: c.email }] : undefined,
      phones: c.phone ? [{ type: "work", value: c.phone }] : undefined,
      tags: ["EZUP"]
    };
    const created = await call("POST", "/contacts.json", contact);
    contactId = (created.contact || created).id;
  }
  if (!contactId) throw new HttpError(502, "OnePageCRM returned no contact");

  const name = `EZUP ${q.number}${q.project ? " " + q.project : ""}`.slice(0, 60);
  const text = [
    q.summary,
    `Valid through ${q.validThrough}. Material escalation clause at ${q.terms?.escalationPct ?? 10}%.`,
    "",
    ...(q.scope || []).map(s => "- " + s)
  ].join("\n").slice(0, 2000);
  const deal = {
    contact_id: contactId, name, text, status: "pending", stage: STAGE_SEND_PROPOSAL,
    amount: q.pricing.sell, cost: Math.round(q.pricing.cost), expected_close_date: q.validThrough
  };

  let dealId = q.crm?.dealId || null;
  if (dealId && q.crm?.syncedNumber === q.number) {
    throw new HttpError(409, "This quote is already in OnePageCRM.");
  } else if (dealId) {
    // A revision updates the same deal so the pipeline doesn't double count.
    const { contact_id, ...update } = deal; // contact_id can't change on an existing deal
    await call("PUT", `/deals/${dealId}.json`, update);
  } else {
    const created = await call("POST", "/deals.json", deal);
    dealId = (created.deal || created).id;
  }

  await call("POST", "/notes.json", { contact_id: contactId, text: `Quote ${q.number} sent: $${q.pricing.sell.toLocaleString("en-US")}. ${q.summary || ""}`.slice(0, 2000) });

  const now = new Date().toISOString();
  const next = {
    ...q, crm: { contactId, dealId, sentAt: now, syncedNumber: q.number },
    customer: { ...c, contactId },
    history: [...(q.history || []), { at: now, by: data.user, event: "Sent to OnePageCRM" }]
  };
  await saveQuote(kv, next);
  return json({ ok: true, quote: next });
});
