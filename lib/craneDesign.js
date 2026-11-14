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
import { W_SHAPES, HSS_RECT, HSS_SQUARE, PIPES } from "./shapes.js";

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
  travel: "motorized", control: "radio", power: "480", install: "ezup", zip: "", mobility: "casters"
};

// ---------------------------------------------------------------- input normalization
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (v === "" || v == null || !isFinite(Number(v)) ? d : Number(v));
const round = (v, n = 0) => Math.round(v * 10 ** n) / 10 ** n;

export function normalize(raw = {}) {
  const t = TYPES[raw.type] ? raw.type : DEFAULTS.type;
  const T = TYPES[t];
  const notes = [];
  let cap = num(raw.cap, DEFAULTS.cap);
  if (!T.caps.includes(cap)) {
    const fit = T.caps.find(c => c >= cap) ?? T.caps[T.caps.length - 1];
    if (raw.cap != null && raw.cap !== "") notes.push(`${T.short} capacities run ${CAP_SHORT[T.caps[0]]} to ${CAP_SHORT[T.caps[T.caps.length - 1]]}; set to ${CAP_SHORT[fit]}.`);
    cap = fit;
  }
  const inp = { type: t, cap };
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
function hssRectFlexure(s, LbIn) {
  // Major axis (F7). Slender flanges are excluded from the candidate list.
  const Mp = FY * s.Zx;
  let Mn = Mp;
  if (s.bt > HSS_LIM.fp) Mn = Math.min(Mn, Mp - (Mp - FY * s.Sx) * (3.57 * s.bt * Math.sqrt(FY / E) - 4.0));
  if (s.ht > HSS_LIM.wp) Mn = Math.min(Mn, Mp - (Mp - FY * s.Sx) * (0.305 * s.ht * Math.sqrt(FY / E) - 0.738));
  // Lateral-torsional buckling (F7.4), only for tall narrow tubes on long spans.
  const Lp = 0.13 * E * s.ry * Math.sqrt(s.J * s.A) / Mp;
  const Lr = 2 * E * s.ry * Math.sqrt(s.J * s.A) / (0.7 * FY * s.Sx);
  if (LbIn > Lr) Mn = Math.min(Mn, 2 * E * s.ry * Math.sqrt(s.J * s.A) / LbIn);
  else if (LbIn > Lp) Mn = Math.min(Mn, Mp - (Mp - 0.7 * FY * s.Sx) * (LbIn - Lp) / (Lr - Lp));
  return Mn / OMEGA_B;
}
function hssRectMinor(s) { return FY * (s.Iy / (s.B / 2)) / OMEGA_B; }
function hssRectShear(s) { return 0.6 * FY * 2 * (s.H - 3 * s.t) * s.t / OMEGA_V; }

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

  // ---- bridge girders: rectangular tubes, two per bridge, trolley rides on a bar rail on top
  const railW = 3.4 / 12;                        // lb/in of 2 x 1/2 in bar rail (kips/in below)
  const wheelG = L.vert / 4, wheelGs = L.live / 4;
  const latWheelG = L.lat / 4;
  const girders = HSS_RECT.filter(s => s.bt <= HSS_LIM.fr && s.ht <= HSS_LIM.wr && s.B <= 8 && s.B >= (pro ? 3 : 4) && s.H >= 2 * s.B - 0.01 && s.H <= 20);
  const g = pickLightest(girders, s => {
    const w = (s.w + 3.4) / 12000;               // kips/in
    const M = twoWheelMoment(wheelG, trolleyWb, S) + w * S * S / 8;
    const Ma = hssRectFlexure(s, S);
    const My = twoWheelMoment(latWheelG, trolleyWb, S);
    const ratio = M / Ma + My / hssRectMinor(s);
    const V = wheelG * (1 + (S - trolleyWb) / S) + w * S / 2;
    const vr = V / hssRectShear(s);
    const d = twoWheelDefl(wheelGs, trolleyWb, S, s.Ix);
    const dr = d / (S / 600);
    return { ok: ratio <= 1 && vr <= 1 && dr <= 1, ratio, vr, d, dr, M, Ma };
  });
  if (!g) return outOfRange(inp, "The bridge girders for this span and capacity are beyond standard tube sections. We will design a welded box girder for you.");
  const G = g.s;
  checks.push(check("Bridge girder bending + lateral", `${round(g.r.ratio, 2)}`, "1.00", "", true, g.r.ratio, `${G.name}, M = ${round(g.r.M / 12, 1)} kip-ft`));
  checks.push(check("Bridge girder deflection", fmtIn(g.r.d), `L/600 = ${fmtIn(S / 600)}`, "in", true, g.r.dr, "Rated load, hoist and trolley"));

  // ---- bridge weight and runway wheel loads
  const etLb = (pro ? 180 : 260) * 2;            // two end trucks incl. wheel blocks and drives
  const bridgeLb = 2 * (G.w + 3.4) * (inp.span + 1) + etLb + (inp.travel === "motorized" ? 120 : 0);
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
    girder: { H: G.H, B: G.B }, runway: { d: R.d, bf: R.bf }, etTube, etWbIn: etWb, topRunwayIn: topRunway,
    underBridgeIn: hUnder, hookIn: hook, headroomIn: L.headroomIn, support: inp.support, motorized: inp.travel === "motorized"
  };

  const members = [
    { role: "Bridge girders", size: G.name.replace(/X/g, "x"), qty: 2, lengthFt: inp.span + 1, lb: 2 * G.w * (inp.span + 1), mat: "hss" },
    { role: "Runway beams", size: R.name.replace(/X/g, "x"), qty: 2, lengthFt: inp.length + 1, lb: 2 * R.w * (inp.length + 1), mat: "w" }
  ];
  const qty = { steel_w: 0, steel_hss: 0, steel_pipe: 0, plate: 0, anchors: 0, hangers: 0 };
  qty.steel_hss += members[0].lb;
  qty.steel_w += members[1].lb;
  qty.plate += 2 * 3.4 * (inp.span + 1);         // rail bars
  let colInfo = null;

  if (inp.support === "free") {
    // ---- columns: cantilevers from the base plate across the bay; knee braces along the runway.
    const hCol = topRunway - R.d;
    const Pcol = twoWheelReaction(Pw, etWb, s) + R.w / 12000 * s;
    const Hcol = twoWheelReaction(Hw, etWb, s);
    const Hcols = twoWheelReaction(Hw, etWb, s);
    const colList = HSS_SQUARE.filter(x => x.bt <= 1.40 * Math.sqrt(E / FY) && x.B >= 4);
    const c = pickLightest(colList, x => {
      const Pc = compression(x.A, x.r, 2.1 * hCol);
      const Mc = hssSqFlexure(x);
      const ratio = interaction(Pcol, Pc, Hcol * hCol, Mc);
      const drift = Hcols * hCol ** 3 / (3 * E * x.I);
      const dr = drift / (hCol / 240);
      return { ok: ratio <= 1 && dr <= 1, ratio, drift, dr };
    });
    if (!c) return outOfRange(inp, "Free-standing columns this tall need bracing or tie-backs. We will engineer the support structure for you.");
    const C = c.s;
    const cols = 2 * (bays + 1);
    const bp = basePlate(C.B, inp.cap >= 2 && inp.span >= 40);
    checks.push(check("Column axial + bending (cantilever across the bay)", `${round(c.r.ratio, 2)}`, "1.00", "", true, c.r.ratio, `${C.name}, ${ftIn(hCol / 12)} tall`));
    checks.push(check("Column top drift, crane lateral load", fmtIn(c.r.drift), `H/240 = ${fmtIn(hCol / 240)}`, "in", true, c.r.dr, ""));
    const colLb = cols * C.w * hCol / 12;
    members.push({ role: "Columns", size: C.name.replace(/X/g, "x"), qty: cols, lengthFt: round(hCol / 12, 1), lb: colLb, mat: "hss" });
    const kneeLb = 2 * (2 * bays) * 3.5 * 6.0;   // HSS3x3x3/16 knee braces, 3.5 ft, two per bay per side
    members.push({ role: "Knee braces", size: "HSS3x3x3/16", qty: 4 * bays, lengthFt: 3.5, lb: kneeLb, mat: "hss" });
    members.push({ role: "Base plates", size: `PL ${bp.t}" x ${bp.size}" x ${bp.size}"`, qty: cols, lengthFt: null, lb: cols * bp.lb, mat: "plate" });
    qty.steel_hss += colLb + kneeLb;
    qty.plate += cols * (bp.lb + 15);           // base plate, cap plate, stiffeners
    qty.anchors += cols * bp.anchors;
    colInfo = { size: C.name, B: C.B, hIn: hCol, count: cols, basePlate: bp, reactionK: Pcol, momentKin: Hcol * hCol };
    geometry.column = { B: C.B, hIn: hCol, basePlate: bp.size };
    assumptions.push("Free-standing runway: columns act as cantilevers from fixed base plates across the bay, with knee braces along the runway. Tie-backs to the building can reduce column size.");
    assumptions.push(`Floor: at least a 4 in reinforced slab in good condition. Anchors and slab are checked by EZUP engineering before order (maximum column load about ${round(Pcol, 1)} kips).`);
  } else {
    qty.hangers = 2 * (bays + 1);
    warnings.push("Runway hung from building steel: the building structure must be checked by EZUP engineering before an order is confirmed.");
    assumptions.push(`Runway hung from existing building steel at ${ftIn(s / 12)} or closer; hanger loads up to about ${round(twoWheelReaction(Pw, etWb, s) + R.w / 12000 * s, 1)} kips each.`);
  }

  if (inp.cap >= 2 && inp.span > 40 && pro) warnings.push("Check the Industrial line for this size.");
  if (hook < 72) warnings.push("Hook height is under 6 ft. Increase the height under the bridge.");

  assumptions.push(`Rated load plus ${IMPACT * 100}% impact, ${HOIST_MODEL[line]} hoist ${L.hoistLb} lb, trolley ${round(L.trolley * 1000)} lb. Lateral load ${LATERAL * 100}% of load, hoist and trolley.`);
  assumptions.push("Bridge girders: rectangular tubes (ASTM A500 Gr C) with a bar rail on top; deflection limit span/600. Runway beams: ASTM A992 W shapes, deflection span/600, top flange takes the crane lateral load.");

  // ---- quantities for pricing (no costs here)
  const conductorFt = inp.travel === "motorized" ? inp.length + inp.span + 10 : inp.span + 10;
  Object.assign(qty, {
    endtrucks: 1, trolleyDouble: 1, hoist: 1, panel: inp.travel === "motorized" ? 1 : 0, radio: inp.control === "radio" ? 1 : 0,
    pendant: inp.control === "pendant" ? 1 : 0, conductorFt, festoonFt: 0, stops: 1, columns: colInfo ? colInfo.count : 0
  });

  const capS = CAP_SHORT[inp.cap];
  const scope = [
    `${TYPES[inp.type].short} top-running double-girder bridge crane, ${CAP_LABEL[inp.cap]} capacity`,
    `Bridge span ${inp.span} ft; girders 2 × ${G.name.replace(/X/g, "x")} with bar rail; EZUP end trucks with polyurethane wheels`,
    `Runway ${inp.length} ft; beams 2 × ${R.name.replace(/X/g, "x")} supported at ${ftIn(s / 12)}` + (colInfo ? `; ${colInfo.count} free-standing columns ${colInfo.size.replace(/X/g, "x")} with base plates and knee braces` : "; hung from existing building steel"),
    `${HOIST_MODEL[line]} ${capS} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley`,
    inp.travel === "motorized" ? `Motorized bridge and trolley travel with variable frequency drives, ${inp.control === "radio" ? "industrial radio control with two transmitters" : "pendant control"}` : `Push-pull bridge and trolley travel, ${inp.control === "radio" ? "radio" : "pendant"} hoist control`,
    inp.travel === "motorized" ? "Enclosed conductor bar on the runway and bridge" : "Conductor bar on the bridge",
    `Power: ${pro ? "120 V single phase" : `${inp.power} V three phase`}, customer supplies a fused disconnect at the runway`
  ];

  return finish(inp, {
    hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions,
    reactions: colInfo ? { columnKips: round(colInfo.reactionK, 1), columnMomentKft: round(colInfo.momentKin / 12, 1) } : null,
    hookFt: hook / 12
  });
}

// ---------------------------------------------------------------- jib crane (free-standing pillar)
function jib(inp) {
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
  if (!best) return outOfRange(inp, "This reach and capacity need a custom jib (larger mast or a wall- or column-mounted design). We will engineer it for you.");
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
    conductorFt: 0, festoonFt: inp.span + 6, stops: 1, columns: 0
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
    "Cable festoon on the boom",
    "Power: customer supplies a fused disconnect at the mast"
  ];
  const geometry = { kind: "jib", reach: inp.span, underBoomIn: hUnder, boom: { d: B.d, bf: B.bf }, mast: { OD: P.OD, hIn: mastH }, basePlate: bp.size, hookIn: hUnder - L.headroomIn - 6, trolleyAtFt: (reach / 12) * 0.75 };
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions, reactions: { overturningKft: round(baseM / 12, 1) }, hookFt: geometry.hookIn / 12 });
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
    radio: inp.control === "radio" ? 1 : 0, pendant: inp.control === "pendant" ? 1 : 0, conductorFt: 0, festoonFt: inp.span + 6, stops: 1, columns: 0
  };
  if (inp.mobility === "casters") assumptions.push(`Casters rated at least ${Math.ceil(casterLb / 100) * 100} lb each; move the gantry only when unloaded, on a smooth level floor.`);
  assumptions.push(`Beam ASTM A992 W shape, deflection limit span/450; A-frame legs ASTM A500 Gr C square tube. Rated load plus ${IMPACT * 100}% impact.`);
  const scope = [
    `Portable A-frame gantry crane, ${CAP_LABEL[inp.cap]} capacity`,
    `Beam ${Bm.name.replace(/X/g, "x")}, span ${inp.span} ft between legs, ${ftIn(inp.height)} under the beam`,
    `A-frame ends in ${Lg.name.replace(/X/g, "x")} with knee braces, ${inp.mobility === "casters" ? `${casterClass}-duty locking swivel casters` : "base plates for anchoring"}`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    "Cable festoon on the beam; power by cord to a customer outlet or disconnect"
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
    conductorFt: inp.travel === "motorized" ? inp.length + 6 : 0, festoonFt: inp.travel === "motorized" ? 0 : inp.length + 6, stops: 1, columns: 0
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
    const c = pickLightest(colList, x => {
      const Pc = compression(x.A, x.r, 2.1 * hCol);
      const ratio = interaction(Rsup / 2, Pc, H / 2 * hCol, hssSqFlexure(x));
      const drift = H / 2 * hCol ** 3 / (3 * E * x.I);
      return { ok: ratio <= 1 && drift <= hCol / 240, ratio, drift };
    });
    if (!hd || !c) return outOfRange(inp, "The support frames for this height need bracing. We will engineer the supports for you.");
    const frames = bays + 1;
    const bp = basePlate(c.s.B, false);
    checks.push(check("Support frame columns", `${round(c.r.ratio, 2)}`, "1.00", "", true, c.r.ratio, `${c.s.name}, ${ftIn(hCol / 12)} tall`));
    members.push({ role: "Support frame headers", size: hd.s.name.replace(/X/g, "x"), qty: frames, lengthFt: 9, lb: frames * hd.s.w * 9, mat: "w" });
    members.push({ role: "Support frame columns", size: c.s.name.replace(/X/g, "x"), qty: 2 * frames, lengthFt: round(hCol / 12, 1), lb: 2 * frames * c.s.w * hCol / 12, mat: "hss" });
    members.push({ role: "Knee braces", size: "HSS3x3x3/16", qty: 4 * frames, lengthFt: 3.5, lb: 4 * frames * 3.5 * 6.0, mat: "hss" });
    qty.steel_w += members[1].lb;
    qty.steel_hss += members[2].lb + members[3].lb;
    qty.plate += 2 * frames * (bp.lb + 15) + frames * 20;
    qty.anchors += 2 * frames * bp.anchors;
    qty.columns = 2 * frames;
    frame = { widthIn: W, header: { d: hd.s.d }, col: { B: c.s.B }, count: frames, hIn: hCol };
    assumptions.push("Free-standing support frames 8 ft wide with knee braces; columns act as cantilevers from fixed base plates across the line.");
  } else {
    qty.hangers = bays + 1;
    warnings.push("Monorail hung from building steel: the building structure must be checked by EZUP engineering before an order is confirmed.");
  }
  assumptions.push(`Beam ASTM A992 W shape, supports at ${ftIn(s / 12)} or closer, deflection limit span/450. Rated load plus ${IMPACT * 100}% impact. Bottom-flange local bending under the trolley wheels is checked in final design.`);
  const scope = [
    `Straight monorail, ${CAP_LABEL[inp.cap]} capacity, ${inp.length} ft long`,
    `Beam ${B.name.replace(/X/g, "x")} with end stops, ${ftIn(inp.height)} under the beam`,
    inp.support === "free" ? `${frame.count} free-standing support frames with base plates and knee braces` : `Hung from existing building steel at ${ftIn(s / 12)} or closer`,
    `${HOIST_MODEL[line]} ${CAP_SHORT[inp.cap]} electric chain hoist on a ${inp.travel === "motorized" ? "motorized" : "push"} trolley, ${inp.control === "radio" ? "radio" : "pendant"} control`,
    inp.travel === "motorized" ? "Conductor bar along the monorail" : "Cable festoon along the monorail",
    "Power: customer supplies a fused disconnect at the monorail"
  ];
  const geometry = { kind: "monorail", length: inp.length, bays, spacingFt: s / 12, underBeamIn: hUnder, beam: { d: B.d, bf: B.bf }, support: inp.support, frame, hookIn: hUnder - L.headroomIn - 6 };
  return finish(inp, { hoistLine: line, loads: L, members, checks, geometry, qty, scope, warnings, assumptions, reactions: { supportKips: round(Rsup, 1) }, hookFt: geometry.hookIn / 12 });
}

// ---------------------------------------------------------------- common wrap-up
function outOfRange(inp, message) {
  return {
    status: "engineer", type: inp.type, title: TYPES[inp.type].name, inputs: inp, message,
    members: [], checks: [], warnings: [message], assumptions: [], scope: [], qty: null,
    geometry: { kind: inp.type === "industrial" || inp.type === "professional" ? "bridge" : inp.type, span: inp.span, length: inp.length, reach: inp.span, outOfRange: true },
    summary: summaryLine(inp)
  };
}

function summaryLine(inp) {
  const T = TYPES[inp.type];
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
    status: "ok", type: inp.type, title: TYPES[inp.type].name, inputs: inp, summary: summaryLine(inp),
    hoist: { model: `${HOIST_MODEL[d.hoistLine]} ${CAP_SHORT[inp.cap]}`, line: d.hoistLine, weightLb: d.loads.hoistLb },
    loads: { ratedLb: inp.cap * 2000, designLb: Math.round(d.loads.vert * 1000), lateralLb: Math.round(d.loads.lat * 1000) },
    members: d.members, checks: d.checks, worstRatio: round(worst, 2), steelLb: Math.round(steelLb),
    geometry: d.geometry, qty: d.qty, scope: d.scope, warnings: d.warnings, assumptions: d.assumptions,
    reactions: d.reactions, hookFt: round(d.hookFt, 1)
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
