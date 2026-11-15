// GET  /api/cpq/webquotes/:id                    -> one web estimate (full record, with cost)
// POST /api/cpq/webquotes/:id {action:"email"}   -> send the EZUP email again (and the customer copy if asked)
// POST /api/cpq/webquotes/:id {action:"status", status}  -> new | confirmed | sent | won | lost
import { json, handle, needKv, HttpError } from "../../../../lib/cpq.js";
import { loadWeb, saveWeb, emailEzup, emailCustomer, stamp, WEB_STATUSES } from "../../../../lib/webquotes.js";

async function load(env, id) {
  const r = await loadWeb(needKv(env), id);
  if (!r) throw new HttpError(404, "Web estimate not found");
  return r;
}

export const onRequestGet = handle(async ({ env, params }) => json({ ok: true, quote: await load(env, params.id) }));

export const onRequestPost = handle(async ({ request, env, params, data }) => {
  const kv = needKv(env);
  const r = await load(env, params.id);
  const body = (await request.json().catch(() => ({}))) || {};
  const now = new Date().toISOString();
  r.history = r.history || [];
  r.delivery = r.delivery || {};
  if (body.action === "email") {
    if (body.customer) {
      const c = await emailCustomer(env, r);
      r.delivery.customer = stamp(c);
      r.history.push({ at: now, by: data.user, event: c.ok ? "Customer copy sent" : `Customer copy failed: ${c.error}` });
      await saveWeb(kv, r);
      return json({ ok: true, quote: r, sent: c.ok, error: c.ok ? null : c.error });
    }
    const res = await emailEzup(env, r, new URL(request.url).origin);
    r.delivery.ezup = stamp(res);
    r.history.push({ at: now, by: data.user, event: res.ok ? "EZUP email re-sent" : `EZUP email failed: ${res.error}` });
    await saveWeb(kv, r);
    return json({ ok: true, quote: r, sent: res.ok, error: res.ok ? null : res.error });
  }
  if (body.action === "status") {
    if (!WEB_STATUSES.includes(body.status)) throw new HttpError(400, "Unknown status");
    r.workflow = body.status;
    r.history.push({ at: now, by: data.user, event: `Status: ${body.status}` });
    await saveWeb(kv, r);
    return json({ ok: true, quote: r });
  }
  throw new HttpError(400, "Unknown action");
});
