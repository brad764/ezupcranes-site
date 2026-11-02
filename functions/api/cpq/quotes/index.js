// GET  /api/cpq/quotes   -> list of saved quotes (newest first)
// POST /api/cpq/quotes   -> create a new draft quote with the next number
import { json, handle, needKv, nextQuoteNumber, saveQuote, todayIso, HttpError } from "../../../../lib/cpq.js";
import { cleanQuoteBody } from "../../../../lib/quotebody.js";

export const onRequestGet = handle(async ({ env }) => {
  const kv = needKv(env);
  const rows = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: "quote:", cursor, limit: 1000 });
    for (const k of page.keys) rows.push(k.metadata || { number: k.name.slice(6) });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  rows.sort((a, b) => String(b.number).localeCompare(String(a.number)));
  return json({ ok: true, quotes: rows });
});

export const onRequestPost = handle(async ({ request, env, data }) => {
  const kv = needKv(env);
  const body = await request.json().catch(() => null);
  if (!body) throw new HttpError(400, "Expected a quote");
  const number = await nextQuoteNumber(kv);
  const now = new Date().toISOString();
  const q = {
    ...cleanQuoteBody(body),
    number, status: "draft", createdOn: todayIso(), createdAt: now, updatedAt: now, createdBy: data.user,
    history: [{ at: now, by: data.user, event: "Created" }]
  };
  await saveQuote(kv, q);
  return json({ ok: true, quote: q }, 201);
});
