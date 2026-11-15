// POST /api/quote  {inputs, customer:{name, company, email, phone, notes}, website, elapsedMs}
//
// Creates a numbered web estimate. The visitor gets the estimate on screen (and by email once
// MAIL_FROM is a verified sending address). EZUP gets an email with the full design checks, bill of
// materials, cost and margin, and the lead goes to OnePageCRM with an ASAP action to confirm it.
import { evaluate, json, pricingMode } from "../../lib/webquote.js";
import { DISCLAIMER, TERMS, PRICE_PENDING, BUILDING_OFFER } from "../../lib/quoteText.js";
import { crmLead } from "../../lib/notify.js";
import { saveWeb, emailEzup, emailCustomer, stamp } from "../../lib/webquotes.js";
import { todayIso, addDays } from "../../lib/cpq.js";

const money = n => "$" + Math.round(n).toLocaleString("en-US");
const clean = (v, n) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  if (body.website) return json({ ok: true, number: "W00-0000" });            // spam trap
  const c = body.customer || {};
  const customer = {
    name: clean(c.name, 100), company: clean(c.company, 120), email: clean(c.email, 160).toLowerCase(),
    phone: clean(c.phone, 40), notes: clean(c.notes, 2000)
  };
  if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return json({ ok: false, error: "Name and a valid email are required." }, 400);
  if (Number(body.elapsedMs) > 0 && Number(body.elapsedMs) < 2000) return json({ ok: false, error: "Please try again." }, 429);

  let ev;
  try { ev = await evaluate(env, request, body.inputs); }
  catch (e) { console.log("quote eval", e && e.stack || e); return json({ ok: false, error: "Could not price this configuration." }, 500); }
  const { design, priced, allowed } = ev;

  const date = todayIso();
  const number = await nextNumber(env);
  const validThrough = addDays(date, 15);
  const showPrice = !!(priced && allowed.ok);
  const origin = new URL(request.url).origin;
  const link = `${origin}/configure.html?${new URLSearchParams(Object.entries(design.inputs).filter(([, v]) => v != null && v !== "")).toString()}`;

  const record = {
    number, date, validThrough, customer, inputs: design.inputs, title: design.title, summary: design.summary, status: design.status, message: design.message || null,
    members: design.members, checks: design.checks, worstRatio: design.worstRatio ?? null, scope: design.scope, warnings: design.warnings, assumptions: design.assumptions,
    hoist: design.hoist || null, hookFt: design.hookFt ?? null, reactions: design.reactions || null,
    price: showPrice ? priced.sell : null, evalPrice: showPrice ? priced.evalSell || 0 : null, bldgEval: design.inputs.bldg === "yes",
    building: design.building, buildingLoads: design.buildingLoads, sampleCosts: showPrice ? !!allowed.sample : null,
    internal: priced ? { cost: priced.cost, sell: priced.sell, craneSell: priced.craneSell, evalSell: priced.evalSell, margin: priced.margin, lines: priced.lines, miles: priced.miles, state: priced.state, priceWithheld: showPrice ? null : allowed.reason } : null,
    pricingMode: pricingMode(env, request), link, createdAt: new Date().toISOString(), workflow: "new", history: [{ at: new Date().toISOString(), event: "Created on the website" }]
  };
  // Save first, so the quote is in the CPQ list even if email or the CRM fails.
  if (env.CPQ) { try { await saveWeb(env.CPQ, record); } catch (e) { console.log("kv save failed", e); } }

  const crm = await crmLead(env, {
    ...customer, zip: design.inputs.zip,
    note: `Web estimate ${number} (ezupcranes.com configurator)\n${design.summary}\n` +
      (showPrice ? `Budget price shown: ${money(priced.sell)}${allowed.sample ? " (SAMPLE costs)" : ""}\n` : "Price not shown to the customer; confirm and send.\n") +
      (priced ? `Internal cost ${money(priced.cost)}, margin ${Math.round(priced.margin * 100)}%\n` : "") +
      (design.inputs.bldg === "yes" ? `Customer asked for a building structure evaluation${showPrice ? ` (${money(priced.evalSell)} included)` : ""}.\n` : (design.building && design.building.recommended ? "Building evaluation recommended but not selected; offer it.\n" : "")) +
      `Open in the CPQ: ${origin}/cpq/#w/${number}\nConfiguration: ${link}` + (customer.notes ? `\n\nCustomer notes: ${customer.notes}` : ""),
    action: `Confirm web estimate ${number}: ${design.summary}`
  });
  record.delivery = { crm: { ...stamp(crm), contactId: crm.contactId || null } };
  const internal = await emailEzup(env, record, origin);
  const customerMail = await emailCustomer(env, record);
  record.delivery.ezup = stamp(internal);
  record.delivery.customer = stamp(customerMail);
  if (env.CPQ) { try { await saveWeb(env.CPQ, record); } catch (e) { console.log("kv save failed", e); } }
  if (!internal.ok) console.log("internal email failed:", internal.error);
  if (!crm.ok) console.log("crm failed:", crm.error);

  return json({
    ok: true, number, date, validThrough, status: design.status, summary: design.summary,
    price: showPrice ? { sell: priced.sell, crane: priced.craneSell, eval: priced.evalSell || 0, sample: !!allowed.sample } : null,
    buildingOffer: BUILDING_OFFER,
    priceNote: showPrice ? null : (design.status === "ok" ? PRICE_PENDING : design.message),
    freight: priced ? { state: priced.state, miles: priced.milesKnown ? priced.miles : null } : null,
    disclaimer: DISCLAIMER, terms: TERMS, emailed: { ezup: internal.ok || crm.ok, customer: customerMail.ok }
  });
}

export function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  return json({ ok: false, error: "Use POST" }, 405);
}

async function nextNumber(env) {
  const yy = todayIso().slice(2, 4);
  if (env.CPQ) {
    try {
      const key = "webcounter:" + yy;
      const n = (Number(await env.CPQ.get(key)) || 0) + 1;
      await env.CPQ.put(key, String(n));
      return `W${yy}-${String(n).padStart(4, "0")}`;
    } catch (e) { console.log("counter failed", e); }
  }
  const md = todayIso().slice(5).replace("-", "");
  return `W${yy}-${md}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}
