// GET  /api/cpq/quotes/:id                -> one quote
// PUT  /api/cpq/quotes/:id                -> update a draft
// POST /api/cpq/quotes/:id  {action}      -> "issue" (locks it, sets validity) or "revise" (copy issued quote to -R#)
import { json, handle, needKv, loadQuote, saveQuote, getSettings, validateForIssue, todayIso, HttpError } from "../../../../lib/cpq.js";
import { cleanQuoteBody } from "../../../../lib/quotebody.js";

export const onRequestGet = handle(async ({ env, params }) => {
  return json({ ok: true, quote: await loadQuote(needKv(env), params.id) });
});

export const onRequestPut = handle(async ({ request, env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  if (q.status !== "draft") throw new HttpError(409, "This quote was issued and is locked. Use Revise to change it.");
  const body = await request.json().catch(() => null);
  if (!body) throw new HttpError(400, "Expected a quote");
  const now = new Date().toISOString();
  const next = { ...q, ...cleanQuoteBody(body), updatedAt: now };
  next.history = [...(q.history || []), { at: now, by: data.user, event: "Saved" }].slice(-50);
  await saveQuote(kv, next);
  return json({ ok: true, quote: next });
});

export const onRequestPost = handle(async ({ request, env, params, data }) => {
  const kv = needKv(env);
  const q = await loadQuote(kv, params.id);
  const { action } = (await request.json().catch(() => ({}))) || {};
  const now = new Date().toISOString();

  if (action === "issue") {
    if (q.status !== "draft") throw new HttpError(409, "Already issued");
    const settings = await getSettings(kv);
    const { problems, validThrough } = validateForIssue(q, settings);
    if (problems.length) throw new HttpError(422, problems.join(". "));
    const issued = {
      ...q, status: "issued", issuedOn: todayIso(), validThrough, updatedAt: now,
      terms: { validDays: settings.rules.quoteValidDays, escalationPct: settings.rules.escalationPct },
      history: [...(q.history || []), { at: now, by: data.user, event: `Issued, valid through ${validThrough}` }]
    };
    await saveQuote(kv, issued);
    return json({ ok: true, quote: issued });
  }

  if (action === "revise") {
    if (q.status === "draft") throw new HttpError(409, "Drafts can be edited directly");
    const base = q.number.replace(/-R\d+$/, "");
    let n = 1;
    while (await kv.get(`quote:${base}-R${n}`)) n++;
    const rev = {
      ...q, number: `${base}-R${n}`, status: "draft", revisionOf: q.number, issuedOn: undefined, validThrough: undefined,
      terms: undefined, crm: q.crm, createdOn: todayIso(), createdAt: now, updatedAt: now,
      history: [{ at: now, by: data.user, event: `Revision of ${q.number}` }]
    };
    await saveQuote(kv, rev);
    await saveQuote(kv, { ...q, status: "superseded", updatedAt: now, history: [...(q.history || []), { at: now, by: data.user, event: `Superseded by ${rev.number}` }] });
    return json({ ok: true, quote: rev });
  }

  throw new HttpError(400, "Unknown action");
});
