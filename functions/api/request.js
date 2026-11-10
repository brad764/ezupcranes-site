// Cloudflare Pages Function: POST /api/request
//
// Receives quote and dealer requests from the website forms, then:
//   1. emails the request to EZUP (via Resend), with Reply-To set to the visitor
//   2. adds or updates the contact in OnePageCRM, logs the request as a note,
//      and sets an ASAP next action so it shows at the top of the Action Stream
//
// Settings (Cloudflare Pages > ezupcranes-site > Settings > Variables and Secrets):
//   RESEND_API_KEY     secret   Resend API key
//   NOTIFY_EMAIL       text     where requests are emailed (brad@ezupcranes.com)
//   ONEPAGE_USER_ID    secret   OnePageCRM user ID (Apps > API configuration)
//   ONEPAGE_API_KEY    secret   OnePageCRM API key
//   MAIL_FROM          text     optional; defaults to Resend's test sender, which
//                               can only deliver to the Resend account's own email
//
// Each step runs independently, so a CRM outage never loses the email and vice versa.

const OPC = "https://app.onepagecrm.com/api/v3";
const MAX_FIELD = 4000;

const LABELS = {
  type: "I am a", interest: "Was looking at", product: "Needs", capacity: "Capacity", operation: "Operation", girder: "Girder",
  span: "Bridge span (ft)", runway_length: "Runway length (ft)", clear_height: "Clear height (ft)",
  support: "Support", power: "Power", notes: "Details", name: "Name", company: "Company",
  email: "Email", phone: "Phone", site_zip: "Site ZIP", timing: "Timing", territory: "Territory"
};

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request" }, 400); }

  const type = clean(body.type, 120) || "Website request";
  const f = {};
  for (const [k, v] of Object.entries(body.fields || {})) f[k] = clean(v, MAX_FIELD);

  // Spam trap: real visitors never see or fill this field.
  if (f.website) return json({ ok: true });

  if (!f.name || !isEmail(f.email)) return json({ ok: false, error: "Name and a valid email are required." }, 400);

  const summary = Object.entries(f)
    .filter(([k, v]) => v && k !== "website")
    .map(([k, v]) => `${LABELS[k] || k}: ${v}`)
    .join("\n");

  // CRM first, so the email can report whether the lead reached OnePageCRM.
  const crm = await toCrm(env, type, f, summary).catch(e => ({ ok: false, error: String(e && e.message || e) }));
  const mail = await sendEmail(env, type, f, summary, crm).catch(e => ({ ok: false, error: String(e && e.message || e) }));

  if (!mail.ok) console.log("email failed:", mail.error);
  if (!crm.ok) console.log("crm failed:", crm.error);

  if (mail.ok || crm.ok) return json({ ok: true, email: mail.ok, crm: crm.ok });
  return json({ ok: false, error: "Could not deliver the request." }, 502);
}

export function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  return json({ ok: false, error: "Use POST" }, 405);
}

// ---------- email ----------
async function sendEmail(env, type, f, summary, crm) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return { ok: false, error: "email not configured" };
  const who = f.company ? `${f.name}, ${f.company}` : f.name;
  const crmLine = crm && crm.ok
    ? "Added to OnePageCRM with a note and an ASAP next action."
    : `NOT added to OnePageCRM. Add this lead by hand. Reason: ${(crm && crm.error) || "unknown"}`;
  const html = `<h2 style="font-family:Arial,sans-serif">${esc(type)}</h2>
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
${Object.entries(f).filter(([k, v]) => v && k !== "website").map(([k, v]) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${esc(LABELS[k] || k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join("\n")}
</table>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">Reply to this email to answer ${esc(f.name)} directly.</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:${crm && crm.ok ? "#1E6B3A" : "#B3261E"}">${esc(crmLine)}</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "EZUP Website <onboarding@resend.dev>",
      to: [env.NOTIFY_EMAIL],
      reply_to: f.email,
      subject: `${type}: ${who}`,
      text: `${type}\n\n${summary}\n\nReply to this email to answer ${f.name} directly.\n${crmLine}`,
      html
    })
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// ---------- OnePageCRM ----------
async function toCrm(env, type, f, summary) {
  if (!env.ONEPAGE_USER_ID || !env.ONEPAGE_API_KEY) return { ok: false, error: "crm not configured" };
  const auth = "Basic " + btoa(`${env.ONEPAGE_USER_ID}:${env.ONEPAGE_API_KEY}`);
  const call = async (method, path, data) => {
    const res = await fetch(OPC + path, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : undefined
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || (out.status && out.status !== 0)) throw new Error(`OnePageCRM ${method} ${path} ${res.status}: ${JSON.stringify(out).slice(0, 300)}`);
    return out.data || {};
  };

  // Find an existing contact with this email so repeat visitors are not duplicated.
  let contactId = null;
  const found = await call("GET", `/contacts.json?email=${encodeURIComponent(f.email)}&per_page=1`);
  const first = (found.contacts || [])[0];
  if (first) contactId = (first.contact || first).id;

  if (!contactId) {
    const [firstName, ...rest] = f.name.split(/\s+/);
    const contact = {
      first_name: rest.length ? firstName : "",
      last_name: rest.length ? rest.join(" ") : firstName,
      company_name: f.company || undefined,
      emails: [{ type: "work", value: f.email }],
      phones: f.phone ? [{ type: "work", value: f.phone }] : undefined,
      zip_code: f.site_zip || undefined,
      // status defaults to Lead; the API rejects "lead" as a status_id
      lead_source_id: "email_web",
      tags: ["EZUP"]
    };
    const created = await call("POST", "/contacts.json", contact);
    contactId = (created.contact || created).id;
  }
  if (!contactId) throw new Error("OnePageCRM returned no contact id");

  await call("POST", "/notes.json", { contact_id: contactId, text: `${type} (ezupcranes.com)\n\n${summary}` });
  const product = f.product || f.type || "request";
  await call("POST", "/actions.json", {
    contact_id: contactId,
    status: "asap",
    text: `Reply to website ${type.toLowerCase().includes("dealer") ? "dealer inquiry" : "quote request"}: ${product}`.slice(0, 140)
  });
  return { ok: true };
}

// ---------- helpers ----------
function clean(v, max) { return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || ""); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
