// Every /api/cpq/* request must come through Cloudflare Access.
// Access puts a signed token (Cf-Access-Jwt-Assertion) on each request; we verify its
// signature against the team's public keys, the audience tag, the expiry, and that the
// email is on the allowed list. Without Access configured, every request is refused.
//
// Settings (Pages > Settings > Variables and Secrets, Production):
//   ACCESS_TEAM_DOMAIN  e.g. ezup.cloudflareaccess.com
//   ACCESS_AUD          the Application Audience (AUD) tag of the Access application
//   ADMIN_EMAILS        comma-separated, e.g. brad@ezupcranes.com

import { json } from "../../../lib/cpq.js";

let certCache = { at: 0, keys: null, team: null };

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);

  // Local development only: lets the tool run under `wrangler pages dev` on this machine.
  if (env.DEV_AUTH_BYPASS === "1" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    ctx.data.user = "dev@localhost";
    return ctx.next();
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) {
    return json({ ok: false, error: "Login is not configured yet (Cloudflare Access settings missing)." }, 503);
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion") || cookie(request, "CF_Authorization");
  if (!token) return json({ ok: false, error: "Please sign in." }, 401);

  try {
    const claims = await verify(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    const allowed = env.ADMIN_EMAILS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const email = String(claims.email || "").toLowerCase();
    if (!allowed.includes(email)) return json({ ok: false, error: "This account is not allowed." }, 403);
    ctx.data.user = email;
  } catch (e) {
    return json({ ok: false, error: "Sign-in could not be verified. Reload the page to sign in again." }, 401);
  }
  return ctx.next();
}

function cookie(req, name) {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

function b64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function keys(team) {
  const now = Date.now();
  if (certCache.keys && certCache.team === team && now - certCache.at < 3600_000) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs " + res.status);
  const { keys: jwks } = await res.json();
  certCache = { at: now, team, keys: jwks };
  return jwks;
}

async function verify(token, team, aud) {
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) throw new Error("malformed");
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
  const jwk = (await keys(team)).find(k => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(h + "." + p));
  if (!ok) throw new Error("bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) throw new Error("expired");
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(aud)) throw new Error("wrong audience");
  if (claims.iss && claims.iss !== `https://${team}`) throw new Error("wrong issuer");
  return claims;
}
