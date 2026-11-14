"""Build the EZUP Crane Systems static site.

Each file in src/ starts with a one-line header:
  <!-- title: Page title | desc: Meta description | nav: key -->
followed by the page's <main> content. This script wraps every page in the
shared head, header and footer and writes plain HTML to site/, which is the
folder that gets deployed (Cloudflare Pages, Netlify or any static host).

Run:  python3 build.py
"""
import pathlib, re
from html import escape
from urllib.parse import quote as urlquote

import products

ROOT = pathlib.Path(__file__).parent
SRC, OUT = ROOT / "src", ROOT / "site"

NAV = [
    ("products", "products.html", "Products"),
    ("configure", "configure.html", "Price a Crane"),
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
{base}<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://ezupcranes.com/{canon}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:image" content="https://ezupcranes.com/assets/img/render/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/logo.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/barlow-condensed-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/barlow-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/style.css">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"LocalBusiness","name":"EZUP Crane Systems","url":"https://ezupcranes.com/","logo":"https://ezupcranes.com/assets/logo.svg","image":"https://ezupcranes.com/assets/img/render/og.jpg","telephone":"+1-276-582-1970","email":"brad@ezupcranes.com","address":{{"@type":"PostalAddress","streetAddress":"627 Claypool Hill Mall Road","addressLocality":"Cedar Bluff","addressRegion":"VA","postalCode":"24609","addressCountry":"US"}},"openingHours":"Mo-Fr 08:00-16:00","description":"Workstation cranes up to 3 tons and 60 ft spans, Demag KBK light crane systems and engineered lifting equipment."}}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
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


# ---------------------------------------------------------------- product imagery and product blocks
RENDER = "assets/img/render"


def render_img(stem, alt, cls="", sizes="(min-width: 1100px) 380px, (min-width: 700px) 50vw, 100vw", eager=False):
    """<img> for a 4:3 product rendering, with an 800 px and a 1600 px source."""
    c = f' class="{cls}"' if cls else ""
    load = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
    return (f'<img{c} src="{RENDER}/{stem}-800.webp" srcset="{RENDER}/{stem}-800.webp 800w, {RENDER}/{stem}-1600.webp 1600w" '
            f'sizes="{sizes}" alt="{escape(alt)}" width="1600" height="1200"{load}>')


def quote_href(item):
    if item["id"] in products.CONFIGURE:
        return f'configure.html?type={products.CONFIGURE[item["id"]]}'
    return f'quote.html?product={item["quote"]}&amp;item={urlquote(item["name"])}'


def product_cards(group_id):
    g = next(x for x in products.GROUPS if x["id"] == group_id)
    wide = len(g["items"]) == 4          # four-item groups are laid out two across, with larger pictures
    sizes = "(min-width: 760px) 580px, 100vw" if wide else "(min-width: 1100px) 380px, (min-width: 700px) 50vw, 100vw"
    out = []
    for it in g["items"]:
        bullets = "".join(f"<li>{escape(b)}</li>" for b in it.get("bullets", []))
        bullets = f"<ul>{bullets}</ul>" if bullets else ""
        links = []
        if it.get("quote"):
            links.append(f'<a class="textlink" href="{quote_href(it)}">{"Price it online" if it["id"] in products.CONFIGURE else "Request a quote"}<span class="sr"> for {escape(it["name"])}</span></a>')
        if it.get("link"):
            links.append(f'<a class="textlink" href="{it["link"][1]}">{escape(it["link"][0])}</a>')
        out.append(f'<article class="prod" id="{it["id"]}">{render_img(it["img"], it["alt"], "prod-img", sizes)}'
                   f'<h3>{escape(it["name"])}</h3><p>{escape(it["text"])}</p>{bullets}'
                   f'<p class="prod-links">{" ".join(links)}</p></article>')
    return "\n".join(out)


def lineup():
    """Home-page explorer: a list of product names (tabs on wide screens) and one panel per product."""
    tabs, panels = [], []
    n = 0
    for g in products.GROUPS:
        btns = []
        for it in g["items"]:
            sel = "true" if n == 0 else "false"
            btns.append(f'<button type="button" id="lu-tab-{it["id"]}" data-lu="{it["id"]}" aria-selected="{sel}">{escape(it["name"])}</button>')
            links = []
            if it.get("quote"):
                links.append(f'<a class="btn btn-primary" href="{quote_href(it)}">{"Price it online" if it["id"] in products.CONFIGURE else "Request a quote"}<span class="sr"> for {escape(it["name"])}</span></a>')
            if it.get("link"):
                cls = "textlink" if it.get("quote") else "btn btn-primary"
                links.append(f'<a class="{cls}" href="{it["link"][1]}">{escape(it["link"][0])}</a>')
            else:
                links.append(f'<a class="textlink" href="products.html#{it["id"]}">See it in the product line</a>')
            active = " is-active" if n == 0 else ""
            panels.append(
                f'<article class="lu{active}" id="lu-{it["id"]}" data-lu-panel="{it["id"]}">'
                f'{render_img(it["img"], it["alt"], sizes="(min-width: 960px) 640px, 84vw")}'
                f'<div class="lu-text"><span class="lu-fam">{escape(g["family"])}</span><h3>{escape(it["name"])}</h3>'
                f'<p>{escape(it["text"])}</p><span class="lu-range">{escape(it["fact"])}</span>'
                f'<div class="btn-row">{"".join(links)}</div></div></article>')
            n += 1
        tabs.append(f'<div class="lineup-group"><h3>{escape(g["family"])}</h3>{"".join(btns)}</div>')
    return ('<div class="lineup-body" data-lineup>\n<div class="lineup-list" aria-label="Product line">' + "".join(tabs) + '</div>\n'
            '<div class="lineup-view">\n' + "\n".join(panels) + '\n</div>\n</div>')


def expand(body):
    body = body.replace("<!-- lineup -->", lineup())
    body = re.sub(r"<!-- products:(\w+) -->", lambda m: product_cards(m.group(1)), body)

    def rimg(m):
        parts = [x.strip() for x in m.group(1).split("|")]
        stem, alt = parts[0], parts[1]
        cls = parts[2] if len(parts) > 2 else ""
        kw = {}
        if len(parts) > 3 and parts[3]:
            kw["sizes"] = parts[3]
        if len(parts) > 4 and parts[4] == "eager":
            kw["eager"] = True
        return render_img(stem, alt, cls, **kw)
    return re.sub(r"\{\{render:(.*?)\}\}", rimg, body)


def build():
    pages = sorted(SRC.glob("*.html"))
    for page in pages:
        text = page.read_text(encoding="utf-8")
        m = re.match(r"<!--\s*title:(.*?)\|\s*desc:(.*?)\|\s*nav:(.*?)-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{page.name}: missing header comment")
        title, desc, key = (s.strip() for s in m.groups())
        body = expand(text[m.end():])
        current = ' aria-current="page"'
        links = "\n".join(
            f'<a href="{href}"{current if k == key else ""}>{label}</a>'
            for k, href, label in NAV
        )
        foot_links = "\n".join(f'<li><a href="{href}">{label}</a></li>' for _, href, label in NAV)
        quote_current = ' aria-current="page"' if key == "quote" else ""
        html = (
            HEAD.format(title=title, desc=desc, canon="" if page.name == "index.html" else page.name,
                        base='<base href="/">\n' if page.name == "404.html" else "")
            + HEADER.format(links=links, quote_current=quote_current)
            + "<main id=\"main\">\n" + body.strip() + "\n</main>\n"
            + FOOTER.format(foot_links=foot_links)
        )
        (OUT / page.name).write_text(html, encoding="utf-8")
        print("built", page.name)
    urls = "".join(f"<url><loc>https://ezupcranes.com/{'' if p.name == 'index.html' else p.name}</loc></url>"
                   for p in pages if p.name != "404.html")
    (OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n', encoding="utf-8")


if __name__ == "__main__":
    build()
