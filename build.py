"""Build the EZUP Crane Systems static site.

Each file in src/ starts with a one-line header:
  <!-- title: Page title | desc: Meta description | nav: key -->
followed by the page's <main> content. This script wraps every page in the
shared head, header and footer and writes plain HTML to site/, which is the
folder that gets deployed (Cloudflare Pages, Netlify or any static host).

Run:  python3 build.py
"""
import pathlib, re

ROOT = pathlib.Path(__file__).parent
SRC, OUT = ROOT / "src", ROOT / "site"

NAV = [
    ("products", "products.html", "Products"),
    ("ezup", "ezup-cranes.html", "EZUP Cranes"),
    ("demag", "demag-kbk.html", "Demag &amp; KBK"),
    ("builders", "builders.html", "Builders &amp; Dealers"),
    ("about", "about.html", "About"),
]

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<link rel="icon" href="assets/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&amp;family=Barlow:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
"""

HEADER = """<div class="topbar"><div class="wrap">
<span>Authorized Demag and KBK dealer · Engineering by a licensed PE</span>
<span><strong>(276) 582-1970</strong> · Mon–Fri 8:00–4:00</span>
</div></div>
<header class="site-header"><div class="wrap">
<a class="brand" href="index.html" aria-label="EZUP Crane Systems home">
<img class="logo-l" src="assets/logo.svg" alt="EZUP Crane Systems" width="182" height="60">
<img class="logo-d" src="assets/logo-dark.svg" alt="EZUP Crane Systems" width="182" height="60">
</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
<nav class="nav" id="site-nav" aria-label="Main">
{links}
<a class="btn btn-primary" href="quote.html"{quote_current}>Request a Quote</a>
</nav>
</div></header>
"""

FOOTER = """<footer class="site-footer"><div class="wrap">
<div class="foot-grid">
<div class="foot-brand stack">
<img class="foot-logo-d" src="assets/logo-dark.svg" alt="EZUP Crane Systems" width="158" height="52">
<p>Workstation cranes, Demag KBK systems and engineered lifting equipment for plants and shops.</p>
</div>
<div>
<h3>Location</h3>
<p>627 Claypool Hill Mall Road<br>Cedar Bluff, VA 24609</p>
</div>
<div>
<h3>Hours</h3>
<p>Monday–Friday, 8:00 am–4:00 pm<br>Saturday–Sunday, closed</p>
</div>
<div>
<h3>Contact</h3>
<ul>
<li><a href="tel:+12765821970">(276) 582-1970</a></li>
<li><a href="mailto:brad@ezupcranes.com">brad@ezupcranes.com</a></li>
<li><a href="quote.html">Request a quote</a></li>
</ul>
</div>
<div>
<h3>Site</h3>
<ul>
{foot_links}
</ul>
</div>
</div>
<div class="legal">
<span>© <span id="year">2026</span> EZUP Crane Systems</span>
<span>Demag and KBK are trademarks of their owner. EZUP Crane Systems is an independent authorized dealer.</span>
</div>
</div></footer>
<script src="assets/site.js"></script>
</body>
</html>
"""


def build():
    pages = sorted(SRC.glob("*.html"))
    for page in pages:
        text = page.read_text(encoding="utf-8")
        m = re.match(r"<!--\s*title:(.*?)\|\s*desc:(.*?)\|\s*nav:(.*?)-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{page.name}: missing header comment")
        title, desc, key = (s.strip() for s in m.groups())
        body = text[m.end():]
        current = ' aria-current="page"'
        links = "\n".join(
            f'<a href="{href}"{current if k == key else ""}>{label}</a>'
            for k, href, label in NAV
        )
        foot_links = "\n".join(f'<li><a href="{href}">{label}</a></li>' for _, href, label in NAV)
        quote_current = ' aria-current="page"' if key == "quote" else ""
        html = (
            HEAD.format(title=title, desc=desc)
            + HEADER.format(links=links, quote_current=quote_current)
            + "<main id=\"main\">\n" + body.strip() + "\n</main>\n"
            + FOOTER.format(foot_links=foot_links)
        )
        (OUT / page.name).write_text(html, encoding="utf-8")
        print("built", page.name)


if __name__ == "__main__":
    build()
