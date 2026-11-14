// Email (Resend) and OnePageCRM helpers shared by website functions.
const OPC = "https://app.onepagecrm.com/api/v3";

export function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

export async function sendMail(env, { to, replyTo, subject, html, text }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "email not configured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "EZUP Website <onboarding@resend.dev>", to: [].concat(to), reply_to: replyTo, subject, html, text })
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
  return { ok: true };
}

// Find or create the contact, add a note and an ASAP next action. Returns {ok, contactId}.
export async function crmLead(env, { name, company, email, phone, zip, note, action }) {
  if (!env.ONEPAGE_USER_ID || !env.ONEPAGE_API_KEY) return { ok: false, error: "crm not configured" };
  const auth = "Basic " + btoa(`${env.ONEPAGE_USER_ID}:${env.ONEPAGE_API_KEY}`);
  const call = async (method, path, data) => {
    const res = await fetch(OPC + path, {
      method, headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: data ? JSON.stringify(data) : undefined
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || (out.status && out.status !== 0)) throw new Error(`OnePageCRM ${method} ${path.split("?")[0]} ${res.status}: ${JSON.stringify(out).slice(0, 300)}`);
    return out.data || {};
  };
  try {
    let contactId = null;
    const found = await call("GET", `/contacts.json?email=${encodeURIComponent(email)}&per_page=1`);
    const first = (found.contacts || [])[0];
    if (first) contactId = (first.contact || first).id;
    if (!contactId) {
      const [firstName, ...rest] = name.split(/\s+/);
      const created = await call("POST", "/contacts.json", {
        first_name: rest.length ? firstName : "", last_name: rest.length ? rest.join(" ") : firstName,
        company_name: company || undefined, emails: [{ type: "work", value: email }],
        phones: phone ? [{ type: "work", value: phone }] : undefined, zip_code: zip || undefined,
        lead_source_id: "email_web", tags: ["EZUP"]
      });
      contactId = (created.contact || created).id;
    }
    if (!contactId) throw new Error("OnePageCRM returned no contact id");
    await call("POST", "/notes.json", { contact_id: contactId, text: note });
    await call("POST", "/actions.json", { contact_id: contactId, status: "asap", text: action.slice(0, 140) });
    return { ok: true, contactId };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
