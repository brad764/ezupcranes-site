"""Emit the annotated hero figure (general-arrangement view) from a render's marks JSON."""
import json, sys
mk = json.load(open(sys.argv[1]))
P = {k: (v[0] * 100, v[1] * 100) for k, v in mk.items()}          # percent of width / height
VB = (1000, 700)


def px(p):
    return f'{p[0] * VB[0] / 100:.1f} {p[1] * VB[1] / 100:.1f}'


def off(p, dx, dy):
    return (p[0] + dx, p[1] + dy)


balloons = [  # (key number, feature, balloon offset in %)
    ('1', 'trolley', (0, -8.0)), ('2', 'control', (-5.0, -13.5)), ('3', 'drive', (4.2, 12.5)),
    ('4', 'cbar', (3.0, 12.0)), ('5', 'hoist', (7.5, 9.0)), ('6', 'base', (-10.5, -2.5)),
]
lines = []
a, b = P['span_a'], P['span_b']
lines.append(f'<path d="M{px(a)} L{px(b)}"/>')
for k in ('a', 'b'):
    lines.append(f'<path class="ext" d="M{px(P["ext_" + k + "0"])} L{px(P["ext_" + k + "1"])}"/>')
    c = P['span_' + k]
    lines.append(f'<path class="tick" d="M{px(off(c, -0.9, 1.3))} L{px(off(c, 0.9, -1.3))}"/>')
html = []
for n, feat, (dx, dy) in balloons:
    f = P[feat]
    bpos = off(f, dx, dy)
    lines.append(f'<path d="M{px(bpos)} L{px(f)}"/>')
    lines.append(f'<circle cx="{f[0] * 10:.1f}" cy="{f[1] * 7:.1f}" r="4"/>')
    html.append(f'<span class="balloon" data-key="{n}" style="left:{bpos[0]:.2f}%;top:{bpos[1]:.2f}%" aria-hidden="true">{n}</span>')
load = P['load']
cap = off(load, 20.5, -1.0)
lines.append(f'<path d="M{px(off(load, 7.5, 0))} L{px(off(cap, -8.5, 0))}"/>')
lines.append(f'<circle cx="{(load[0] + 7.5) * 10:.1f}" cy="{load[1] * 7:.1f}" r="4"/>')
mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
out = f'''<figure class="ga">
<div class="ga-stage">
<img src="assets/img/render/ezup-crane-cutout-1000.webp" srcset="assets/img/render/ezup-crane-cutout-1000.webp 1000w, assets/img/render/ezup-crane-cutout-2000.webp 2000w" sizes="(min-width: 980px) 780px, 100vw" alt="Rendering of an EZUP 3 ton double-girder bridge crane on a six-column free-standing runway, lifting a wooden crate. Numbered callouts mark the trolley, control panel, end truck drive, conductor bar, hoist and column base." width="2000" height="1400" fetchpriority="high">
<svg class="ga-lines" viewBox="0 0 {VB[0]} {VB[1]}" preserveAspectRatio="none" aria-hidden="true">
{chr(10).join(lines)}
</svg>
<span class="dim" style="left:{mid[0]:.2f}%;top:{mid[1]:.2f}%" aria-hidden="true">Bridge spans to 60 ft</span>
<span class="dim" style="left:{cap[0]:.2f}%;top:{cap[1]:.2f}%" aria-hidden="true">Capacity to 3 tons</span>
{chr(10).join(html)}
</div>
<figcaption>Rendering: EZUP Industrial crane, 3 ton, on a free-standing runway</figcaption>
</figure>'''
print(out)
