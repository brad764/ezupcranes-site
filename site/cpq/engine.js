// EZUP CPQ configuration and pricing engine.
// Pure functions: configure(inputs, prices, rules) -> recommendation, BOM, cost, sell.
// Sizing tables below are PRELIMINARY placeholders until tied to the Crane Bridge Girder Designer.
(function (root) {
  const SHAPES = {
    "W8x18": { w: 18, Ix: 61.9, Sx: 15.2 }, "W10x22": { w: 22, Ix: 118, Sx: 23.2 }, "W10x33": { w: 33, Ix: 171, Sx: 35.0 },
    "W12x26": { w: 26, Ix: 204, Sx: 33.4 }, "W12x35": { w: 35, Ix: 285, Sx: 45.6 }, "W14x30": { w: 30, Ix: 291, Sx: 42.0 },
    "W14x38": { w: 38, Ix: 385, Sx: 54.6 }, "W16x31": { w: 31, Ix: 375, Sx: 47.2 }, "W16x40": { w: 40, Ix: 518, Sx: 64.7 },
    "W18x46": { w: 46, Ix: 712, Sx: 78.8 }, "W21x50": { w: 50, Ix: 984, Sx: 94.5 }, "W24x55": { w: 55, Ix: 1350, Sx: 114 }
  };
  const SPAN_BANDS = [20, 30, 40, 50, 60];
  const GIRDERS = {
    "0.5": ["W8x18", "W10x22", "W12x26", "W14x30", "W16x31"],
    "1": ["W10x22", "W12x26", "W14x30", "W16x40", "W18x46"],
    "2": ["W10x33", "W12x35", "W16x40", "W18x46", "W21x50"],
    "3": ["W12x35", "W14x38", "W18x46", "W21x50", "W24x55"]
  };
  const RUNWAY_BEAM = { "0.5": "W8x18", "1": "W10x22", "2": "W12x26", "3": "W12x35" };
  const HOIST = {
    industrial: { "0.5": ["DC-Pro 1/2 t", 90], "1": ["DC-Pro 1 t", 110], "2": ["DC-Pro 2 t", 150], "3": ["DC-Pro 3 t", 230] },
    professional: { "0.5": ["DC-Com 1/2 t", 70], "1": ["DC-Com 1 t", 90] }
  };
  const CAP_LABEL = { "0.5": "1/2 ton (1,000 lb)", "1": "1 ton (2,000 lb)", "2": "2 ton (4,000 lb)", "3": "3 ton (6,000 lb)" };
  const E = 29000000;
  const HSS6_LB_FT = 19.02;
  const PLATE_LB_PER_COLUMN = 60;

  function configure(inp, prices, rules, marginPct) {
    const notes = [];
    const P = id => prices.find(p => p.id === id);
    const cap = String(inp.cap);
    const wantsProfessional = inp.power === "120";
    const line = wantsProfessional && Number(cap) <= rules.professionalMaxTons ? "professional" : "industrial";
    if (wantsProfessional && line === "industrial") notes.push(`120 V single phase covers the Professional line up to ${rules.professionalMaxTons} ton. Priced as Industrial on 3-phase; confirm power with the customer.`);
    const span = Math.min(Math.max(Number(inp.span) || 30, 8), 60);
    if (Number(inp.span) > 60) notes.push("Spans over 60 ft are outside the EZUP range. Priced at 60 ft; engineer a custom bridge.");
    const runway = Math.max(10, Number(inp.runway) || 40);
    const height = Math.max(8, Number(inp.height) || 14);
    const band = SPAN_BANDS.findIndex(b => span <= b);
    const girder = GIRDERS[cap][band];
    const g = SHAPES[girder];
    const [hoistModel, hoistWt] = HOIST[line][cap];
    const motorized = inp.op !== "manual";
    if (!motorized && Number(cap) > 1) notes.push("Push-pull travel above 1 ton is hard on operators. Consider motorized travel.");
    const free = inp.support === "free";
    if (!free) notes.push("Hung from building steel: check the building structure before issuing.");
    const bays = Math.max(1, Math.ceil(runway / rules.maxColumnSpacing));
    const colsPerSide = bays + 1;
    const runwayBeam = RUNWAY_BEAM[cap];

    const bridgeSteel = 2 * span * g.w;
    const runwaySteel = 2 * runway * SHAPES[runwayBeam].w;
    const colSteel = free ? 2 * colsPerSide * height * HSS6_LB_FT : 0;
    const plateSteel = free ? 2 * colsPerSide * PLATE_LB_PER_COLUMN : 0;
    const steelTotal = bridgeSteel + runwaySteel + colSteel + plateSteel;

    const liftLb = Number(cap) * 2000;
    const trolleyWt = motorized ? 350 : 200;
    const Pg = ((liftLb + hoistWt) * (1 + rules.impact) + trolleyWt) / 2;
    const L = span * 12, w = g.w / 12;
    const M = Pg * L / 4 + w * L * L / 8;
    const fb = M / g.Sx;
    const defl = Pg * Math.pow(L, 3) / (48 * E * g.Ix);
    const ratio = L / defl;

    const bom = [];
    const add = (id, label, qty) => {
      const p = P(id);
      if (!p) { notes.push(`Missing price item "${id}" in the price table.`); return; }
      bom.push({ id, label: label || p.name, cat: p.cat, qty, unit: p.unit, cost: p.cost, ext: qty * p.cost });
    };
    add("steel_w", `Bridge girders, 2 x ${girder} x ${span} ft`, Math.round(bridgeSteel));
    add("steel_w", `Runway beams, 2 x ${runwayBeam} x ${runway} ft`, Math.round(runwaySteel));
    if (free) {
      add("steel_hss", `Columns, ${2 * colsPerSide} x HSS6x6x1/4 x ${height} ft`, Math.round(colSteel));
      add("plate", `Base plates and caps, ${2 * colsPerSide} sets`, Math.round(plateSteel));
    } else add("hanger", `Runway hangers at ${rules.maxColumnSpacing} ft`, 2 * colsPerSide);
    add("paint", "Paint and consumables", Math.round(steelTotal));
    add(motorized ? "endtruck_m" : "endtruck_p", null, 1);
    add(motorized ? "trolley_m" : "trolley_p", null, 1);
    add(line === "industrial" ? "hoist_pro" : "hoist_com", `Demag ${hoistModel} hoist`, 1);
    if (motorized) {
      add("panel_vfd", null, 1);
      add(inp.op === "radio" ? "radio" : "pendant", null, 1);
      add("conductor", "Conductor bar, runway and bridge", Math.round(runway + span));
    }
    const fabHrs = Math.round(steelTotal / 1000 * rules.fabHrsPer1000lb + rules.fabBaseHrs);
    add("fab", `Fabrication and assembly (${fabHrs} hr)`, fabHrs);
    if (inp.install === "ezup") {
      const instHrs = Math.round(rules.installBaseHrs + runway * rules.installHrsPerFtRunway + colsPerSide * (free ? rules.installHrsPerColumnFree : rules.installHrsPerHanger));
      add("install", `Installation crew (${instHrs} hr)`, instHrs);
    }
    add("eng", "Engineering, drawings and load test", 1);
    add("freight", "Freight to site", Math.max(50, Number(inp.miles) || 0));

    for (const extra of inp.extras || []) {
      const qty = Number(extra.qty) || 0, cost = Number(extra.cost) || 0;
      if (extra.label && qty) bom.push({ id: "", label: String(extra.label), cat: "Other", qty, unit: extra.unit || "ea", cost, ext: qty * cost });
    }

    const cost = bom.reduce((s, r) => s + r.ext, 0);
    let margin = Number.isFinite(marginPct) && marginPct > 0 ? marginPct / 100 : rules.targetMargin;
    if (margin < rules.minMargin) { notes.push(`Margin can't go below ${Math.round(rules.minMargin * 100)}%. Priced at ${Math.round(rules.minMargin * 100)}%.`); margin = rules.minMargin; }
    if (margin > 0.6) margin = 0.6;
    const sell = Math.ceil(cost / (1 - margin) / 50) * 50;

    const lineName = line === "industrial" ? "EZUP Industrial" : "EZUP Professional";
    const capLabel = CAP_LABEL[cap];
    const travel = motorized ? (inp.op === "radio" ? "Motorized bridge and trolley travel with variable frequency drives, industrial radio control with two transmitters" : "Motorized bridge and trolley travel with variable frequency drives, pendant control") : "Push-pull bridge and trolley travel";
    const scope = [
      `${lineName} top-running double-girder workstation crane, ${capLabel} capacity`,
      `Bridge span ${span} ft, girders 2 x ${girder}`,
      `Runway ${runway} ft, beams 2 x ${runwayBeam}, ${free ? `${2 * colsPerSide} free-standing columns, ${height} ft under runway` : "hung from existing building steel (subject to structural review)"}`,
      `Demag ${hoistModel} electric chain hoist`,
      travel,
      motorized ? "Conductor bar power feed on runway and bridge" : null,
      "Engineering, stamped drawings and load test certificate",
      inp.install === "ezup" ? "Delivery and installation by EZUP" : `Delivery to site (${Number(inp.miles) || 0} mi); installation by others`
    ].filter(Boolean);
    for (const extra of inp.extras || []) if (extra.label && Number(extra.qty)) scope.push(String(extra.label));

    return {
      line, lineName, capLabel, span, runway, height, girder, runwayBeam, hoistModel, motorized, free, colsPerSide,
      steelTotal, bom, cost, sell, margin, notes, scope,
      summary: `${lineName} ${capLabel.split(" (")[0]}, ${span} ft span x ${runway} ft runway`,
      check: { Pg, fb, defl, ratio, deflOk: ratio >= rules.deflLimit }
    };
  }

  root.EZUPEngine = { configure, CAP_LABEL };
})(typeof window !== "undefined" ? window : globalThis);
