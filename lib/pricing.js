// Server-side pricing for web estimates. Runs only in Cloudflare Pages Functions, so costs, margins
// and the bill of materials never reach the browser. Uses the same price table as the internal CPQ
// (KV key "settings"); items missing from that table fall back to the sample costs below.
import { SAMPLE_PRICES, DEFAULT_RULES, todayIso, daysBetween } from "./cpq.js";
import { milesTo } from "./geo.js";
import { CAP_SHORT } from "./craneDesign.js";

// Added for the web configurator. SAMPLE costs: every one must be replaced with a verified cost.
// The web configurator's extra cost items now live in SAMPLE_PRICES (lib/cpq.js), so the CPQ Prices tab lists them.

export const WEB_RULES = { publicPriceMaxAgeDays: 90, freightMin: 350, ltlFactor: 0.5, ltlBelowLb: 2500, crewTravelOverMiles: 100, defaultMiles: 250 };

const HOIST_ID = { 0.25: "q", 0.5: "h", 1: "1", 2: "2", 3: "3" };

export function priceTable(settings) {
  const byId = {};
  for (const p of SAMPLE_PRICES) byId[p.id] = { ...p, sample: true };
  for (const p of (settings && settings.prices) || []) byId[p.id] = { ...p };
  const rules = { ...DEFAULT_RULES, ...WEB_RULES, ...((settings && settings.rules) || {}) };
  return { byId, rules };
}

// design: output of craneDesign.design(). Returns {lines, cost, sell, margin, used, freight, ...}
export function priceDesign(design, table) {
  const { byId, rules } = table;
  const q = design.qty;
  const inp = design.inputs;
  const lines = [];
  const missing = [];
  const add = (id, label, qty) => {
    if (!qty) return;
    const p = byId[id];
    if (!p) { missing.push(id); return; }
    lines.push({ id, label: label || p.name, cat: p.cat, qty: Math.round(qty * 100) / 100, unit: p.unit, cost: p.cost, ext: qty * p.cost });
  };
  const steel = q.steel_w + q.steel_hss + q.steel_pipe + q.plate;
  add("steel_w", "Structural steel, W shapes", Math.round(q.steel_w));
  add("steel_hss", "Structural steel, HSS tube", Math.round(q.steel_hss));
  add("steel_pipe", null, Math.round(q.steel_pipe));
  add("plate", "Plate, bars and connection material", Math.round(q.plate + 0.08 * (q.steel_w + q.steel_hss + q.steel_pipe)));
  add("paint", "Paint and consumables", Math.round(steel * 1.08));
  add("anchor", null, q.anchors);
  add("hanger", null, q.hangers);
  add("stops", null, q.stops);

  const motor = inp.travel === "motorized";
  if (q.endtrucks) add(motor ? "endtruck_m" : "endtruck_p", null, 1);
  if (q.trolleyDouble) add(motor ? "trolley_m" : "trolley_p", null, 1);
  if (q.trolleyUnder) add(motor ? "trolley_ug_m" : "trolley_ug_p", null, 1);
  if (q.jibHead) add("jib_head", null, 1);
  if (q.casters) add("caster_" + q.casters, null, 1);
  add(`hoist_${design.hoist.line}_${HOIST_ID[inp.cap]}`, `${design.hoist.model} electric chain hoist`, q.hoist);
  if (q.panel) add("panel_vfd", null, 1); else add("panel_hoist", null, 1);
  add(inp.control === "radio" ? "radio" : "pendant", null, 1);
  add("conductor", null, q.conductorFt);
  add("festoon", null, q.festoonFt);

  const kind = design.geometry.kind;
  const fabBase = { bridge: 16, jib: 10, gantry: 8, monorail: 10 }[kind] + (q.panel ? 8 : 0);
  const fabHrs = Math.round(fabBase + steel / 1000 * rules.fabHrsPer1000lb);
  add("fab", `Fabrication, assembly and shop wiring (${fabHrs} hr)`, fabHrs);

  const { miles: m, state, offshore } = milesTo(inp.zip);
  const miles = m || rules.defaultMiles;
  let installHrs = 0;
  if (inp.install === "ezup") {
    const g = design.geometry;
    if (kind === "bridge") installHrs = 24 + 0.6 * inp.length + 4 * (q.columns || 0) + 3 * (q.hangers || 0);
    else if (kind === "jib") installHrs = 16;
    else if (kind === "gantry") installHrs = 8;
    else installHrs = 12 + 0.4 * inp.length + 4 * ((g.frame && g.frame.count) || 0) + 3 * (q.hangers || 0);
    installHrs = Math.round(installHrs);
    add("install", `Installation, two-person crew (${installHrs} hr)`, installHrs);
    if (miles > rules.crewTravelOverMiles) {
      const days = Math.max(1, Math.ceil(installHrs / 16));
      add("crew_mile", `Crew travel, ${miles} mi each way`, 2 * miles);
      add("crew_day", `Crew lodging, ${days} day${days > 1 ? "s" : ""}`, days);
    }
  }
  add(kind === "bridge" || kind === "monorail" ? "eng" : "eng_small", "Engineering, drawings and load test", 1);
  const ltl = steel < rules.ltlBelowLb;
  const freightCost = Math.max(rules.freightMin, miles * (byId.freight ? byId.freight.cost : 4.25) * (ltl ? rules.ltlFactor : 1));
  if (byId.freight) lines.push({ id: "freight", label: `Freight to site, about ${miles} mi${ltl ? " (shared load)" : ""}`, cat: "Freight", qty: 1, unit: "load", cost: freightCost, ext: freightCost });

  const cost = lines.reduce((a, l) => a + l.ext, 0);
  const margin = Math.max(rules.minMargin, Math.min(0.6, rules.targetMargin));
  const sell = Math.ceil(cost / (1 - margin) / 100) * 100;
  const used = [...new Set(lines.map(l => l.id))];
  return { lines, cost: Math.round(cost), sell, margin, used, missing, miles, milesKnown: !!m, state, offshore: !!offshore, installHrs, fabHrs };
}

// May this price be shown to the public? mode: "on" | "off" | "verified" (default) | "preview".
export function publicPriceAllowed(table, priced, mode) {
  if (mode === "off") return { ok: false, reason: "Public pricing is turned off." };
  if (priced.offshore) return { ok: false, reason: "Freight to Alaska and Hawaii is quoted separately." };
  if (mode === "on" || mode === "preview") return { ok: true, sample: priced.used.some(id => !table.byId[id] || table.byId[id].sample || !table.byId[id].verified) };
  const today = todayIso();
  const stale = priced.used.filter(id => {
    const p = table.byId[id];
    return !p || !p.verified || daysBetween(p.verified, today) > table.rules.publicPriceMaxAgeDays;
  });
  if (stale.length) return { ok: false, reason: "Costs not verified: " + stale.join(", ") };
  return { ok: true, sample: false };
}

export function capShort(c) { return CAP_SHORT[c]; }
