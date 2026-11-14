// POST /api/quote  {inputs, customer:{name, company, email, phone, notes}, website, elapsedMs}
//
// Creates a numbered web estimate. The visitor gets the estimate on screen (and by email once
// MAIL_FROM is a verified sending address). EZUP gets an email with the full design checks, bill of
// materials, cost and margin, and the lead goes to OnePageCRM with an ASAP action to confirm it.
import { evaluate, json, pricingMode } from "../../lib/webquote.js";
import { DISCLAIMER, TERMS, PRICE_PENDING } from "../../lib/quoteText.js";
import { sendMail, crmLead, esc } from "../../lib/notify.js";
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
    number, date, validThrough, customer, inputs: design.inputs, summary: design.summary, status: design.status,
    members: design.members, checks: design.checks, scope: design.scope, warnings: design.warnings, assumptions: design.assumptions,
    price: showPrice ? priced.sell : null, sampleCosts: showPrice ? !!allowed.sample : null,
    internal: priced ? { cost: priced.cost, sell: priced.sell, margin: priced.margin, lines: priced.lines, miles: priced.miles, state: priced.state, priceWithheld: showPrice ? null : allowed.reason } : null,
    pricingMode: pricingMode(env, request), link, createdAt: new Date().toISOString()
  };
  if (env.CPQ) {
    try { await env.CPQ.put("webquote:" + number, JSON.stringify(record), { metadata: { number, date, customer: customer.company || customer.name, summary: design.summary, price: record.price } }); }
    catch (e) { console.log("kv save failed", e); }
  }

  const who = customer.company ? `${customer.name}, ${customer.company}` : customer.name;
  const crm = await crmLead(env, {
    ...customer, zip: design.inputs.zip,
    note: `Web estimate ${number} (ezupcranes.com configurator)\n${design.summary}\n` +
      (showPrice ? `Budget price shown: ${money(priced.sell)}${allowed.sample ? " (SAMPLE costs)" : ""}\n` : "Price not shown to the customer; confirm and send.\n") +
      (priced ? `Internal cost ${money(priced.cost)}, margin ${Math.round(priced.margin * 100)}%\n` : "") +
      `Open the configuration: ${link}` + (customer.notes ? `\n\nCustomer notes: ${customer.notes}` : ""),
    action: `Confirm web estimate ${number}: ${design.summary}`
  });
  const internal = await sendMail(env, {
    to: env.NOTIFY_EMAIL || "brad@ezupcranes.com", replyTo: customer.email,
    subject: `Web estimate ${number}: ${who}, ${design.summary}`,
    html: internalHtml(record, design, priced, allowed, crm), text: `Web estimate ${number} for ${who}\n${design.summary}\n${link}`
  });
  let customerMail = { ok: false, error: "MAIL_FROM not set" };
  if (env.MAIL_FROM) {
    customerMail = await sendMail(env, {
      to: customer.email, replyTo: env.NOTIFY_EMAIL || "brad@ezupcranes.com",
      subject: `Your EZUP estimate ${number}`, html: customerHtml(record, design), text: `${DISCLAIMER}\n\n${design.summary}\n${link}`
    });
  }
  if (!internal.ok) console.log("internal email failed:", internal.error);
  if (!crm.ok) console.log("crm failed:", crm.error);

  return json({
    ok: true, number, date, validThrough, status: design.status, summary: design.summary,
    price: showPrice ? { sell: priced.sell, sample: !!allowed.sample } : null,
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

const T = 'style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse"';
const td = 'style="padding:4px 12px 4px 0;vertical-align:top;border-bottom:1px solid #eee"';
const rows = pairs => pairs.filter(p => p[1] !== "" && p[1] != null).map(([k, v]) => `<tr><td ${td}><b>${esc(k)}</b></td><td ${td}>${esc(v)}</td></tr>`).join("");

function internalHtml(r, d, priced, allowed, crm) {
  const c = r.customer;
  const sample = priced && priced.lines.some(() => true) && allowed.sample;
  let h = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:760px">`;
  h += `<h2 style="margin:0 0 4px">Web estimate ${esc(r.number)}</h2><p style="margin:0 0 12px;color:#555">${esc(d.summary)}</p>`;
  if (r.pricingMode === "preview" || sample) h += `<p style="background:#FFF4CC;padding:8px 10px;margin:0 0 12px"><b>Costs used are SAMPLE values</b> from the price table, not verified costs.</p>`;
  h += `<p style="margin:0 0 12px">${r.price != null ? `Budget price shown to the customer: <b>${money(r.price)}</b>` : `<b>No price was shown to the customer.</b> ${esc(priced ? allowed.reason : d.message || "")}`}</p>`;
  h += `<table ${T}>${rows([["Customer", c.name], ["Company", c.company], ["Email", c.email], ["Phone", c.phone], ["Site ZIP", r.inputs.zip], ["Notes", c.notes], ["Configuration", r.link]])}</table>`;
  if (d.status === "ok") {
    h += `<h3>Members</h3><table ${T}>${d.members.map(m => `<tr><td ${td}>${esc(m.role)}</td><td ${td}>${esc(m.size)}</td><td ${td}>${m.qty}</td><td ${td}>${m.lengthFt ? esc(m.lengthFt + " ft") : ""}</td><td ${td}>${m.lb.toLocaleString()} lb</td></tr>`).join("")}</table>`;
    h += `<h3>Design checks (worst ${d.worstRatio})</h3><table ${T}>${d.checks.map(k => `<tr><td ${td}>${esc(k.name)}</td><td ${td}>${esc(k.value)}</td><td ${td}>${esc(k.limit)}</td><td ${td}>${k.ratio}</td><td ${td}>${esc(k.detail || "")}</td></tr>`).join("")}</table>`;
    if (d.reactions) h += `<p>Reactions: ${esc(Object.entries(d.reactions).map(([k, v]) => `${k} ${v}`).join(", "))}</p>`;
  }
  if (priced) {
    h += `<h3>Bill of materials and cost</h3><table ${T}>${priced.lines.map(l => `<tr><td ${td}>${esc(l.label)}</td><td ${td}>${l.qty} ${esc(l.unit)}</td><td ${td}>${money(l.cost)}</td><td ${td} align="right">${money(l.ext)}</td></tr>`).join("")}`;
    h += `<tr><td ${td}><b>Cost</b></td><td ${td}></td><td ${td}></td><td ${td} align="right"><b>${money(priced.cost)}</b></td></tr>`;
    h += `<tr><td ${td}><b>Sell at ${Math.round(priced.margin * 100)}% margin</b></td><td ${td}></td><td ${td}></td><td ${td} align="right"><b>${money(priced.sell)}</b></td></tr></table>`;
    h += `<p style="color:#555">Freight and travel based on about ${priced.miles} mi${priced.state ? ` (${esc(priced.state)})` : " (no ZIP given, default distance)"}.</p>`;
  }
  if (d.warnings && d.warnings.length) h += `<h3>Warnings</h3><ul>${d.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  if (d.assumptions && d.assumptions.length) h += `<h3>Assumptions</h3><ul>${d.assumptions.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  h += `<p style="color:${crm.ok ? "#1E6B3A" : "#B3261E"}">${crm.ok ? "Added to OnePageCRM with a note and an ASAP action." : `NOT added to OnePageCRM: ${esc(crm.error)}`}</p>`;
  h += `<p style="color:#555">Reply to this email to answer ${esc(c.name)} directly.</p></div>`;
  return h;
}

function customerHtml(r, d) {
  let h = `<div style="font-family:Arial,sans-serif;font-size:15px;max-width:640px;color:#1C1E21">`;
  h += `<h2 style="margin:0 0 4px">EZUP estimate ${esc(r.number)}</h2><p style="margin:0 0 12px;color:#555">${esc(r.date)} · valid through ${esc(r.validThrough)}</p>`;
  h += `<p style="background:#FFF4CC;padding:10px 12px"><b>${esc(DISCLAIMER)}</b></p>`;
  h += `<p><b>${esc(d.summary)}</b></p><ul>${d.scope.map(s => `<li>${esc(s)}</li>`).join("")}</ul>`;
  h += r.price != null ? `<p style="font-size:20px">Budget price: <b>${money(r.price)}</b></p>` : `<p>${esc(PRICE_PENDING)}</p>`;
  h += `<p><a href="${esc(r.link)}">Open your configuration, drawing and 3D model</a></p>`;
  h += `<ul style="color:#555;font-size:13px">${TERMS.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  h += `<p>EZUP Crane Systems · 627 Claypool Hill Mall Road, Cedar Bluff, VA 24609 · (276) 582-1970</p></div>`;
  return h;
}
