// Approximate road miles from the EZUP shop (Cedar Bluff, VA) to a US ZIP code, for freight and
// crew travel in budget estimates. ZIP prefix -> state -> state geographic centre; good to a few
// hundred miles in large states, which is all a budget estimate needs.
const SHOP = [37.087, -81.759];
const ROAD_FACTOR = 1.25;

const RANGES = [
  [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"], [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"],
  [100, 149, "NY"], [150, 196, "PA"], [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"],
  [247, 268, "WV"], [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
  [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"], [460, 479, "IN"],
  [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"], [570, 577, "SD"], [580, 588, "ND"],
  [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"], [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"],
  [716, 729, "AR"], [730, 749, "OK"], [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"],
  [840, 847, "UT"], [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"], [900, 961, "CA"],
  [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"]
];

const CENTRE = {
  AL: [32.8, -86.8], AZ: [34.2, -111.6], AR: [34.9, -92.4], CA: [37.2, -119.5], CO: [39.0, -105.5], CT: [41.6, -72.7],
  DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4], GA: [32.7, -83.4], ID: [44.4, -114.6], IL: [40.0, -89.2],
  IN: [39.9, -86.3], IA: [42.1, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.1, -92.0], ME: [45.4, -69.2],
  MD: [39.0, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5],
  MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1],
  NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6],
  PA: [40.9, -77.8], RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3],
  UT: [39.3, -111.7], VT: [44.1, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9],
  WY: [43.0, -107.6]
};

// Road miles for ZIP prefixes near the shop, where the state-centre estimate is too coarse.
const NEAR = {
  220: 330, 221: 330, 222: 330, 223: 330, 224: 290, 225: 290, 226: 300, 227: 270, 228: 220, 229: 230, 230: 280, 231: 280,
  232: 280, 233: 380, 234: 380, 235: 380, 236: 380, 237: 380, 238: 260, 239: 200, 240: 110, 241: 110, 242: 60, 243: 70,
  244: 190, 245: 170, 246: 20, 247: 20, 248: 25, 249: 90, 250: 120, 251: 120, 252: 120, 253: 120, 254: 300, 255: 150,
  256: 150, 257: 150, 258: 60, 259: 60, 260: 300, 261: 230, 262: 220, 263: 220, 264: 220, 265: 220, 266: 220, 267: 290,
  268: 230, 270: 160, 271: 160, 272: 160, 273: 160, 274: 160, 275: 230, 276: 230, 277: 230, 278: 300, 279: 370, 280: 180,
  281: 180, 282: 180, 283: 280, 284: 360, 285: 330, 286: 160, 287: 190, 288: 190, 289: 270, 370: 330, 371: 330, 372: 330,
  373: 250, 374: 250, 376: 110, 377: 170, 378: 170, 379: 170, 405: 260, 406: 260, 407: 190, 408: 190, 409: 190,
  410: 330, 411: 160, 412: 160, 413: 160, 414: 160, 415: 100, 416: 100, 417: 150, 418: 150
};

export function stateForZip(zip) {
  const z = String(zip || "").replace(/\D/g, "");
  if (z.length < 3) return null;
  const p = Number(z.slice(0, 3));
  const r = RANGES.find(([a, b]) => p >= a && p <= b);
  return r ? r[2] : null;
}

export function milesTo(zip) {
  const st = stateForZip(zip);
  if (!st) return { state: null, miles: null };
  if (st === "HI" || st === "AK") return { state: st, miles: null, offshore: true };
  const near = NEAR[Number(String(zip).replace(/\D/g, "").slice(0, 3))];
  if (near) return { state: st, miles: near };
  const [a, b] = CENTRE[st];
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (a - SHOP[0]) * rad, dLon = (b - SHOP[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(SHOP[0] * rad) * Math.cos(a * rad) * Math.sin(dLon / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
  return { state: st, miles: Math.max(60, Math.round(miles / 10) * 10) };
}
