// Web estimates from the configurator: storage in the CPQ KV namespace and the emails built from the
// saved record. The CPQ Quotes list shows these next to the Q-numbered quotes; the emails can be
// re-sent from the CPQ because they are built from the record alone.
import { DISCLAIMER, TERMS, PRICE_PENDING, BUILDING_OFFER } from "./quoteText.js";
import { sendMail, esc } from "./notify.js";

export const WEB_STATUSES = ["new", "confirmed", "sent", "won", "lost"];
const money = n => "$" + Math.round(n).toLocaleString("en-US");

export function webMeta(r) {
  return {
    number: r.number, source: "web", status: r.workflow || "new", customer: r.customer.company || r.customer.name, contact: r.customer.name,
    summary: r.summary, sell: r.price, date: r.date, validThrough: r.validThrough,
    emailOk: r.delivery ? !!(r.delivery.ezup && r.delivery.ezup.ok) : null, crmOk: r.delivery ? !!(r.delivery.crm && r.delivery.crm.ok) : null
  };
}

export async function saveWeb(kv, r) {
  await kv.put("webquote:" + r.number, JSON.stringify(r), { metadata: webMeta(r) });
}

export async function loadWeb(kv, number) {
  if (!/^W\d{2}-[\w-]{3,12}$/.test(number || "")) return null;
  return kv.get("webquote:" + number, "json");
}

const T = 'style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse"';
const td = 'style="padding:4px 12px 4px 0;vertical-align:top;border-bottom:1px solid #eee"';
const rows = pairs => pairs.filter(p => p[1] !== "" && p[1] != null).map(([k, v]) => `<tr><td ${td}><b>${esc(k)}</b></td><td ${td}>${esc(v)}</td></tr>`).join("");

export function internalHtml(r, cpqUrl) {
  const c = r.customer, I = r.internal;
  let h = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:760px">`;
  h += `<h2 style="margin:0 0 4px">Web estimate ${esc(r.number)}</h2><p style="margin:0 0 12px;color:#555">${esc(r.summary)}</p>`;
  if (r.pricingMode === "preview" || r.sampleCosts) h += `<p style="background:#FFF4CC;padding:8px 10px;margin:0 0 12px"><b>Costs used are SAMPLE values</b> from the price table, not verified costs.</p>`;
  h += `<p style="margin:0 0 12px">${r.price != null ? `Budget price shown to the customer: <b>${money(r.price)}</b>` : `<b>No price was shown to the customer.</b> ${esc(I ? I.priceWithheld || "" : r.message || "")}`}</p>`;
  h += `<p style="margin:0 0 12px"><b>Building evaluation:</b> ${r.bldgEval ? `requested by the customer${r.evalPrice ? ` (${money(r.evalPrice)} of the price)` : ""}` : (r.building && r.building.recommended ? "recommended, not selected. Offer it." : "not selected.")}</p>`;
  h += `<table ${T}>${rows([["Customer", c.name], ["Company", c.company], ["Email", c.email], ["Phone", c.phone], ["Site ZIP", r.inputs.zip], ["Notes", c.notes], ["Configuration", r.link], ["Open in the CPQ", cpqUrl]])}</table>`;
  if (r.status === "ok") {
    h += `<h3>Members</h3><table ${T}>${r.members.map(m => `<tr><td ${td}>${esc(m.role)}</td><td ${td}>${esc(m.size)}</td><td ${td}>${m.qty}</td><td ${td}>${m.lengthFt ? esc(m.lengthFt + " ft") : ""}</td><td ${td}>${(m.lb || 0).toLocaleString()} lb</td></tr>`).join("")}</table>`;
    h += `<h3>Design checks${r.worstRatio != null ? ` (worst ${r.worstRatio})` : ""}</h3><table ${T}>${r.checks.map(k => `<tr><td ${td}>${esc(k.name)}</td><td ${td}>${esc(k.value)}</td><td ${td}>${esc(k.limit)}</td><td ${td}>${k.ratio}</td><td ${td}>${esc(k.detail || "")}</td></tr>`).join("")}</table>`;
    if (r.buildingLoads && r.buildingLoads.length) h += `<h3>Loads on the building</h3><table ${T}>${rows(r.buildingLoads)}</table>`;
  }
  if (I) {
    h += `<h3>Bill of materials and cost</h3><table ${T}>${I.lines.map(l => `<tr><td ${td}>${esc(l.label)}</td><td ${td}>${l.qty} ${esc(l.unit)}</td><td ${td}>${money(l.cost)}</td><td ${td} align="right">${money(l.ext)}</td></tr>`).join("")}`;
    h += `<tr><td ${td}><b>Cost</b></td><td ${td}></td><td ${td}></td><td ${td} align="right"><b>${money(I.cost)}</b></td></tr>`;
    h += `<tr><td ${td}><b>Sell at ${Math.round(I.margin * 100)}% margin</b></td><td ${td}></td><td ${td}></td><td ${td} align="right"><b>${money(I.sell)}</b></td></tr></table>`;
    h += `<p style="color:#555">Freight and travel based on about ${I.miles} mi${I.state ? ` (${esc(I.state)})` : " (no ZIP given, default distance)"}.</p>`;
  }
  if (r.warnings && r.warnings.length) h += `<h3>Warnings</h3><ul>${r.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  if (r.assumptions && r.assumptions.length) h += `<h3>Assumptions</h3><ul>${r.assumptions.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
  const crm = r.delivery && r.delivery.crm;
  if (crm) h += `<p style="color:${crm.ok ? "#1E6B3A" : "#B3261E"}">${crm.ok ? "Added to OnePageCRM with a note and an ASAP action." : `NOT added to OnePageCRM: ${esc(crm.error)}`}</p>`;
  h += `<p style="color:#555">Reply to this email to answer ${esc(c.name)} directly.</p></div>`;
  return h;
}

export function customerHtml(r) {
  let h = `<div style="font-family:Arial,sans-serif;font-size:15px;max-width:640px;color:#1C1E21">`;
  h += `<h2 style="margin:0 0 4px">EZUP estimate ${esc(r.number)}</h2><p style="margin:0 0 12px;color:#555">${esc(r.date)} · valid through ${esc(r.validThrough)}</p>`;
  h += `<p style="background:#FFF4CC;padding:10px 12px"><b>${esc(DISCLAIMER)}</b></p>`;
  h += `<p><b>${esc(r.summary)}</b></p><ul>${(r.scope || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul>`;
  h += r.price != null ? `<p style="font-size:20px">Budget price: <b>${money(r.price)}</b>${r.evalPrice ? `<br><span style="font-size:14px">includes ${money(r.evalPrice)} for the building structure evaluation</span>` : ""}</p>` : `<p>${esc(PRICE_PENDING)}</p>`;
  h += `<p><b>Engineering services.</b> ${esc(BUILDING_OFFER)}${r.bldgEval ? " You asked for this evaluation; it is included in this estimate." : ""}</p>`;
  h += `<p><a href="${esc(r.link)}">Open your configuration, drawing and 3D model</a></p>`;
  h += `<ul style="color:#555;font-size:13px">${TERMS.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
  h += `<p>EZUP Crane Systems · 627 Claypool Hill Mall Road, Cedar Bluff, VA 24609 · (276) 582-1970</p></div>`;
  return h;
}

export function emailEzup(env, r, origin) {
  const c = r.customer;
  const who = c.company ? `${c.name}, ${c.company}` : c.name;
  const cpqUrl = `${origin}/cpq/#w/${encodeURIComponent(r.number)}`;
  return sendMail(env, {
    to: env.NOTIFY_EMAIL || "brad@ezupcranes.com", replyTo: c.email,
    subject: `Web estimate ${r.number}: ${who}, ${r.summary}`,
    html: internalHtml(r, cpqUrl), text: `Web estimate ${r.number} for ${who}\n${r.summary}\n${cpqUrl}`
  });
}

export function emailCustomer(env, r) {
  if (!env.MAIL_FROM) return Promise.resolve({ ok: false, error: "MAIL_FROM is not set, so customer copies are off" });
  return sendMail(env, {
    to: r.customer.email, replyTo: env.NOTIFY_EMAIL || "brad@ezupcranes.com",
    subject: `Your EZUP estimate ${r.number}`, html: customerHtml(r), text: `${DISCLAIMER}\n\n${r.summary}\n${r.link}`
  });
}

export const stamp = res => ({ ok: !!res.ok, error: res.ok ? null : String(res.error || "failed").slice(0, 400), at: new Date().toISOString() });
