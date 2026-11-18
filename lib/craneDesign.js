// EZUP crane design engine (shared by the website configurator and the server).
//
// design(inputs) -> {status, members, checks, geometry, quantities, scope, warnings, assumptions, ...}
//
// Preliminary sizing for budget quotations. Every system is reviewed by EZUP engineering before an
// order; the checks below pick members, they do not replace the final design.
//
// Method: AISC 360-16 ASD (flexure F2/F7/F8, compression E3, combined H1), steel Fy 50 ksi
// (W shapes A992, HSS A500 Gr C) and 35 ksi (pipe A53 Gr B). Vertical impact 15 % of the rated load.
// Crane lateral load 20 % of (rated load + hoist + trolley). Units inside: kips and inches.
import { W_SHAPES, HSS_SQUARE, PIPES } from "./shapes.js";

const E = 29000;
const FY = 50;
const FY_PIPE = 35;
const OMEGA_B = 1.67, OMEGA_C = 1.67, OMEGA_V = 1.67;
const IMPACT = 0.15;
const LATERAL = 0.20;

export const TYPES = {
  industrial: { name: "EZUP Industrial bridge crane", short: "EZUP Industrial", caps: [0.5, 1, 2, 3], span: [10, 60], length: [10, 200], height: [8, 30] },
  professional: { name: "EZUP Professional bridge crane", short: "EZUP Professional", caps: [0.25, 0.5, 1], span: [8, 30], length: [10, 100], height: [8, 20] },
  jib: { name: "Free-standing jib crane", short: "Jib crane", caps: [0.25, 0.5, 1, 2, 3], span: [8, 20], length: null, height: [8, 20] },
  gantry: { name: "Portable gantry crane", short: "Gantry crane", caps: [0.5, 1, 2, 3], span: [8, 30], length: null, height: [8, 16] },
  monorail: { name: "Monorail system", short: "Monorail", caps: [0.25, 0.5, 1, 2, 3], span: null, length: [10, 150], height: [8, 24] }
};

// Jib crane styles. The jib type uses the reach (span) and height ranges of the chosen style.
export const JIB_STYLES = {
  free: { name: "Free-standing jib crane", short: "Free-standing jib", span: [8, 20], height: [8, 20], rotation: 360 },
  mast: { name: "Mast-type jib crane", short: "Mast-type jib", span: [8, 20], height: [8, 24], rotation: 360 },
  wall: { name: "Wall cantilever jib crane", short: "Wall cantilever jib", span: [8, 20], height: [8, 24], rotation: 180 },
  rod: { name: "Wall tie-rod jib crane", short: "Wall tie-rod jib", span: [8, 30], height: [8, 24], rotation: 180 }
};

export const CAP_LABEL = { 0.25: "1/4 ton (500 lb)", 0.5: "1/2 ton (1,000 lb)", 1: "1 ton (2,000 lb)", 2: "2 ton (4,000 lb)", 3: "3 ton (6,000 lb)" };
export const CAP_SHORT = { 0.25: "1/4 ton", 0.5: "1/2 ton", 1: "1 ton", 2: "2 ton", 3: "3 ton" };

// Hoist weights (lb) and headroom from hook to suspension point (in), Demag DC series, typical.
const HOIST = {
  pro: { 0.25: [55, 17], 0.5: [70, 18], 1: [110, 21], 2: [150, 26], 3: [230, 30] },
  com: { 0.25: [45, 15], 0.5: [55, 16], 1: [90, 19] }
};
export const HOIST_MODEL = { pro: "Demag DC-Pro", com: "Demag DC-Com" };

const MAX_SUPPORT_SPACING_FT = 20;
// Underhung trolleys run on the bottom flange. Until the flange local-bending check is added, beams
// carrying a trolley need at least this flange thickness and width (in) for the capacity.
const UNDERHUNG_MIN = { 0.25: [0.25, 4], 0.5: [0.28, 4], 1: [0.33, 5], 2: [0.40, 5.5], 3: [0.45, 6] };
const trolleyBeam = cap => x => x.tf >= UNDERHUNG_MIN[cap][0] && x.bf >= UNDERHUNG_MIN[cap][1];

export const DEFAULTS = {
  type: "industrial", cap: 2, span: 30, length: 40, height: 14, support: "free",
  travel: "motorized", control: "radio", power: "480", install: "ezup", zip: "", mobility: "casters", cable: "festoon", jib: "free", bldg: "no"
};

// ---------------------------------------------------------------- input normalization
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (v === "" || v == null || !isFinite(Number(v)) ? d : Number(v));
const round = (v, n = 0) => Math.round(v * 10 ** n) / 10 ** n;

export function normalize(raw = {}) {
  const t = TYPES[raw.type] ? raw.type : DEFAULTS.type;
  const jibStyle = t === "jib" ? (JIB_STYLES[raw.jib] ? raw.jib : "free") : null;
  const T = jibStyle ? { ...TYPES.jib, ...JIB_STYLES[jibStyle] } : TYPES[t];
  const notes = [];
  let cap = num(raw.cap, DEFAULTS.cap);
  if (!T.caps.includes(cap)) {
    const fit = T.caps.find(c => c >= cap) ?? T.caps[T.caps.length - 1];
    if (raw.cap != null && raw.cap !== "") notes.push(`${T.short} capacities run ${CAP_SHORT[T.caps[0]]} to ${CAP_SHORT[T.caps[T.caps.length - 1]]}; set to ${CAP_SHORT[fit]}.`);
    cap = fit;
  }
  const inp = { type: t, jib: jibStyle, cap };
  const fit = (key, range, dflt, label) => {
    if (!range) return;
    const v = num(raw[key], dflt);
    const c = clamp(v, range[0], range[1]);
    if (c !== v) notes.push(`${label} is limited to ${range[0]}–${range[1]} ft for this crane; set to ${c} ft.`);
    inp[key] = round(c, 1);
  };
  fit("span", T.span, t === "jib" ? 14 : t === "gantry" ? 16 : DEFAULTS.span, t === "jib" ? "Boom reach" : "Span");
  fit("length", T.length, t === "monorail" ? 40 : DEFAULTS.length, t === "monorail" ? "Monorail length" : "Runway length");
  fit("height", T.height, t === "gantry" ? 12 : DEFAULTS.height, "Height under the beam");
  inp.support = t === "industrial" || t === "professional" || t === "monorail" ? (raw.support === "building" ? "building" : "free") : "free";
  inp.mobility = t === "gantry" ? (raw.mobility === "fixed" ? "fixed" : "casters") : null;
  // Jib and gantry hoist power: festoon on a C-track, or a tagline (cable trolleys on a tensioned wire rope).
  inp.cable = t === "jib" || t === "gantry" ? (raw.cable === "tagline" ? "tagline" : "festoon") : null;

  // Travel and control. The Industrial line is always motorized; Professional and the
  // underhung products can be push-pull.
  let travel = raw.travel === "push" ? "push" : "motorized";
  if (t === "industrial") travel = "motorized";
  if (t === "gantry" && inp.mobility === "casters" && travel === "motorized") travel = "motorized";
  inp.travel = travel;
  inp.control = raw.control === "pendant" ? "pendant" : "radio";
  inp.power = t === "professional" ? "120" : (["480", "230", "208"].includes(String(raw.power)) ? String(raw.power) : "480");
  if (t === "professional" && raw.power && String(raw.power) !== "120") notes.push("The Professional line runs on 120 V single phase.");
  inp.install = raw.install === "others" ? "others" : "ezup";
  inp.zip = String(raw.zip || "").replace(/\D/g, "").slice(0, 5);
  inp.bldg = raw.bldg === "yes" ? "yes" : "no";
  return { inp, notes };
}

// ---------------------------------------------------------------- AISC member strength (ASD, kip-in)
function wFlexure(s, LbIn, Cb = 1.0) {
  const Mp = FY * s.Zx;
  const Lp = 1.76 * s.ry * Math.sqrt(E / FY);
  const jc = s.J / (s.Sx * s.ho);
  const Lr = 1.95 * s.rts * (E / (0.7 * FY)) * Math.sqrt(jc + Math.sqrt(jc * jc + 6.76 * (0.7 * FY / E) ** 2));
  let Mn;
  if (LbIn <= Lp) Mn = Mp;
  else if (LbIn <= Lr) Mn = Math.min(Mp, Cb * (Mp - (Mp - 0.7 * FY * s.Sx) * (LbIn - Lp) / (Lr - Lp)));
  else {
    const r = LbIn / s.rts;
    const Fcr = Cb * Math.PI ** 2 * E / (r * r) * Math.sqrt(1 + 0.078 * jc * r * r);
    Mn = Math.min(Mp, Fcr * s.Sx);
  }
  return Mn / OMEGA_B;
}
function wShear(s) { return 0.6 * FY * s.d * s.tw / OMEGA_V; }

const HSS_LIM = { fp: 1.12 * Math.sqrt(E / FY), fr: 1.40 * Math.sqrt(E / FY), wp: 2.42 * Math.sqrt(E / FY), wr: 5.70 * Math.sqrt(E / FY) };
function hssSqFlexure(s) {
  const Mp = FY * s.Z;
  let Mn = Mp;
  if (s.bt > HSS_LIM.fp) Mn = Math.min(Mn, Mp - (Mp - FY * s.S) * (3.57 * s.bt * Math.sqrt(FY / E) - 4.0));
  return Mn / OMEGA_B;
}
function compression(A, r, KL, Fy = FY) {
  const sl = KL / r;
  const Fe = Math.PI ** 2 * E / (sl * sl);
  const Fcr = sl <= 4.71 * Math.sqrt(E / Fy) ? 0.658 ** (Fy / Fe) * Fy : 0.877 * Fe;
  return Fcr * A / OMEGA_C;
}
function pipeFlexure(s) {
  const lim = 0.07 * E / FY_PIPE;
  const Mn = s.Dt <= lim ? FY_PIPE * s.Z : (0.021 * E / s.Dt + FY_PIPE) * s.S;
  return Math.min(Mn, FY_PIPE * s.Z) / OMEGA_B;
}
function interaction(Pr, Pc, Mr, Mc) {
  if (Pc <= 0 || Mc <= 0) return 99;
  const p = Pr / Pc;
  return p >= 0.2 ? p + 8 / 9 * (Mr / Mc) : p / 2 + Mr / Mc;
}

// Moving-load cases. a = wheel spacing, L = span (in), P = load per wheel (kips).
function twoWheelMoment(P, a, L) {
  if (a >= 0.586 * L) return P * L / 4;
  return (2 * P / L) * (L / 2 - a / 4) ** 2;
}
function twoWheelDefl(P, a, L, I) {
  if (a >= L) return P * L ** 3 / (48 * E * I);
  const a1 = (L - a) / 2;
  return P * a1 * (3 * L * L - 4 * a1 * a1) / (24 * E * I);
}
function twoWheelReaction(P, a, L) { return P * (1 + Math.max(0, L - a) / L); }

// Pick the lightest section that passes every check. check(s) returns {ok, ratios:{...}}.
function pickLightest(list, check) {
  for (const s of list) {
    const r = check(s);
    if (r.ok) return { s, r };
  }
  return null;
}

// ---------------------------------------------------------------- shared pieces
function loads(inp, hoistLine, trolleyKind) {
  const lift = inp.cap * 2; // kips
  const [hoistLb, headroomIn] = HOIST[hoistLine][inp.cap];
  const hoist = hoistLb / 1000;
  let trolley;
  if (trolleyKind === "double") trolley = (inp.travel === "motorized" ? 350 : 200) / 1000;
  else trolley = (40 + 25 * inp.cap + (inp.travel === "motorized" ? 90 : 0)) / 1000;
  const live = lift + hoist + trolley;              // service, for deflection
  const vert = lift * (1 + IMPACT) + hoist + trolley; // strength
  const lat = LATERAL * (lift + hoist + trolley);
  return { lift, hoist, trolley, live, vert, lat, hoistLb, headroomIn };
}

function check(name, value, limit, unit, ok, ratio, detail) {
  return { name, value, limit, unit, ok, ratio: round(ratio, 2), detail };
}

const fmtIn = v => `${round(v, 2)} in`;
function ftIn(ft) {
  const t = Math.round(ft * 12);
  const f = Math.floor(t / 12), i = t - f * 12;
  return i ? `${f}'-${i}"` : `${f}'-0"`;
}
export { ftIn };

function basePlate(colB, heavy) {
  const size = Math.ceil(colB + 8);
  const t = colB <= 5 ? 0.75 : colB <= 6 ? 0.75 : colB <= 8 ? 1.0 : 1.25;
  const anchors = heavy || colB >= 8 ? 8 : 4;
  return { size, t, anchors, lb: size * size * t * 0.2836 };
}

// ---------------------------------------------------------------- bridge cranes (Industrial / Professional)
function bridge(inp) {
  const pro = inp.type === "professional";
  const line = pro ? "com" : "pro";
  const L = loads(inp, line, "double");
  const S = inp.span * 12, Lr = inp.length * 12;
  const gs = pro ? 24 : 30;                     // girder centres (in)
  const trolleyWb = pro ? 22 : 26;              // trolley wheelbase on each girder (in)
  const etTube = pro ? 5 : 6;                   // end truck tube (in)
  const etWb = pro ? 54 : 70;                   // end truck wheelbase (in)
  const approach = 24;                          // hook approach to runway centreline (in)
  const warnings = [], assumptions = [];
  const checks = [];

  // ---- bridge girders: two wide-flange beams; the trolley wheels run on the top flanges.
  // Girders are tied only at the end trucks, so the unbraced length is the full span.
  const wheelG = L.vert / 4, wheelGs = L.live / 4;
  const latWheelG = L.lat / 4;
  const girders = W_SHAPES.filter(x => x.d >= 6 && x.d <= 30 && x.bf >= (pro ? 4 : 5));
  const g = pickLightest(girders, x => {
    const w = x.w / 12000;                        // kips/in
    const M = twoWheelMoment(wheelG, trolleyWb, S) + w * S * S / 8;
    const Ma = wFlexure(x, S, 1.0);
    const My = twoWheelMoment(latWheelG, trolleyWb, S);
    const Stf = x.tf * x.bf * x.bf / 6;
    const ratio = M / Ma + My / (FY * Stf / OMEGA_B);
    const V = wheelG * (1 + (S - trolleyWb) / S) + w * S / 2;
    const vr = V / wShear(x);
    const d = twoWheelDefl(wheelGs, trolleyWb, S, x.Ix);
    const dr = d / (S / 600);
    return { ok: ratio <= 1 && vr <= 1 && dr <= 1, ratio, vr, d, dr, M, Ma };
  });
  if (!g) return outOfRange(inp, "Wide-flange bridge girders unbraced over this span are beyond our standard sections. We will engineer the bridge for you.");
  const G = g.s;
  checks.push(check("Bridge girder bending + lateral", `${round(g.r.ratio, 2)}`, "1.00", "", true, g.r.ratio, `${G.name}, M = ${round(g.r.M / 12, 1)} kip-ft`));
  checks.push(check("Bridge girder deflection", fmtIn(g.r.d), `L/600 = ${fmtIn(S / 600)}`, "in", true, g.r.dr, "Rated load, hoist and trolley"));

  // ---- bridge weight and runway wheel loads
  const etLb = (pro ? 180 : 260) * 2;            // two end trucks incl. wheel blocks and drives
  const bridgeLb = 2 * G.w * (inp.span + 1) + etLb + (inp.travel === "motorized" ? 120 : 0);
  const bridge = bridgeLb / 1000;
  const Rmax = L.vert * (S - approach) / S + bridge / 2;
  const Rmaxs = L.live * (S - approach) / S + bridge / 2;
  const Pw = Rmax / 2, Pws = Rmaxs / 2;
  const Hw = L.lat / 2 / 2;                      // lateral split to two runways, two wheels each

  // ---- runway beams
  const bays = Math.max(1, Math.ceil(inp.length / MAX_SUPPORT_SPACING_FT));
  const s = Lr / bays;                           // support spacing (in)
  const runwayList = W_SHAPES.filter(x => x.d >= 6 && x.d <= 24 && x.bf >= 4);
  const rw = pickLightest(runwayList, x => {
    const w = x.w / 12000;
    const M = twoWheelMoment(Pw, etWb, s) + w * s * s / 8;
    const Ma = wFlexure(x, s, 1.0);
    const Mlat = twoWheelMoment(Hw, etWb, s);
    const Stf = x.tf * x.bf * x.bf / 6;
    const ratio = M / Ma + Mlat / (FY * Stf / OMEGA_B);
    const V = twoWheelReaction(Pw, etWb, s) + w * s / 2;
    const vr = V / wShear(x);
    const d = twoWheelDefl(Pws, etWb, s, x.Ix);
    const dr = d / (s / 600);
    const dl = twoWheelDefl(Hw, etWb, s, x.Iy / 2);
    const dlr = dl / (s / 400);
    return { ok: ratio <= 1 && vr <= 1 && dr <= 1 && dlr <= 1, ratio, vr, d, dr, dl, dlr, M };
  });
  if (!rw) return outOfRange(inp, "The runway beams for this layout are beyond our standard sections. We will engineer the runway for you.");
  const R = rw.s;
  checks.push(check("Runway beam bending + top-flange lateral", `${round(rw.r.ratio, 2)}`, "1.00", "", true, rw.r.ratio, `${R.name} spanning ${ftIn(s / 12)}`));
  checks.push(check("Runway beam deflection", fmtIn(rw.r.d), `L/600 = ${fmtIn(s / 600)}`, "in", true, rw.r.dr, "Maximum wheel loads, no impact"));

  // ---- elevations
  const hUnder = inp.height * 12;                // clear under the bridge girders
  const topRunway = hUnder - etTube - 1.5;       // top of runway beam
  const hook = hUnder - L.headroomIn - 14;       // hoist hangs below girders on the trolley hanger
  const geometry = {
    kind: "bridge", span: inp.span, length: inp.length, bays, spacingFt: s / 12, girderCtrsIn: gs,
    girder: { H: G.d, B: G.bf, tf: G.tf }, runway: { d: R.d, bf: R.bf }, etTube, etWbIn: etWb, topRunwayIn: topRunway,
    underBridgeIn: hUnder, hookIn: hook, headroomIn: L.headroomIn, support: inp.support, motorized: inp.travel === "motorized"
  };

  const members = [
    { role: "Bridge girders", size: G.name.replace(/X/g, "x"), qty: 2, lengthFt: inp.span + 1, lb: 2 * G.w * (inp.span + 1), mat: "w" },
    { role: "Runway beams", size: R.name.replace(/X/g, "x"), qty: 2, lengthFt: inp.length + 1, lb: 2 * R.w * (inp.length + 1), mat: "w" }
  ];
  const qty = { steel_w: 0, steel_hss: 0, steel_pipe: 0, plate: 0, anchors: 0, hangers: 0 };
  qty.steel_w += members[0].lb + members[1].lb;
  let colInfo = null;

  if (inp.support === "free") {
    // ---- columns: no knee braces. Each column is a cantilever from its base plate in both directions:
    // across the bay for the crane lateral load, along the runway for the longitudinal (tractive)
    // force of 10% of the wheel loads, which the runway beam shares among all columns on its line.
    const hCol = topRunway - R.d;
    const Pcol = twoWheelReaction(Pw, etWb, s) + R.w / 12000 * s;
    const Hcol = twoWheelReaction(Hw, etWb, s);
    const nLine = bays + 1;
    const Flong = 0.10 * 2 * Pws / nLine;
    const colList = HSS_SQUARE.filter(x => x.bt <= 1.40 * Math.sqrt(E / FY) && x.B >= 4);
    const c = pickLightest(colList, x => {
      const Pc = compression(x.A, x.r, 2.1 * hCol);
      const Mc = hssSqFlexure(x);
      const p = Pcol / Pc, mx = Hcol * hCol / Mc, my = Flong * hCol / Mc;
      const ratio = p >= 0.2 ? p + 8 / 9 * (mx + my) : p / 2 + mx + my;
      const drift = Hcol * hCol ** 3 / (3 * E * x.I);
      const driftL = Flong * hCol ** 3 / (3 * E * x.I);
      const dr = Math.max(drift, driftL) / (hCol / 240);
      return { ok: ratio <= 1 && dr <= 1, ratio, drift, driftL, dr };
    });
    if (!c) return outOfRange(inp, "Free-standing columns this tall need bracing or tie-backs. We will engineer the support structure for you.");
    const C = c.s;
    const cols = 2 * (bays + 1);
    const bp = basePlate(C.B, inp.cap >= 2 && inp.span >= 40);
    checks.push(check("Column axial + biaxial bending (cantilever, no knee braces)", `${round(c.r.ratio, 2)}`, "1.00", "", true, c.r.ratio, `${C.name}, ${ftIn(hCol / 12)} tall`));
    checks.push(check("Column top drift, crane lateral load", fmtIn(c.r.drift), `H/240 = ${fmtIn(hCol / 240)}`, "in", true, c.r.dr, ""));
    const colLb = cols * C.w * hCol / 12;
    members.push({ role: "Columns", size: C.name.replace(/X/g, "x"), qty: cols, lengthFt: round(hCol / 12, 1), lb: colLb, mat: "hss" });
    members.push({ role: "Base plates", size: `PL ${bp.t}" x ${bp.size}" x ${bp.size}"`, qty: cols, lengthFt: null, lb: cols * bp.lb, mat: "plate" });
    qty.steel_hss += colLb;
    qty.plate += cols * (bp.lb + 15);           // base plate, cap plate, stiffeners
    qty.anchors += cols * bp.anchors;
    colInfo = { size: C.name, B: C.B, hIn: hCol, count: cols, basePlate: bp, reactionK: Pcol, momentKin: Hcol * hCol };
    geometry.column = { B: C.B, hIn: hCol, basePlate: bp.size };
    assumptions.push("Free-standing runway without knee braces: each column is a cantilever from a fixed base plate, across the bay for the crane lateral load and along the runway for a longitudinal force of 10% of the wheel loads shared by the columns on each runway line. Tie-backs to the building can reduce column size.");
    assumptions.push(`Floor: at least a 4 in reinforced slab in good condition. Anchors and slab are checked by EZUP engineering before order (maximum column load about ${round(Pcol, 1)} kips).`);
  } else {
    qty.hangers = 2 * (bays + 1);
    warnings.push("Runway hung from building steel: the building structure must be checked by EZUP engineering before an order is confirmed.");
    assumptions.push(`Runway hung from existing building steel at ${ftIn(s / 12)} or closer; hanger loads up to about ${round(twoWheelReaction(Pw, etWb, s) + R.w / 12000 * s, 1)} kips each.`);
  }

  if (inp.cap >= 2 && inp.span > 40 && pro) warnings.push("Check the Industrial line for this size.");
  if (hook < 72) warnings.push("Hook height is under 6 ft. Increase the height under the bridge.");

  assumptions.push(`Rated load plus ${IMPACT * 100}% impact, ${HOIST_MODEL[line]} hoist ${L.hoistLb} lb, trolley ${round(L.trolley * 1000)} lb. Lateral load ${LATERAL * 100}% of load, hoist and trolley.`);
  assumptions.push("Bridge girders and runway beams: ASTM A992 wide-flange beams, deflection limit span/600. Trolley wheels run on the girder top flanges; girders are unbraced between end trucks. Top flanges take the crane lateral load.");

  // ---- quantities for pricing (no costs here)
  const conductorFt = inp.length + inp.span + 10;
  Object.assign(qty, {
    endtrucks: 1, trolleyDouble: 1, hoist: 1, panel: inp.travel === "motorized" ? 1 : 0, radio: inp.control === "radio" ? 1 : 0,
    pendant: inp.control === "pendant" ? 1 : 0, conductorFt, festoonFt: 0, stops: 1, columns: colInfo ? colInfo.count : 0
  });

  const capS = CAP_SHORT[inp.cap];
  const scope = [
    `${TYPES[inp.type].short} top-running double-girder bridge crane, ${CAP_LABEL[inp.cap]} capacity`,
    `Bridge span ${inp.span} ft; wide-flange girders 2 × ${G.name.replace(/X/g, "x")}; EZUP end trucks with polyurethane wheels`,
    `Runway ${inp.length} ft; wide-flange beams 2 × ${R.name.replace(/X/g, "x")} supported at ${ftIn(s / 12)}` + (colInfo ? `; ${colInfo.count} free-standing columns ${colInfo.size.replace(/X/g, "x")} with base plates, no knee braces` : "; hung from existing building steel"),
    `${HOIST_MODEL[line]} ${capS} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley`,
    inp.travel === "motorized" ? `Motorized bridge and trolley travel with variable frequency drives, ${inp.control === "radio" ? "industrial radio control with two transmitters" : "pendant control"}` : `Push-pull bridge and trolley travel, ${inp.control === "radio" ? "radio" : "pendant"} hoist control`,
    "Conductix SafeLec 2 enclosed conductor bar on the runway and bridge",
    `Power: ${pro ? "120 V single phase" : `${inp.power} V three phase`}, customer supplies a fused disconnect at the runway`
  ];

  return finish(inp, {
    hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions,
    reactions: colInfo ? { columnKips: round(colInfo.reactionK, 1), columnMomentKft: round(colInfo.momentKin / 12, 1) } : null,
    hookFt: hook / 12
  });
}

// ---------------------------------------------------------------- jib crane (free-standing pillar)
function jibFree(inp) {
  const L = loads(inp, inp.cap <= 1 ? "com" : "pro", "under");
  const line = inp.cap <= 1 ? "com" : "pro";
  const Rr = inp.span * 12;
  const reach = Rr - 12;                          // trolley at full reach, 1 ft from the boom end
  const hUnder = inp.height * 12;
  const checks = [], warnings = [], assumptions = [];
  const booms = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  const pipes = PIPES.filter(p => p.OD >= 6);
  let best = null;
  for (const b of booms) {
    const w = b.w / 12000;
    const Mb = L.vert * reach + w * Rr * Rr / 2;
    const ratioB = Mb / wFlexure(b, Rr, 1.0);
    const vr = (L.vert + w * Rr) / wShear(b);
    if (ratioB > 1 || vr > 1) continue;
    const mastH = hUnder + b.d + 8;               // mast to top of the head
    const mastPick = pickLightest(pipes, p => {
      const Mm = Mb + 0; // boom moment carried into the mast
      const Pm = L.vert + w * Rr + p.w / 12000 * mastH;
      const Mc = pipeFlexure(p);
      const Pc = compression(p.A, p.r, 2.1 * mastH, FY_PIPE);
      const ratio = interaction(Pm, Pc, Mm, Mc);
      // tip deflection: boom bending + mast rotation, service loads
      const Ms = L.live * reach + w * Rr * Rr / 2;
      const dBoom = L.live * reach ** 3 / (3 * E * b.Ix);
      const theta = Ms * mastH / (E * p.I);
      const d = dBoom + theta * reach;
      const dr = d / (Rr / 150);
      return { ok: ratio <= 1 && dr <= 1, ratio, d, dr, mastH, Ms };
    });
    if (!mastPick) continue;
    const total = b.w * inp.span + mastPick.s.w * mastPick.r.mastH / 12;
    if (!best || total < best.total) best = { b, p: mastPick.s, r: mastPick.r, ratioB, total };
  }
  if (!best) return outOfRange(inp, "This reach and capacity need a custom free-standing jib. A wall tie-rod jib may fit, or we will engineer a free-standing one for you.");
  const { b: B, p: P, r } = best;
  const mastH = r.mastH;
  checks.push(check("Boom bending", `${round(best.ratioB, 2)}`, "1.00", "", true, best.ratioB, `${B.name}, cantilever ${ftIn(inp.span)}`));
  checks.push(check("Mast axial + bending", `${round(r.ratio, 2)}`, "1.00", "", true, r.ratio, `${P.name} (A53 Gr B), ${ftIn(mastH / 12)} to the head`));
  checks.push(check("Tip deflection (boom + mast rotation)", fmtIn(r.d), `L/150 = ${fmtIn(Rr / 150)}`, "in", true, r.dr, ""));
  const baseM = L.vert * reach + B.w / 12000 * Rr * Rr / 2;
  const bp = { size: Math.ceil(P.OD + 14), t: P.OD > 10 ? 2 : 1.5, anchors: 8 };
  bp.lb = bp.size * bp.size * bp.t * 0.2836;
  const members = [
    { role: "Boom", size: B.name.replace(/X/g, "x"), qty: 1, lengthFt: inp.span, lb: B.w * inp.span, mat: "w" },
    { role: "Mast", size: P.name.replace("Pipe", "Pipe "), qty: 1, lengthFt: round(mastH / 12, 1), lb: P.w * mastH / 12, mat: "pipe" },
    { role: "Base plate and gussets", size: `PL ${bp.t}" x ${bp.size}" x ${bp.size}"`, qty: 1, lengthFt: null, lb: bp.lb + 60, mat: "plate" }
  ];
  const qty = {
    steel_w: members[0].lb, steel_hss: 0, steel_pipe: members[1].lb, plate: members[2].lb + 90, anchors: bp.anchors, hangers: 0,
    jibHead: 1, trolleyUnder: 1, hoist: 1, panel: 0, radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0,
    conductorFt: 0, festoonFt: inp.cable === "festoon" ? inp.span + 6 : 0, taglineFt: inp.cable === "tagline" ? inp.span + 6 : 0, stops: 1, columns: 0
  };
  warnings.push("A free-standing jib needs a reinforced concrete foundation. It is designed after we review your floor and soil; it is not included in this estimate.");
  assumptions.push(`Rated load plus ${IMPACT * 100}% impact at full reach. Boom ASTM A992 W shape treated as a cantilever; mast ASTM A53 Gr B pipe; tip deflection limit reach/150.`);
  assumptions.push(`Foundation design moment about ${round(baseM / 12, 1)} kip-ft (with impact); service moment about ${round(r.Ms / 12, 1)} kip-ft.`);
  const capS = CAP_SHORT[inp.cap];
  const scope = [
    `Free-standing pillar jib crane, ${CAP_LABEL[inp.cap]} capacity, 360° manual rotation`,
    `Boom reach ${inp.span} ft, ${B.name.replace(/X/g, "x")}; mast ${P.name.replace("Pipe", "Pipe ")}, ${ftIn(inp.height)} under the boom`,
    `Base plate ${bp.size} in square with ${bp.anchors} anchor bolts and template`,
    `${HOIST_MODEL[line]} ${capS} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    inp.cable === "tagline" ? "Tagline hoist power: flat cable on trolleys along a tensioned wire rope on the boom" : "Cable festoon on a C-track along the boom",
    "Power: customer supplies a fused disconnect at the mast"
  ];
  const geometry = { kind: "jib", reach: inp.span, underBoomIn: hUnder, boom: { d: B.d, bf: B.bf }, mast: { OD: P.OD, hIn: mastH }, basePlate: bp.size, hookIn: hUnder - L.headroomIn - 6, trolleyAtFt: (reach / 12) * 0.75 };
  const building = { recommended: true, why: "A free-standing jib needs a foundation designed for your floor slab and soil." };
  const buildingLoads = [
    ["Overturning moment at the base (with impact)", `${round(baseM / 12, 1)} kip-ft`],
    ["Vertical load at the base", `${round((L.vert + B.w / 1000 * inp.span + P.w / 1000 * mastH / 12 + 0.3), 1)} kips`]
  ];
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry: { ...geometry, style: "free" }, qty, scope, warnings, assumptions, reactions: { overturningKft: round(baseM / 12, 1) }, hookFt: geometry.hookIn / 12, building, buildingLoads });
}


// Wall cantilever jib: W-shape boom at the top of a square HSS pivot post, joined by a bolted full
// moment connection (end plate), no knee brace. The post turns on two hinge brackets bolted to the building
// column, the upper one at boom level, so the boom sits as high as the building allows (more hook
// height than a tie-rod jib, which needs column above the boom for the rod). The bracket pair resists
// the boom moment as a horizontal couple (H = M / hinge spacing). 180° rotation.
function jibWall(inp) {
  const line = inp.cap <= 1 ? "com" : "pro";
  const L = loads(inp, line, "under");
  const Rr = inp.span * 12, reach = Rr - 12, hUnder = inp.height * 12;
  const hs = clamp(Math.round(inp.span * 0.25 * 2) / 2, 3, 6) * 12;     // hinge spacing (in)
  const checks = [], warnings = [], assumptions = [];
  const booms = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  const posts = HSS_SQUARE.filter(x => x.B >= 4 && x.B <= 12 && x.bt <= 30);
  let best = null;
  for (const b of booms) {
    const w = b.w / 12000;
    const M = L.vert * reach + w * Rr * Rr / 2;
    const ratioB = M / wFlexure(b, Rr, 1.0);
    const vr = (L.vert + w * Rr) / wShear(b);
    if (ratioB > 1 || vr > 1) continue;
    const Ms = L.live * reach + w * Rr * Rr / 2;
    const pk = pickLightest(posts, p => {
      const ratio = M / hssSqFlexure(p);
      const dBoom = L.live * reach ** 3 / (3 * E * b.Ix) + w * Rr ** 4 / (8 * E * b.Ix);
      const theta = Ms * hs / (3 * E * p.I);                // post between hinges, end moment at the boom
      const d = dBoom + theta * reach;
      const dr = d / (Rr / 150);
      return { ok: ratio <= 1 && dr <= 1 && p.B <= b.bf + 6, ratio, d, dr };
    });
    if (!pk) continue;
    const total = b.w * inp.span + pk.s.w * (hs + b.d / 2 + 9) / 12;
    if (!best || total < best.total) best = { b, p: pk.s, r: pk.r, ratioB, total, M, Ms };
  }
  if (!best) return outOfRange(inp, "This reach and capacity need a custom wall jib. We will engineer it for you.");
  const { b: B, p: P, r, M } = best;
  const postL = hs + B.d / 2 + 9;                 // 6 in below the lower hinge to a 3 in cap above the boom
  const postBot = hUnder + B.d - postL + 3;
  const H = M / hs, Hs = best.Ms / hs;
  const V = L.vert + B.w / 1000 * inp.span + P.w / 1000 * postL / 12;
  checks.push(check("Boom bending", `${round(best.ratioB, 2)}`, "1.00", "", true, best.ratioB, `${B.name}, cantilever ${ftIn(inp.span)}`));
  checks.push(check("Pivot post bending", `${round(r.ratio, 2)}`, "1.00", "", true, r.ratio, `${P.name}, hinges ${ftIn(hs / 12)} apart`));
  checks.push(check("Tip deflection (boom + post)", fmtIn(r.d), `L/150 = ${fmtIn(Rr / 150)}`, "in", true, r.dr, "building column assumed rigid"));
  const brkLb = 90 + 6 * H + 40 + 0.15 * M;      // hinge brackets + bolted moment end plate
  const members = [
    { role: "Boom", size: B.name, qty: 1, lengthFt: inp.span, lb: B.w * inp.span, mat: "w" },
    { role: "Pivot post", size: P.name, qty: 1, lengthFt: round(postL / 12, 1), lb: P.w * postL / 12, mat: "hss" },
    { role: "Wall hinge brackets", size: `rated ${Math.ceil(H)} kips`, qty: 2, lengthFt: null, lb: brkLb, mat: "plate" }
  ];
  const qty = {
    steel_w: members[0].lb, steel_hss: members[1].lb, steel_pipe: 0, plate: brkLb, anchors: 0, hangers: 0,
    jibWall: 1, trolleyUnder: 1, hoist: 1, panel: 0, radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0,
    conductorFt: 0, festoonFt: inp.cable === "festoon" ? inp.span + 6 : 0, taglineFt: inp.cable === "tagline" ? inp.span + 6 : 0, stops: 1, columns: 0
  };
  warnings.push(`The jib puts about ${round(H, 1)} kips of horizontal force into your building column at each bracket. The column must be checked by an engineer before installation; this estimate does not include column reinforcement.`);
  assumptions.push(`Rated load plus ${IMPACT * 100}% impact at full reach. Boom ASTM A992 W shape at the top of an ASTM A500 Gr C pivot post with a bolted full moment connection (end plate), checked as a cantilever; hinge brackets ${ftIn(hs / 12)} apart, the upper one at boom level; tip deflection limit reach/150 with the building column rigid.`);
  const scope = [
    `Wall cantilever jib crane, ${CAP_LABEL[inp.cap]} capacity, 180° manual rotation`,
    `Boom reach ${inp.span} ft, ${B.name}, at the top of the pivot post for maximum hook height, ${ftIn(inp.height)} under the boom`,
    `Pivot post ${P.name}; boom bolted to the post with a full moment end-plate connection, no knee brace`,
    `Upper hinge bracket at boom level and lower bracket ${ftIn(hs / 12)} below, bolted or clamped to your building column`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    inp.cable === "tagline" ? "Tagline hoist power: flat cable on trolleys along a tensioned wire rope on the boom" : "Cable festoon on a C-track along the boom",
    "Power: customer supplies a fused disconnect at the column"
  ];
  const geometry = { kind: "jib", style: "wall", reach: inp.span, underBoomIn: hUnder, boom: { d: B.d, bf: B.bf }, post: { B: P.B, hIn: postL, botIn: postBot }, hingeIn: hs,
    hookIn: hUnder - L.headroomIn - 6, trolleyAtFt: (reach / 12) * 0.75, wallAboveIn: hUnder + B.d + 6 };
  const building = { recommended: true, why: "A wall-mounted jib pushes and pulls on your building column with large horizontal forces." };
  const buildingLoads = [
    ["Horizontal force, upper bracket at boom level (pulls out)", `${round(H, 1)} kips`],
    ["Horizontal force, lower bracket (pushes in)", `${round(H, 1)} kips`],
    ["Vertical load at the brackets", `${round(V, 1)} kips`],
    ["Bracket spacing", ftIn(hs / 12)],
    ["Lower bracket height", `${ftIn((hUnder + B.d / 2 - hs) / 12)} above the floor`],
    ["Clear column height needed", `${ftIn(geometry.wallAboveIn / 12)} above the floor`]
  ];
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions,
    reactions: { bracketHkips: round(H, 1), bracketHserviceKips: round(Hs, 1), verticalKips: round(V, 1) }, hookFt: geometry.hookIn / 12, building, buildingLoads });
}

// Wall tie-rod jib: W-shape boom hinged at a lower wall bracket and carried near its end by a round
// tie rod from an upper wall bracket. Boom = beam-column (axial from the rod + bending between the
// hinge and the rod). 180° rotation. Lighter boom, but needs wall height above the boom for the rod.
const RODS = [0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.75, 2, 2.25, 2.5];
function jibRod(inp) {
  const line = inp.cap <= 1 ? "com" : "pro";
  const L = loads(inp, line, "under");
  const Rr = inp.span * 12, reach = Rr - 12, hUnder = inp.height * 12;
  const a = Rr - 6;                                                  // rod attachment from the hinge
  const hr = clamp(Math.round(inp.span * 0.3), 4, 9) * 12;           // rod bracket height above the hinge
  const Lrod = Math.hypot(a, hr), sin = hr / Lrod;
  const checks = [], warnings = [], assumptions = [];
  const booms = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  let best = null;
  for (const b of booms) {
    const w = b.w / 12000;
    const Pc = compression(b.A, b.ry, a);
    const Mc = wFlexure(b, a, 1.0);
    const Tv1 = (L.vert * reach + w * Rr * Rr / 2) / a;              // trolley at full reach
    const H1 = Tv1 * a / hr, M1 = w * a * a / 8;
    const Tv2 = (L.vert * a / 2 + w * Rr * Rr / 2) / a;              // trolley at mid-boom
    const H2 = Tv2 * a / hr, M2 = L.vert * a / 4 + w * a * a / 8;
    const ratio = Math.max(interaction(H1, Pc, M1, Mc), interaction(H2, Pc, M2, Mc));
    const vr = (L.vert + w * Rr) / wShear(b);
    if (ratio > 1 || vr > 1) continue;
    const T = Tv1 / sin;
    const rod = RODS.find(d => 21.75 * Math.PI * d * d / 4 >= T);
    if (!rod) continue;
    const Ab = Math.PI * rod * rod / 4;
    const Tvs = (L.live * reach + w * Rr * Rr / 2) / a, Ts = Tvs / sin;
    const dTip = Ts * Lrod / (E * Ab) / sin;                          // rod stretch, seen at the tip
    const dMid = L.live * a ** 3 / (48 * E * b.Ix);
    const dr = Math.max(dTip / (Rr / 150), dMid / (a / 450));
    if (dr > 1) continue;
    const total = b.w * inp.span + 2.673 * rod * rod * Lrod / 12;
    if (!best || total < best.total) best = { b, rod, T, Tv1, H1, ratio, dTip, dMid, dr, total, Ts };
  }
  if (!best) return outOfRange(inp, "This reach and capacity need a custom tie-rod jib. We will engineer it for you.");
  const { b: B, rod, T, Tv1, H1 } = best;
  const V = L.vert + B.w / 1000 * inp.span;
  const rodLb = 2.673 * rod * rod * Lrod / 12;
  const frac = d => ({ 0.75: "3/4", 0.875: "7/8", 1: "1", 1.125: "1-1/8", 1.25: "1-1/4", 1.375: "1-3/8", 1.5: "1-1/2", 1.75: "1-3/4", 2: "2", 2.25: "2-1/4", 2.5: "2-1/2" })[d];
  checks.push(check("Boom axial + bending", `${round(best.ratio, 2)}`, "1.00", "", true, best.ratio, `${B.name}, ${ftIn(a / 12)} between hinge and rod`));
  checks.push(check("Tie rod tension", `${round(T, 1)} kips`, `${round(21.75 * Math.PI * rod * rod / 4, 1)} kips`, "", true, T / (21.75 * Math.PI * rod * rod / 4), `${frac(rod)} in round, threaded ends`));
  checks.push(check("Tip deflection (rod stretch)", fmtIn(best.dTip), `L/150 = ${fmtIn(Rr / 150)}`, "in", true, best.dTip / (Rr / 150), ""));
  checks.push(check("Boom deflection between supports", fmtIn(best.dMid), `L/450 = ${fmtIn(a / 450)}`, "in", true, best.dMid / (a / 450), ""));
  const brkLb = 110 + 5 * H1;
  const members = [
    { role: "Boom", size: B.name, qty: 1, lengthFt: inp.span, lb: B.w * inp.span, mat: "w" },
    { role: "Tie rod and turnbuckle", size: `${frac(rod)} in round`, qty: 1, lengthFt: round(Lrod / 12, 1), lb: rodLb, mat: "plate" },
    { role: "Wall brackets", size: `rated ${Math.ceil(H1)} kips`, qty: 2, lengthFt: null, lb: brkLb, mat: "plate" }
  ];
  const qty = {
    steel_w: members[0].lb, steel_hss: 0, steel_pipe: 0, plate: rodLb + brkLb, anchors: 0, hangers: 0,
    jibRod: 1, trolleyUnder: 1, hoist: 1, panel: 0, radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0,
    conductorFt: 0, festoonFt: inp.cable === "festoon" ? inp.span + 6 : 0, taglineFt: inp.cable === "tagline" ? inp.span + 6 : 0, stops: 1, columns: 0
  };
  warnings.push(`The tie rod pulls the upper bracket out of your building column with about ${round(H1, 1)} kips, and the boom pushes the lower bracket in with the same force. The column must be checked by an engineer before installation; this estimate does not include column reinforcement.`);
  warnings.push(`Needs ${ftIn(hr / 12)} of clear column above the boom for the tie rod bracket.`);
  assumptions.push(`Rated load plus ${IMPACT * 100}% impact, trolley at full reach and at mid-boom. Boom ASTM A992 W shape as a beam-column, unbraced between hinge and rod; tie rod ASTM A36 round bar, threaded; tip deflection limit reach/150.`);
  const scope = [
    `Wall tie-rod jib crane, ${CAP_LABEL[inp.cap]} capacity, 180° manual rotation`,
    `Boom reach ${inp.span} ft, ${B.name}, ${ftIn(inp.height)} under the boom; ${frac(rod)} in tie rod with turnbuckle`,
    `Lower hinge bracket and upper rod bracket ${ftIn(hr / 12)} above it, bolted or clamped to your building column`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    inp.cable === "tagline" ? "Tagline hoist power: flat cable on trolleys along a tensioned wire rope on the boom" : "Cable festoon on a C-track along the boom",
    "Power: customer supplies a fused disconnect at the column"
  ];
  const geometry = { kind: "jib", style: "rod", reach: inp.span, underBoomIn: hUnder, boom: { d: B.d, bf: B.bf }, rod: { d: rod, atIn: a, riseIn: hr },
    hookIn: hUnder - L.headroomIn - 6, trolleyAtFt: (reach / 12) * 0.75, wallAboveIn: hUnder + B.d + hr + 8 };
  const building = { recommended: true, why: "A wall-mounted jib pushes and pulls on your building column with large horizontal forces." };
  const buildingLoads = [
    ["Horizontal force, upper rod bracket (pulls out)", `${round(H1, 1)} kips`],
    ["Vertical force, upper rod bracket (down)", `${round(Tv1, 1)} kips`],
    ["Horizontal force, lower hinge bracket (pushes in)", `${round(H1, 1)} kips`],
    ["Vertical load, lower hinge bracket", `${round(Math.max(0, V - Tv1 + 0.2), 1)} kips`],
    ["Bracket spacing", ftIn(hr / 12)],
    ["Clear column height needed", `${ftIn(geometry.wallAboveIn / 12)} above the floor`]
  ];
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions,
    reactions: { rodTensionKips: round(T, 1), bracketHkips: round(H1, 1), rodVerticalKips: round(Tv1, 1) }, hookFt: geometry.hookIn / 12, building, buildingLoads });
}

// Mast-type jib: square HSS mast that turns in a bottom bearing on the floor and a top bearing braced
// to overhead building steel; W-shape boom moment-connected near the top. 360° rotation, no special
// foundation. The boom moment reaches the building as a horizontal couple H = M / mast height.
function jibMast(inp) {
  const line = inp.cap <= 1 ? "com" : "pro";
  const L = loads(inp, line, "under");
  const Rr = inp.span * 12, reach = Rr - 12, hUnder = inp.height * 12;
  const checks = [], warnings = [], assumptions = [];
  const booms = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  const masts = HSS_SQUARE.filter(x => x.B >= 4 && x.B <= 12 && x.bt <= 30);
  let best = null;
  for (const b of booms) {
    const w = b.w / 12000;
    const M = L.vert * reach + w * Rr * Rr / 2;
    const ratioB = M / wFlexure(b, Rr, 1.0);
    const vr = (L.vert + w * Rr) / wShear(b);
    if (ratioB > 1 || vr > 1) continue;
    const Hm = hUnder + b.d + 12;                     // floor to the top bearing
    const hb = hUnder + b.d / 2;                      // boom connection height
    const Ms = L.live * reach + w * Rr * Rr / 2;
    const pk = pickLightest(masts, p => {
      const Mm = M * hb / Hm;                         // mast moment just below the boom
      const V = L.vert + w * Rr + p.w / 12000 * Hm;
      const ratio = interaction(V, compression(p.A, p.r, Hm), Mm, hssSqFlexure(p));
      const dBoom = L.live * reach ** 3 / (3 * E * b.Ix) + w * Rr ** 4 / (8 * E * b.Ix);
      const theta = Ms * Hm / (3 * E * p.I);           // conservative: couple at a pinned end
      const d = dBoom + theta * reach;
      const dr = d / (Rr / 150);
      return { ok: ratio <= 1 && dr <= 1 && p.B <= b.bf + 6, ratio, d, dr, V };
    });
    if (!pk) continue;
    const total = b.w * inp.span + pk.s.w * Hm / 12;
    if (!best || total < best.total) best = { b, p: pk.s, r: pk.r, ratioB, total, M, Ms, Hm };
  }
  if (!best) return outOfRange(inp, "This reach and capacity need a custom mast jib. We will engineer it for you.");
  const { b: B, p: P, r, M, Hm } = best;
  const H = M / Hm, V = r.V;
  checks.push(check("Boom bending", `${round(best.ratioB, 2)}`, "1.00", "", true, best.ratioB, `${B.name}, cantilever ${ftIn(inp.span)}`));
  checks.push(check("Mast axial + bending", `${round(r.ratio, 2)}`, "1.00", "", true, r.ratio, `${P.name}, ${ftIn(Hm / 12)} between bearings`));
  checks.push(check("Tip deflection (boom + mast)", fmtIn(r.d), `L/150 = ${fmtIn(Rr / 150)}`, "in", true, r.dr, "overhead steel assumed rigid"));
  const brgLb = 160 + 4 * H;
  const members = [
    { role: "Boom", size: B.name, qty: 1, lengthFt: inp.span, lb: B.w * inp.span, mat: "w" },
    { role: "Mast", size: P.name, qty: 1, lengthFt: round(Hm / 12, 1), lb: P.w * Hm / 12, mat: "hss" },
    { role: "Top and bottom bearings", size: `rated ${Math.ceil(H)} kips`, qty: 2, lengthFt: null, lb: brgLb, mat: "plate" }
  ];
  const qty = {
    steel_w: members[0].lb, steel_hss: members[1].lb, steel_pipe: 0, plate: brgLb, anchors: 4, hangers: 0,
    jibMast: 1, trolleyUnder: 1, hoist: 1, panel: 0, radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0,
    conductorFt: 0, festoonFt: inp.cable === "festoon" ? inp.span + 6 : 0, taglineFt: inp.cable === "tagline" ? inp.span + 6 : 0, stops: 1, columns: 0
  };
  warnings.push(`The mast needs overhead building steel at ${ftIn(Hm / 12)} above the floor to take about ${round(H, 1)} kips of horizontal force in any direction, and the floor slab takes the same horizontal force plus ${round(V, 1)} kips down. Both must be checked by an engineer before installation; this estimate does not include building reinforcement.`);
  assumptions.push(`Rated load plus ${IMPACT * 100}% impact at full reach. Boom ASTM A992 W shape as a cantilever moment-connected to an ASTM A500 Gr C mast pinned at the floor and at the overhead steel; tip deflection limit reach/150 with the building rigid.`);
  const scope = [
    `Mast-type jib crane, ${CAP_LABEL[inp.cap]} capacity, 360° manual rotation`,
    `Boom reach ${inp.span} ft, ${B.name}, ${ftIn(inp.height)} under the boom; mast ${P.name}, ${ftIn(Hm / 12)} tall`,
    "Bottom bearing with base plate anchored to your floor slab; top bearing with bracket to your overhead steel",
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    inp.cable === "tagline" ? "Tagline hoist power: flat cable on trolleys along a tensioned wire rope on the boom" : "Cable festoon on a C-track along the boom",
    "Power: customer supplies a fused disconnect at the mast"
  ];
  const geometry = { kind: "jib", style: "mast", reach: inp.span, underBoomIn: hUnder, boom: { d: B.d, bf: B.bf }, mast: { B: P.B, hIn: Hm },
    hookIn: hUnder - L.headroomIn - 6, trolleyAtFt: (reach / 12) * 0.75, wallAboveIn: Hm };
  const building = { recommended: true, why: "A mast jib braces against your overhead steel and bears on your floor slab." };
  const buildingLoads = [
    ["Horizontal force at the overhead steel (any direction)", `${round(H, 1)} kips`],
    ["Horizontal force at the floor (any direction)", `${round(H, 1)} kips`],
    ["Vertical load on the floor slab", `${round(V, 1)} kips`],
    ["Overhead steel needed at", `${ftIn(Hm / 12)} above the floor`]
  ];
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions,
    reactions: { topHkips: round(H, 1), floorVkips: round(V, 1) }, hookFt: geometry.hookIn / 12, building, buildingLoads });
}

function jib(inp) {
  return inp.jib === "wall" ? jibWall(inp) : inp.jib === "rod" ? jibRod(inp) : inp.jib === "mast" ? jibMast(inp) : jibFree(inp);
}

// ---------------------------------------------------------------- portable gantry
function gantry(inp) {
  const line = inp.cap <= 1 ? "com" : "pro";
  const L = loads(inp, line, "under");
  const S = inp.span * 12;
  const hUnder = inp.height * 12;
  const checks = [], warnings = [], assumptions = [];
  const beams = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  const bm = pickLightest(beams, x => {
    const w = x.w / 12000;
    const M = L.vert * S / 4 + w * S * S / 8;
    const ratio = M / wFlexure(x, S, 1.0);
    const vr = (L.vert + w * S / 2) / wShear(x);
    const d = L.live * S ** 3 / (48 * E * x.Ix);
    const dr = d / (S / 450);
    return { ok: ratio <= 1 && vr <= 1 && dr <= 1, ratio, d, dr };
  });
  if (!bm) return outOfRange(inp, "This span and capacity are beyond our standard portable gantry. We will engineer it for you.");
  const Bm = bm.s;
  checks.push(check("Beam bending", `${round(bm.r.ratio, 2)}`, "1.00", "", true, bm.r.ratio, `${Bm.name}, span ${ftIn(inp.span)}`));
  checks.push(check("Beam deflection", fmtIn(bm.r.d), `L/450 = ${fmtIn(S / 450)}`, "in", true, bm.r.dr, ""));
  const casterH = inp.mobility === "casters" ? 9 : 0;
  const legTop = hUnder - casterH - 4;            // legs from base tube to the top plate
  const spread = Math.max(60, 0.55 * hUnder);     // A-frame base width (in)
  const legL = Math.sqrt(legTop ** 2 + (spread / 2) ** 2);
  const cos = legTop / legL;
  const endR = L.vert + Bm.w / 12000 * S / 2;
  const Pleg = endR / 2 / cos;
  const legs = HSS_SQUARE.filter(x => x.B >= 3 && x.bt <= 1.40 * Math.sqrt(E / FY));
  const lg = pickLightest(legs, x => {
    const Pc = compression(x.A, x.r, 1.0 * legL);
    const ratio = Pleg / Pc;
    return { ok: ratio <= 1 && legL / x.r <= 200, ratio };
  });
  if (!lg) return outOfRange(inp, "The A-frame legs for this height and capacity need a custom design. We will engineer it for you.");
  const Lg = lg.s;
  checks.push(check("A-frame leg compression", `${round(lg.r.ratio, 2)}`, "1.00", "", true, lg.r.ratio, `${Lg.name}, ${ftIn(legL / 12)} long`));
  const casterLb = (endR + 0.25) * 1000 / 2;
  const casterClass = casterLb <= 1200 ? "light" : casterLb <= 2500 ? "medium" : "heavy";
  const legLb = 4 * Lg.w * legL / 12 + 2 * Lg.w * (spread + 24) / 12 + 2 * Lg.w * spread * 0.55 / 12;
  const members = [
    { role: "Beam", size: Bm.name.replace(/X/g, "x"), qty: 1, lengthFt: inp.span + 2, lb: Bm.w * (inp.span + 2), mat: "w" },
    { role: "A-frame legs, base and cross ties", size: Lg.name.replace(/X/g, "x"), qty: 4, lengthFt: round(legL / 12, 1), lb: legLb, mat: "hss" },
    { role: "Knee braces", size: "HSS3x3x3/16", qty: 2, lengthFt: 4, lb: 2 * 4 * 6.0, mat: "hss" }
  ];
  const qty = {
    steel_w: members[0].lb, steel_hss: members[1].lb + members[2].lb, steel_pipe: 0, plate: 80, anchors: inp.mobility === "fixed" ? 8 : 0, hangers: 0,
    casters: inp.mobility === "casters" ? casterClass : null, trolleyUnder: 1, hoist: 1, panel: 0,
    radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0, conductorFt: 0, festoonFt: inp.cable === "festoon" ? inp.span + 6 : 0, taglineFt: inp.cable === "tagline" ? inp.span + 6 : 0, stops: 1, columns: 0
  };
  if (inp.mobility === "casters") assumptions.push(`Casters rated at least ${Math.ceil(casterLb / 100) * 100} lb each; move the gantry only when unloaded, on a smooth level floor.`);
  assumptions.push(`Beam ASTM A992 W shape, deflection limit span/450; A-frame legs ASTM A500 Gr C square tube. Rated load plus ${IMPACT * 100}% impact.`);
  const scope = [
    `Portable A-frame gantry crane, ${CAP_LABEL[inp.cap]} capacity`,
    `Beam ${Bm.name.replace(/X/g, "x")}, span ${inp.span} ft between legs, ${ftIn(inp.height)} under the beam`,
    `A-frame ends in ${Lg.name.replace(/X/g, "x")} with knee braces, ${inp.mobility === "casters" ? `${casterClass}-duty locking swivel casters` : "base plates for anchoring"}`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    `${inp.cable === "tagline" ? "Tagline hoist power: flat cable on trolleys along a tensioned wire rope on the beam" : "Cable festoon on a C-track along the beam"}; power by cord to a customer outlet or disconnect`
  ];
  const geometry = { kind: "gantry", span: inp.span, underBeamIn: hUnder, beam: { d: Bm.d, bf: Bm.bf }, leg: { B: Lg.B }, spreadIn: spread, casterIn: casterH, hookIn: hUnder - L.headroomIn - 6 };
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions, reactions: { perWheelLb: Math.round(casterLb) }, hookFt: geometry.hookIn / 12 });
}

// ---------------------------------------------------------------- monorail
function monorail(inp) {
  const line = inp.cap <= 1 ? "com" : "pro";
  const L = loads(inp, line, "under");
  const bays = Math.max(1, Math.ceil(inp.length / MAX_SUPPORT_SPACING_FT));
  const s = inp.length * 12 / bays;
  const hUnder = inp.height * 12;
  const checks = [], warnings = [], assumptions = [];
  const beams = W_SHAPES.filter(x => x.d >= 6 && x.d <= 18).filter(trolleyBeam(inp.cap));
  const bm = pickLightest(beams, x => {
    const w = x.w / 12000;
    const M = L.vert * s / 4 + w * s * s / 8;
    const Mlat = L.lat * s / 4;
    const Stf = x.tf * x.bf * x.bf / 6;
    const ratio = M / wFlexure(x, s, 1.0) + Mlat / (FY * Stf * 2 / OMEGA_B);
    const vr = (L.vert + w * s / 2) / wShear(x);
    const d = L.live * s ** 3 / (48 * E * x.Ix);
    const dr = d / (s / 450);
    return { ok: ratio <= 1 && vr <= 1 && dr <= 1, ratio, d, dr };
  });
  if (!bm) return outOfRange(inp, "This monorail is beyond our standard beams. We will engineer it for you.");
  const B = bm.s;
  checks.push(check("Monorail beam bending + lateral", `${round(bm.r.ratio, 2)}`, "1.00", "", true, bm.r.ratio, `${B.name}, supports at ${ftIn(s / 12)}`));
  checks.push(check("Monorail beam deflection", fmtIn(bm.r.d), `L/450 = ${fmtIn(s / 450)}`, "in", true, bm.r.dr, ""));
  const members = [{ role: "Monorail beam", size: B.name.replace(/X/g, "x"), qty: 1, lengthFt: inp.length + 1, lb: B.w * (inp.length + 1), mat: "w" }];
  const qty = {
    steel_w: members[0].lb, steel_hss: 0, steel_pipe: 0, plate: 0, anchors: 0, hangers: 0,
    trolleyUnder: 1, hoist: 1, panel: inp.travel === "motorized" ? 1 : 0, radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0,
    conductorFt: inp.length + 6, festoonFt: 0, stops: 1, columns: 0
  };
  const Rsup = L.vert + B.w / 12000 * s;
  let frame = null;
  if (inp.support === "free") {
    const W = 96;                                  // frame width (in), monorail hung at mid-header
    const hd = pickLightest(W_SHAPES.filter(x => x.d >= 6 && x.d <= 14), x => {
      const M = Rsup * W / 4 + x.w / 12000 * W * W / 8;
      const ratio = M / wFlexure(x, W, 1.0);
      const d = (L.live + B.w / 12000 * s) * W ** 3 / (48 * E * x.Ix);
      return { ok: ratio <= 1 && d <= W / 600, ratio, d };
    });
    const topBeam = hUnder + B.d;                  // underside of header
    const hCol = topBeam;
    const H = L.lat;
    const colList = HSS_SQUARE.filter(x => x.bt <= 1.40 * Math.sqrt(E / FY) && x.B >= 4);
    const nCols = 2 * (bays + 1);
    const Flong = 0.10 * L.live / nCols;           // longitudinal force shared by all frame columns
    const c = pickLightest(colList, x => {
      const Pc = compression(x.A, x.r, 2.1 * hCol);
      const Mc = hssSqFlexure(x);
      const p = Rsup / 2 / Pc, mx = H / 2 * hCol / Mc, my = Flong * hCol / Mc;
      const ratio = p >= 0.2 ? p + 8 / 9 * (mx + my) : p / 2 + mx + my;
      const drift = Math.max(H / 2, Flong) * hCol ** 3 / (3 * E * x.I);
      return { ok: ratio <= 1 && drift <= hCol / 240, ratio, drift };
    });
    if (!hd || !c) return outOfRange(inp, "The support frames for this height need bracing. We will engineer the supports for you.");
    const frames = bays + 1;
    const bp = basePlate(c.s.B, false);
    checks.push(check("Support frame columns", `${round(c.r.ratio, 2)}`, "1.00", "", true, c.r.ratio, `${c.s.name}, ${ftIn(hCol / 12)} tall`));
    members.push({ role: "Support frame headers", size: hd.s.name.replace(/X/g, "x"), qty: frames, lengthFt: 9, lb: frames * hd.s.w * 9, mat: "w" });
    members.push({ role: "Support frame columns", size: c.s.name.replace(/X/g, "x"), qty: 2 * frames, lengthFt: round(hCol / 12, 1), lb: 2 * frames * c.s.w * hCol / 12, mat: "hss" });
    qty.steel_w += members[1].lb;
    qty.steel_hss += members[2].lb;
    qty.plate += 2 * frames * (bp.lb + 15) + frames * 20;
    qty.anchors += 2 * frames * bp.anchors;
    qty.columns = 2 * frames;
    frame = { widthIn: W, header: { d: hd.s.d }, col: { B: c.s.B }, count: frames, hIn: hCol };
    assumptions.push("Free-standing support frames 8 ft wide without knee braces; columns are cantilevers from fixed base plates in both directions.");
  } else {
    qty.hangers = bays + 1;
    warnings.push("Monorail hung from building steel: the building structure must be checked by EZUP engineering before an order is confirmed.");
  }
  assumptions.push(`Beam ASTM A992 W shape, supports at ${ftIn(s / 12)} or closer, deflection limit span/450. Rated load plus ${IMPACT * 100}% impact. Bottom-flange local bending under the trolley wheels is checked in final design.`);
  const scope = [
    `Straight monorail, ${CAP_LABEL[inp.cap]} capacity, ${inp.length} ft long`,
    `Beam ${B.name.replace(/X/g, "x")} with end stops, ${ftIn(inp.height)} under the beam`,
    inp.support === "free" ? `${frame.count} free-standing support frames with base plates` : `Hung from existing building steel at ${ftIn(s / 12)} or closer`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    "Conductix SafeLec 2 enclosed conductor bar along the monorail",
    "Power: customer supplies a fused disconnect at the monorail"
  ];
  const geometry = { kind: "monorail", length: inp.length, bays, spacingFt: s / 12, underBeamIn: hUnder, beam: { d: B.d, bf: B.bf }, support: inp.support, frame, hookIn: hUnder - L.headroomIn - 6 };
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions, reactions: { supportKips: round(Rsup, 1) }, hookFt: geometry.hookIn / 12 });
}

// ---------------------------------------------------------------- common wrap-up
// Should the customer have their building checked? Every system loads the building or its floor.
function buildingDefault(inp) {
  const t = inp.type;
  if ((t === "industrial" || t === "professional" || t === "monorail") && inp.support === "building")
    return { recommended: true, why: "The system hangs from your building steel, which must be checked for the crane loads." };
  if (t === "industrial" || t === "professional" || t === "monorail")
    return { recommended: false, why: "Free-standing columns put concentrated loads on your floor slab." };
  if (t === "jib" && inp.jib === "mast") return { recommended: true, why: "A mast jib braces against your overhead steel and bears on your floor slab." };
  if (t === "jib") return { recommended: true, why: inp.jib === "free" ? "A free-standing jib needs a foundation designed for your floor slab and soil." : "A wall-mounted jib pushes and pulls on your building column with large horizontal forces." };
  return { recommended: false, why: "A portable gantry loads your floor through its casters or base plates." };
}

function outOfRange(inp, message) {
  return {
    status: "engineer", type: inp.type, title: titleOf(inp), building: buildingDefault(inp), buildingLoads: [], inputs: inp, message,
    members: [], checks: [], warnings: [message], assumptions: [], scope: [], qty: null,
    geometry: { kind: inp.type === "industrial" || inp.type === "professional" ? "bridge" : inp.type, span: inp.span, length: inp.length, reach: inp.span, outOfRange: true },
    summary: summaryLine(inp)
  };
}

export function titleOf(inp) { return inp.type === "jib" ? JIB_STYLES[inp.jib || "free"].name : TYPES[inp.type].name; }

function summaryLine(inp) {
  const T = inp.type === "jib" ? JIB_STYLES[inp.jib || "free"] : TYPES[inp.type];
  const cap = CAP_SHORT[inp.cap];
  if (inp.type === "jib") return `${T.short}, ${cap}, ${inp.span} ft reach, ${inp.height} ft under boom`;
  if (inp.type === "gantry") return `${T.short}, ${cap}, ${inp.span} ft span, ${inp.height} ft under beam`;
  if (inp.type === "monorail") return `${T.short}, ${cap}, ${inp.length} ft long, ${inp.height} ft under beam`;
  return `${T.short}, ${cap}, ${inp.span} ft span × ${inp.length} ft runway`;
}

export function pretty(str) {
  return String(str).replace(/(HSS|W)(\d[\d\-\/]*)X([\d\-\/]+)(?:X([\d.\-\/]+))?/g, (m, k, a, b, c) => `${k}${a}x${b}${c ? "x" + c : ""}`)
    .replace(/Pipe ?(\d[\d\-\/]*)(SCH)?(\d+|STD|XS)/g, (m, a, sch, b) => `Pipe ${a} ${sch ? "Sch " + b : b}`);
}

function finish(inp, d) {
  for (const m of d.members) m.size = pretty(m.size);
  for (const c of d.checks) c.detail = pretty(c.detail);
  d.scope = d.scope.map(pretty);
  const steelLb = d.members.reduce((a, m) => a + (m.lb || 0), 0);
  for (const m of d.members) m.lb = Math.round(m.lb);
  const worst = d.checks.reduce((a, c) => Math.max(a, c.ratio), 0);
  return {
    status: "ok", type: inp.type, title: titleOf(inp), inputs: inp, summary: summaryLine(inp),
    hoist: { model: `${HOIST_MODEL[d.hoistLine]} ${CAP_SHORT[inp.cap]}`, line: d.hoistLine, weightLb: d.loads.hoistLb },
    loads: { ratedLb: inp.cap * 2000, designLb: Math.round(d.loads.vert * 1000), lateralLb: Math.round(d.loads.lat * 1000) },
    members: d.members, checks: d.checks, worstRatio: round(worst, 2), steelLb: Math.round(steelLb),
    geometry: d.geometry, qty: d.qty, scope: d.scope, warnings: d.warnings, assumptions: d.assumptions,
    reactions: d.reactions, hookFt: round(d.hookFt, 1),
    building: d.building || buildingDefault(inp), buildingLoads: d.buildingLoads || []
  };
}

export function design(raw) {
  const { inp, notes } = normalize(raw);
  let out;
  if (inp.type === "industrial" || inp.type === "professional") out = bridge(inp);
  else if (inp.type === "jib") out = jib(inp);
  else if (inp.type === "gantry") out = gantry(inp);
  else out = monorail(inp);
  out.inputNotes = notes;
  return out;
}
