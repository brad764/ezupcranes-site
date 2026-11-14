// Dimensioned general-arrangement drawings for the configurator and the printed quote.
// draw(design) -> { views: [{title, svg}], scaleNote }
// Pure string output: works in the browser and on the server. Drawings are schematic and
// dimensioned in feet and inches; member outlines are scaled from the selected sections.
import { ftIn } from "./craneDesign.js";

const VW = 600, VH = 430;
const STYLE = `<style>
.ln{stroke:var(--d-ink,#1C1E21);stroke-width:1.4;fill:none;vector-effect:non-scaling-stroke}
.st{stroke:var(--d-ink,#1C1E21);stroke-width:1.2;fill:var(--d-steel,#B8BCC2);vector-effect:non-scaling-stroke}
.cr{stroke:var(--d-ink,#1C1E21);stroke-width:1.2;fill:var(--d-crane,#F2C200);vector-effect:non-scaling-stroke}
.hz{stroke:var(--d-ink,#1C1E21);stroke-width:1.2;fill:var(--d-hoist,#C93A3A);vector-effect:non-scaling-stroke}
.fl{stroke:var(--d-ink,#1C1E21);stroke-width:2;vector-effect:non-scaling-stroke}
.ht{stroke:var(--d-soft,#8A8E95);stroke-width:1;vector-effect:non-scaling-stroke}
.cv{stroke:var(--d-soft,#8A8E95);stroke-width:1.2;fill:none;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}
.dm{stroke:var(--d-dim,#1F4E8C);stroke-width:1;fill:none;vector-effect:non-scaling-stroke}
.dt{fill:var(--d-dim,#1F4E8C);font:500 16px "IBM Plex Mono",ui-monospace,Consolas,monospace}
.lb{fill:var(--d-ink,#1C1E21);font:600 15px "Barlow",Arial,sans-serif}
.tt{fill:var(--d-ink,#1C1E21);font:700 18px "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.06em}
.bg{fill:var(--d-paper,#FFFFFF)}
</style>`;

const f1 = n => Math.round(n * 10) / 10;

// A view maps a world box (feet) into the drawing area with room for dimensions.
function view(x0, y0, x1, y1, pad = { l: 56, r: 36, t: 40, b: 58 }) {
  const w = VW - pad.l - pad.r, h = VH - pad.t - pad.b - 22;
  const s = Math.min(w / Math.max(x1 - x0, 1e-6), h / Math.max(y1 - y0, 1e-6));
  const ox = pad.l + (w - (x1 - x0) * s) / 2, oy = pad.t + 22 + (h - (y1 - y0) * s) / 2;
  // world y is up; screen y is down
  const X = x => f1(ox + (x - x0) * s), Y = y => f1(oy + (y1 - y) * s);
  return { s, X, Y, L: v => f1(v * s), parts: [] };
}

function svg(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${title}">${STYLE}<rect class="bg" width="${VW}" height="${VH}"/>${body}<text class="tt" x="16" y="26">${title}</text></svg>`;
}

const line = (x1, y1, x2, y2, c = "ln") => `<line class="${c}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const rect = (x, y, w, h, c) => `<rect class="${c}" x="${f1(Math.min(x, x + w))}" y="${f1(Math.min(y, y + h))}" width="${f1(Math.max(Math.abs(w), 1.5))}" height="${f1(Math.max(Math.abs(h), 1.5))}"/>`;
const text = (x, y, t, c = "lb", anchor = "middle") => `<text class="${c}" x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}">${t}</text>`;

// Dimension between two screen points, offset perpendicular by `off` px, with 45° ticks.
function dim(x1, y1, x2, y2, label, off) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const a1 = [x1 + nx * off, y1 + ny * off], a2 = [x2 + nx * off, y2 + ny * off];
  const ext = (p, a) => line(f1(p[0] + nx * Math.sign(off) * 3), f1(p[1] + ny * Math.sign(off) * 3), f1(a[0] + nx * Math.sign(off) * 6), f1(a[1] + ny * Math.sign(off) * 6), "dm");
  const tick = a => line(f1(a[0] - 5), f1(a[1] + 5), f1(a[0] + 5), f1(a[1] - 5), "dm");
  const mx = (a1[0] + a2[0]) / 2, my = (a1[1] + a2[1]) / 2;
  const vertical = Math.abs(dx) < Math.abs(dy);
  const tw = label.length * 9.7 + 10;
  const lbl = vertical
    ? `<g transform="translate(${f1(mx)},${f1(my)}) rotate(-90)"><rect class="bg" x="${f1(-tw / 2)}" y="-11" width="${f1(tw)}" height="21"/>${text(0, 5.5, label, "dt")}</g>`
    : `<rect class="bg" x="${f1(mx - tw / 2)}" y="${f1(my - 11)}" width="${f1(tw)}" height="21"/>${text(mx, my + 5.5, label, "dt")}`;
  return ext([x1, y1], a1) + ext([x2, y2], a2) + line(f1(a1[0]), f1(a1[1]), f1(a2[0]), f1(a2[1]), "dm") + tick(a1) + tick(a2) + lbl;
}

function floor(v, xa, xb) {
  let out = line(v.X(xa), v.Y(0), v.X(xb), v.Y(0), "fl");
  for (let x = xa; x < xb; x += (xb - xa) / 24) out += line(v.X(x), v.Y(0) + 1, f1(v.X(x) - 7), f1(v.Y(0) + 8), "ht");
  return out;
}

function hoistElev(v, x, yTop, hookY, scale = 1) {
  // trolley/hoist body, chain, hook block, hook
  const bw = 0.9 * scale, bh = 1.0 * scale;
  let o = rect(v.X(x - bw / 2), v.Y(yTop), v.L(bw), v.L(bh), "hz");
  o += line(v.X(x), v.Y(yTop - bh), v.X(x), v.Y(hookY + 0.35), "ln");
  o += rect(v.X(x - 0.17), v.Y(hookY + 0.55), v.L(0.34), v.L(0.3), "cr");
  const hx = v.X(x), hy = v.Y(hookY + 0.2), r = Math.max(4, v.L(0.2));
  o += `<path class="ln" d="M${hx} ${hy} v${f1(r * 0.6)} a${f1(r)} ${f1(r)} 0 1 1 ${f1(-r)} ${f1(r)}"/>`;
  return o;
}

function ibeamSection(v, x, yTop, d, bf) {
  // small I-section seen end-on; d, bf in inches
  const D = d / 12, B = bf / 12, t = Math.max(D * 0.09, 0.04);
  return rect(v.X(x - B / 2), v.Y(yTop), v.L(B), v.L(t), "st") + rect(v.X(x - t / 3), v.Y(yTop - t), v.L(t * 0.66), v.L(D - 2 * t), "st") + rect(v.X(x - B / 2), v.Y(yTop - D + t), v.L(B), v.L(t), "st");
}

// ---------------------------------------------------------------- bridge cranes
function bridgeViews(d) {
  const g = d.geometry, S = g.span, L = g.length;
  const views = [];
  // PLAN: runway along x, span along y
  {
    const v = view(-1, -1.2, L + 1, S + 1.2);
    let o = "";
    const sp = g.spacingFt || L / (g.bays || 1);
    const free = g.support === "free";
    for (const y of [0, S]) {
      o += rect(v.X(0), v.Y(y + 0.35), v.L(L), v.L(0.7), "st");
      for (let i = 0; i <= (g.bays || 1); i++) {
        const x = i * sp;
        if (free) o += rect(v.X(x - 0.45), v.Y(y + 0.45), v.L(0.9), v.L(0.9), "ln");
        else o += `<circle class="ln" cx="${v.X(x)}" cy="${v.Y(y)}" r="4"/>`;
      }
    }
    const xb = Math.min(L * 0.32, L - 3);
    const gs = (g.girderCtrsIn || 30) / 12;
    for (const e of [-1, 1]) o += rect(v.X(xb + e * gs / 2 - 0.2), v.Y(S + 0.6), v.L(0.4), v.L(S + 1.2), "cr");
    for (const y of [0, S]) o += rect(v.X(xb - 3), v.Y(y + 0.3), v.L(6), v.L(0.6), "cr");
    const yt = S * 0.42;
    o += rect(v.X(xb - gs / 2 - 0.4), v.Y(yt + 1.4), v.L(gs + 0.8), v.L(2.8), "hz");
    o += text(v.X(xb + gs / 2 + 1.0), v.Y(yt) + 4, "TROLLEY + HOIST", "lb", "start");
    o += text(v.X(L / 2), v.Y(S) - 10, "RUNWAY", "lb");
    o += dim(v.X(0), v.Y(-0.6), v.X(L), v.Y(-0.6), `${ftIn(L)} RUNWAY`, 26);
    o += dim(v.X(0), v.Y(S), v.X(0), v.Y(0), `${ftIn(S)} SPAN`, -26);
    if ((g.bays || 1) > 1) o += dim(v.X(L - sp), v.Y(S + 0.6), v.X(L), v.Y(S + 0.6), ftIn(sp), -18);
    views.push({ title: "PLAN", svg: svg("PLAN", o) });
  }
  // ELEVATION: looking along the runway
  {
    const H = g.underBridgeIn / 12;
    const top = H + g.girder.H / 12 + 2.2;
    const v = view(-S * 0.12 - 1.5, -0.3, S * 1.12 + 1.5, top + 0.6);
    let o = floor(v, -S * 0.1 - 1, S * 1.1 + 1);
    const tr = g.topRunwayIn / 12, rd = g.runway.d / 12;
    for (const x of [0, S]) {
      if (g.support === "free") {
        const cb = (g.column ? g.column.B : 6) / 12;
        o += rect(v.X(x - cb / 2), v.Y(tr - rd), v.L(cb), v.L(tr - rd), "st");
        const bp = (g.column ? g.column.basePlate : 14) / 12;
        o += rect(v.X(x - bp / 2), v.Y(0.08), v.L(bp), v.L(0.08), "st");
      } else {
        o += rect(v.X(x - 1.2), v.Y(top), v.L(2.4), v.L(0.6), "st");
        o += line(v.X(x), v.Y(top - 0.6), v.X(x), v.Y(tr), "ln");
        o += text(v.X(x), v.Y(top) - 6, "BLDG STEEL", "lb");
      }
      o += ibeamSection(v, x, tr, g.runway.d, g.runway.bf);
    }
    const et = g.etTube / 12;
    for (const x of [0, S]) o += rect(v.X(x - 0.3), v.Y(H + et), v.L(0.6), v.L(et), "cr");
    const gh = g.girder.H / 12;
    o += rect(v.X(-0.3), v.Y(H + gh), v.L(S + 0.6), v.L(gh), "cr");
    const xt = S * 0.42;
    o += rect(v.X(xt - 0.8), v.Y(H + gh + 0.7), v.L(1.6), v.L(0.6), "hz");
    o += line(v.X(xt), v.Y(H + gh + 0.1), v.X(xt), v.Y(H - 0.4), "ln");
    o += hoistElev(v, xt, H - 0.4, g.hookIn / 12, 1.2);
    o += dim(v.X(-0.3), v.Y(H + gh + 1.2), v.X(S + 0.3), v.Y(H + gh + 1.2), `${ftIn(S)} SPAN`, -14);
    o += dim(v.X(-S * 0.08 - 0.6), v.Y(H), v.X(-S * 0.08 - 0.6), v.Y(0), `${ftIn(H)} UNDER BRIDGE`, 0);
    o += line(v.X(-S * 0.08 - 0.9), v.Y(H), v.X(-0.3), v.Y(H), "dm");
    o += dim(v.X(S * 1.08 + 0.6), v.Y(g.hookIn / 12), v.X(S * 1.08 + 0.6), v.Y(0), `HOOK ≈ ${ftIn(g.hookIn / 12)}`, 0);
    o += line(v.X(xt + 0.3), v.Y(g.hookIn / 12), v.X(S * 1.08 + 0.9), v.Y(g.hookIn / 12), "dm");
    views.push({ title: "END ELEVATION", svg: svg("END ELEVATION", o) });
  }
  return views;
}

// ---------------------------------------------------------------- jib
function jibViews(d) {
  const g = d.geometry, R = g.reach, H = g.underBoomIn / 12;
  const mastOD = g.mast.OD / 12, mastH = g.mast.hIn / 12, bd = g.boom.d / 12;
  const views = [];
  {
    const v = view(-2.5, -0.3, R + 2, mastH + 1.4);
    let o = floor(v, -2.5, R + 2);
    const bp = g.basePlate / 12;
    o += rect(v.X(-bp / 2), v.Y(0.12), v.L(bp), v.L(0.12), "st");
    o += rect(v.X(-mastOD / 2), v.Y(mastH), v.L(mastOD), v.L(mastH - 0.12), "cr");
    o += rect(v.X(-mastOD / 2 - 0.15), v.Y(mastH + 0.35), v.L(mastOD + 0.3), v.L(0.5), "cr");
    o += rect(v.X(mastOD / 2), v.Y(H + bd), v.L(R - mastOD / 2), v.L(bd), "cr");
    const bx = Math.min(R * 0.42, 3.5);
    o += `<path class="cr" d="M${v.X(mastOD / 2)} ${v.Y(H)} L${v.X(mastOD / 2 + bx)} ${v.Y(H)} L${v.X(mastOD / 2)} ${v.Y(H - bx * 0.7)} Z"/>`;
    const xt = R * 0.72;
    o += rect(v.X(xt - 0.35), v.Y(H), v.L(0.7), v.L(0.3), "hz");
    o += hoistElev(v, xt, H - 0.3, g.hookIn / 12, 0.9);
    o += dim(v.X(0), v.Y(mastH + 0.5), v.X(R), v.Y(mastH + 0.5), `${ftIn(R)} REACH`, -16);
    o += dim(v.X(-1.6), v.Y(H), v.X(-1.6), v.Y(0), `${ftIn(H)} UNDER BOOM`, 0);
    o += line(v.X(-1.9), v.Y(H), v.X(-mastOD / 2), v.Y(H), "dm");
    o += dim(v.X(R + 1.2), v.Y(g.hookIn / 12), v.X(R + 1.2), v.Y(0), `HOOK ≈ ${ftIn(g.hookIn / 12)}`, 0);
    o += line(v.X(xt + 0.2), v.Y(g.hookIn / 12), v.X(R + 1.5), v.Y(g.hookIn / 12), "dm");
    o += text(v.X(0), v.Y(0) + 26, "FOUNDATION BY EZUP ENGINEERING", "lb");
    views.push({ title: "ELEVATION", svg: svg("ELEVATION", o) });
  }
  {
    const v = view(-R - 1, -R - 1, R + 1, R + 1);
    let o = `<circle class="cv" cx="${v.X(0)}" cy="${v.Y(0)}" r="${v.L(R)}"/>`;
    o += `<circle class="st" cx="${v.X(0)}" cy="${v.Y(0)}" r="${Math.max(4, v.L(mastOD / 2))}"/>`;
    o += rect(v.X(0), v.Y(0.3), v.L(R), v.L(0.6), "cr");
    o += rect(v.X(R * 0.72 - 0.35), v.Y(0.45), v.L(0.7), v.L(0.9), "hz");
    const a = Math.PI * 0.2;
    o += `<path class="dm" d="M${v.X(R * 0.55 * Math.cos(a))} ${v.Y(R * 0.55 * Math.sin(a))} A${v.L(R * 0.55)} ${v.L(R * 0.55)} 0 0 0 ${v.X(R * 0.55 * Math.cos(-a))} ${v.Y(R * 0.55 * Math.sin(-a))}"/>`;
    o += text(v.X(R * 0.62), v.Y(R * 0.45), "360° ROTATION", "lb", "start");
    o += dim(v.X(0), v.Y(-R * 0.15), v.X(-R * Math.cos(0.5)), v.Y(-R * 0.15 - R * Math.sin(0.5)), `R ${ftIn(R)}`, 0);
    o += text(v.X(0), v.Y(-R) + 22, "HOOK COVERAGE", "lb");
    views.push({ title: "PLAN", svg: svg("PLAN", o) });
  }
  return views;
}

// ---------------------------------------------------------------- gantry
function gantryViews(d) {
  const g = d.geometry, S = g.span, H = g.underBeamIn / 12, bd = g.beam.d / 12, sp = g.spreadIn / 12, ch = g.casterIn / 12;
  const lb = g.leg.B / 12;
  const views = [];
  {
    const v = view(-2.4, -0.3, S + 2.4, H + bd + 1.6);
    let o = floor(v, -2.4, S + 2.4);
    for (const x of [0, S]) {
      o += rect(v.X(x - lb / 2), v.Y(H), v.L(lb), v.L(H - ch - 0.3), "cr");
      o += rect(v.X(x - 0.6), v.Y(ch + 0.3), v.L(1.2), v.L(0.3), "cr");
      if (ch) o += `<circle class="st" cx="${v.X(x)}" cy="${v.Y(ch / 2)}" r="${Math.max(3, v.L(ch / 2))}"/>`;
    }
    o += rect(v.X(-1), v.Y(H + bd), v.L(S + 2), v.L(bd), "cr");
    for (const [x, s] of [[0, 1], [S, -1]]) o += `<line class="ln" x1="${v.X(x)}" y1="${v.Y(H - 2.2)}" x2="${v.X(x + s * 2.2)}" y2="${v.Y(H)}"/>`;
    const xt = S * 0.45;
    o += rect(v.X(xt - 0.4), v.Y(H), v.L(0.8), v.L(0.3), "hz");
    o += hoistElev(v, xt, H - 0.3, g.hookIn / 12, 0.9);
    o += dim(v.X(0), v.Y(H + bd + 0.8), v.X(S), v.Y(H + bd + 0.8), `${ftIn(S)} SPAN`, -12);
    o += dim(v.X(-1.7), v.Y(H), v.X(-1.7), v.Y(0), `${ftIn(H)} UNDER BEAM`, 0);
    o += line(v.X(-2.0), v.Y(H), v.X(-lb), v.Y(H), "dm");
    views.push({ title: "FRONT ELEVATION", svg: svg("FRONT ELEVATION", o) });
  }
  {
    const v = view(-sp / 2 - 2.6, -0.3, sp / 2 + 2.6, H + bd + 1.6);
    let o = floor(v, -sp / 2 - 2.6, sp / 2 + 2.6);
    const yb = ch + 0.3;
    o += `<path class="ln" style="stroke-width:${Math.max(3, v.L(lb))}px;stroke:var(--d-crane,#F2C200)" d="M${v.X(-sp / 2)} ${v.Y(yb)} L${v.X(0)} ${v.Y(H)} L${v.X(sp / 2)} ${v.Y(yb)}"/>`;
    o += `<path class="ln" d="M${v.X(-sp / 2)} ${v.Y(yb)} L${v.X(0)} ${v.Y(H)} L${v.X(sp / 2)} ${v.Y(yb)}"/>`;
    o += rect(v.X(-sp / 2 - 0.5), v.Y(yb), v.L(sp + 1), v.L(0.3), "cr");
    const yc = H * 0.45;
    o += line(v.X(-sp / 2 * (1 - yc / H)), v.Y(yc), v.X(sp / 2 * (1 - yc / H)), v.Y(yc), "ln");
    if (ch) for (const x of [-sp / 2, sp / 2]) o += `<circle class="st" cx="${v.X(x)}" cy="${v.Y(ch / 2)}" r="${Math.max(3, v.L(ch / 2))}"/>`;
    o += ibeamSection(v, 0, H + bd, g.beam.d, g.beam.bf);
    o += dim(v.X(-sp / 2), v.Y(0), v.X(sp / 2), v.Y(0), `${ftIn(sp)} BASE`, 30);
    o += dim(v.X(sp / 2 + 1.6), v.Y(H), v.X(sp / 2 + 1.6), v.Y(0), `${ftIn(H)}`, 0);
    o += line(v.X(0.4), v.Y(H), v.X(sp / 2 + 1.9), v.Y(H), "dm");
    o += text(v.X(0), v.Y(0) + 46, ch ? "LOCKING SWIVEL CASTERS" : "BASE PLATES, ANCHORED", "lb");
    views.push({ title: "END ELEVATION", svg: svg("END ELEVATION", o) });
  }
  return views;
}

// ---------------------------------------------------------------- monorail
function monorailViews(d) {
  const g = d.geometry, L = g.length, H = g.underBeamIn / 12, bd = g.beam.d / 12, sp = g.spacingFt;
  const views = [];
  const free = g.support === "free";
  const fw = free && g.frame ? g.frame.widthIn / 12 : 0;
  {
    const half = Math.max(fw / 2, 1.5) + 1;
    const v = view(-1.5, -half - 0.8, L + 1.5, half + 0.8);
    let o = rect(v.X(0), v.Y(0.3), v.L(L), v.L(0.6), "cr");
    for (let i = 0; i <= g.bays; i++) {
      const x = i * sp;
      if (free) {
        o += rect(v.X(x - 0.25), v.Y(fw / 2), v.L(0.5), v.L(fw), "st");
        for (const y of [-fw / 2, fw / 2]) o += rect(v.X(x - 0.35), v.Y(y + 0.35), v.L(0.7), v.L(0.7), "ln");
      } else o += `<circle class="ln" cx="${v.X(x)}" cy="${v.Y(0)}" r="4"/>`;
    }
    o += rect(v.X(L * 0.3 - 0.5), v.Y(0.6), v.L(1), v.L(1.2), "hz");
    o += dim(v.X(0), v.Y(-half), v.X(L), v.Y(-half), `${ftIn(L)} MONORAIL`, 20);
    if (g.bays > 1) o += dim(v.X(0), v.Y(half), v.X(sp), v.Y(half), ftIn(sp), -16);
    if (free) o += dim(v.X(L + 1.0), v.Y(fw / 2), v.X(L + 1.0), v.Y(-fw / 2), ftIn(fw), 0);
    views.push({ title: "PLAN", svg: svg("PLAN", o) });
  }
  {
    const v = view(-1.5, -0.3, L + 1.5, H + bd + 2.2);
    let o = floor(v, -1.5, L + 1.5);
    for (let i = 0; i <= g.bays; i++) {
      const x = i * sp;
      if (free) {
        const cb = g.frame.col.B / 12;
        o += rect(v.X(x - cb / 2), v.Y(H + bd), v.L(cb), v.L(H + bd), "st");
        o += rect(v.X(x - cb), v.Y(H + bd + g.frame.header.d / 12), v.L(cb * 2), v.L(g.frame.header.d / 12), "st");
      } else {
        o += line(v.X(x), v.Y(H + bd + 1.4), v.X(x), v.Y(H + bd), "ln");
      }
    }
    if (!free) o += rect(v.X(-1), v.Y(H + bd + 1.9), v.L(L + 2), v.L(0.5), "st") + text(v.X(L / 2), v.Y(H + bd + 1.9) - 6, "BUILDING STEEL", "lb");
    o += rect(v.X(0), v.Y(H + bd), v.L(L), v.L(bd), "cr");
    const xt = L * 0.3;
    o += rect(v.X(xt - 0.4), v.Y(H), v.L(0.8), v.L(0.3), "hz");
    o += hoistElev(v, xt, H - 0.3, g.hookIn / 12, 0.9);
    o += dim(v.X(-0.9), v.Y(H), v.X(-0.9), v.Y(0), `${ftIn(H)} UNDER BEAM`, 0);
    o += dim(v.X(L + 0.9), v.Y(g.hookIn / 12), v.X(L + 0.9), v.Y(0), `HOOK ≈ ${ftIn(g.hookIn / 12)}`, 0);
    o += line(v.X(xt + 0.3), v.Y(g.hookIn / 12), v.X(L + 1.2), v.Y(g.hookIn / 12), "dm");
    views.push({ title: "SIDE ELEVATION", svg: svg("SIDE ELEVATION", o) });
  }
  return views;
}

function placeholder(d) {
  const o = text(VW / 2, VH / 2 - 8, "Custom design", "tt") + text(VW / 2, VH / 2 + 16, "EZUP engineering will draw this one for you.", "lb");
  return [{ title: "DRAWING", svg: svg("DRAWING", o) }];
}

export function draw(d) {
  if (!d || d.status !== "ok") return { views: placeholder(d) };
  const k = d.geometry.kind;
  const views = k === "bridge" ? bridgeViews(d) : k === "jib" ? jibViews(d) : k === "gantry" ? gantryViews(d) : monorailViews(d);
  return { views };
}
