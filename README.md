# ezupcranes.com

Static website for EZUP Crane Systems.

- `src/` – page content, one file per page
- `site/` – the finished website; this is the folder to deploy
- `build.py` – wraps each page in the shared header and footer. Run `python3 build.py` after editing anything in `src/`.

## Deploying (Cloudflare Pages)
1. Push this folder to a GitHub repository.
2. In Cloudflare Pages, connect the repository. Build command: `python3 build.py`. Output directory: `site`.
3. Before moving the ezupcranes.com DNS from Squarespace, copy the existing MX and TXT records so brad@ezupcranes.com keeps working.

## Forms
The quote and dealer forms run without a server today: the visitor gets a formatted copy to email. When the Cloudflare Worker is ready, add `data-endpoint="https://…"` to each `<form>` and requests are posted to it.

## Form delivery (functions/api/request.js)
Quote and dealer forms POST to `/api/request`, a Cloudflare Pages Function that emails the request (Resend) and adds the contact, a note and an ASAP next action in OnePageCRM.
Set these in Cloudflare Pages > ezupcranes-site > Settings > Variables and Secrets (Production):
- `RESEND_API_KEY` (secret), `NOTIFY_EMAIL` = brad@ezupcranes.com
- `ONEPAGE_USER_ID` (secret), `ONEPAGE_API_KEY` (secret) from OnePageCRM > Apps > API configuration
Then redeploy (Deployments > ... > Retry deployment). If a key is missing, the form falls back to showing the visitor a copy to email.
