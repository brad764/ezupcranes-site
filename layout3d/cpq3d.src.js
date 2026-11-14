// 3D model for the configurator: builds an EZUP bridge crane, jib, gantry or monorail from the design
// engine's geometry. Bundled to site/assets/cpq3d.js (see README). Loaded only when the 3D view is opened.
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, BoxGeometry, CylinderGeometry, TorusGeometry, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShadowMaterial, DirectionalLight, HemisphereLight, PMREMGenerator, Vector3, Box3,
  SRGBColorSpace, NeutralToneMapping, PCFShadowMap, CanvasTexture, BufferGeometry, Float32BufferAttribute, LineSegments,
  LineBasicMaterial
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FT = 0.3048;

function mat(color, rough, metal) {
  return new MeshStandardMaterial({ color, roughness: rough, metalness: metal || 0 });
}

export function mount(host, opts) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('tabindex', '0');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return null;
  }
  host.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  scene.add(new HemisphereLight(0xffffff, 0x9a9890, 0.55));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  const ground = new Mesh(new PlaneGeometry(600, 600), new ShadowMaterial({ opacity: 0.26 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const M = {
    yellow: mat(0xf2c200, 0.34), gray: mat(0x727880, 0.45), red: mat(0xb5202a, 0.36), orange: mat(0xea5f1a, 0.5),
    white: mat(0xe6e6e3, 0.4), black: mat(0x17181a, 0.55), zinc: mat(0xa9adb2, 0.38, 0.9), silver: mat(0xbfc4ca, 0.38, 0.5),
    poly: mat(0xc63a30, 0.5), wood: mat(0xc8a36d, 0.75)
  };
  const lineMat = new LineBasicMaterial({ color: opts.ink || 0x1c1e21 });

  const cam = new PerspectiveCamera(30, 1, 0.1, 800);
  const view = { az: 0.6, el: 0.24, dist: 20, target: new Vector3() };
  let corners = [];
  let model = null, labels = [], plate = null, state = null;

  // nameplate texture: logo plus capacity, redrawn when the capacity changes
  const pc = document.createElement('canvas');
  pc.width = 860; pc.height = 200;
  const ptex = new CanvasTexture(pc);
  ptex.colorSpace = SRGBColorSpace;
  ptex.anisotropy = 4;
  const logo = new Image();
  logo.onload = function () { drawPlate(); render(); };
  if (opts.logo) logo.src = opts.logo;
  function drawPlate() {
    const g = pc.getContext('2d');
    g.fillStyle = '#f6f6f3'; g.fillRect(0, 0, pc.width, pc.height);
    g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(5, 5, pc.width - 10, pc.height - 10);
    if (logo.complete && logo.naturalWidth) g.drawImage(logo, 26, 34, 400, 132);
    g.fillStyle = '#1c1e21';
    g.font = '700 118px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(state ? state.capLabel : '', 462, 106);
    ptex.needsUpdate = true;
  }

  function box(g, w, h, d, x, y, z, m) {
    const o = new Mesh(new BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true; o.receiveShadow = true;
    g.add(o);
    return o;
  }
  function cyl(g, r, len, x, y, z, m, axis) {
    const o = new Mesh(new CylinderGeometry(r, r, len, 24), m);
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  }
  function ibeamZ(g, d, bf, len, x, yTop, z, m) {           // I-beam running along Z
    const tf = 0.012, tw = 0.008;
    box(g, bf, tf, len, x, yTop - tf / 2, z, m);
    box(g, bf, tf, len, x, yTop - d + tf / 2, z, m);
    box(g, tw, d - 2 * tf, len, x, yTop - d / 2, z, m);
  }
  function dimLine(pts, a, b, tick) {
    pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (const p of [a, b]) pts.push(p.x - tick.x, p.y - tick.y, p.z - tick.z, p.x + tick.x, p.y + tick.y, p.z + tick.z);
  }

  const IN = 0.0254;
  function hoist(g, x, yTop, z, hookY, sc, alongX) {
    // trolley/hoist body, chain and hook below a suspension point at (x, yTop, z)
    const s = sc || 1;
    box(g, alongX ? 0.30 * s : 0.22 * s, 0.25 * s, alongX ? 0.22 * s : 0.30 * s, x, yTop - 0.125 * s, z, M.silver);
    if (alongX) cyl(g, 0.098 * s, 0.24 * s, x + 0.27 * s, yTop - 0.125 * s, z, M.silver, 'x');
    else cyl(g, 0.098 * s, 0.24 * s, x, yTop - 0.125 * s, z + 0.27 * s, M.silver, 'z');
    box(g, 0.17 * s, 0.3 * s, 0.15 * s, x - (alongX ? 0.12 * s : 0), yTop - 0.4 * s, z - (alongX ? 0 : 0.12 * s), M.black);
    const top = yTop - 0.25 * s;
    const hy = Math.min(hookY, top - 0.2);
    cyl(g, 0.007, top - hy, x + 0.04, (top + hy) / 2, z, M.black, 'y');
    box(g, 0.075, 0.1, 0.062, x + 0.04, hy - 0.05, z, M.yellow);
    const hk = new Mesh(new TorusGeometry(0.05, 0.018, 10, 20, Math.PI * 1.5), M.black);
    hk.position.set(x + 0.04, hy - 0.18, z); hk.rotation.z = Math.PI * 0.75; hk.castShadow = true;
    g.add(hk);
  }
  function ibeamX(g, d, bf, len, x, yTop, z, m) {           // I-beam running along X
    const tf = Math.max(0.008, d * 0.06), tw = Math.max(0.006, d * 0.035);
    box(g, len, tf, bf, x, yTop - tf / 2, z, m);
    box(g, len, tf, bf, x, yTop - d + tf / 2, z, m);
    box(g, len, d - 2 * tf, tw, x, yTop - d / 2, z, m);
  }
  function plateAt(g, x, z, w) { box(g, w, 0.025, w, x, 0.0125, z, M.gray); }

  function buildBridge(G) {
    const g = new Group();
    const S = G.span * FT, L = G.length * FT;
    const tube = G.etTube * IN, d = G.runway.d * IN, bf = G.runway.bf * IN;
    const Hr = G.topRunwayIn * IN;
    const bays = G.bays, col = (G.column ? G.column.B : 6) * IN;
    const free = G.support === 'free';
    for (const sx of [-1, 1]) {
      const x = sx * S / 2;
      for (let i = 0; i <= bays; i++) {
        const z = -L / 2 + i * L / bays;
        if (free) {
          plateAt(g, x, z, (G.column.basePlate || 16) * IN);
          box(g, col, Hr - d - 0.025, col, x, 0.025 + (Hr - d - 0.025) / 2, z, M.gray);
          for (const dir of [-1, 1]) {
            if ((i === 0 && dir < 0) || (i === bays && dir > 0)) continue;
            const k = Math.min(0.85, Hr * 0.3);
            const br = box(g, 0.064, 0.064, k * Math.SQRT2, x, Hr - d - k / 2, z + dir * (col / 2 + k / 2), M.gray);
            br.rotation.x = -dir * Math.PI / 4;
          }
        } else {
          cyl(g, 0.012, 1.0, x, Hr + 0.5, z, M.zinc, 'y');
        }
      }
      ibeamZ(g, d, bf, L + 0.5, x, Hr, 0, M.gray);
      if (!free) box(g, 0.25, 0.35, L + 1.5, x, Hr + 1.18, 0, M.gray);
      for (const e of [-1, 1]) box(g, bf * 0.8, 0.2, 0.1, x, Hr + 0.1, e * (L / 2 + 0.18), M.yellow);
    }
    if (G.motorized) for (let i = 0; i < 4; i++) box(g, 0.014, 0.022, L + 0.3, S / 2 + bf / 2 + 0.05, Hr - 0.25 + i * 0.034, 0, M.orange);
    const zb = L / 2 - Math.min(L * 0.3, 3.0) - 0.9;
    const Lt = G.etWbIn * IN + 0.2, gs = G.girderCtrsIn * IN, gw = G.girder.B * IN, gh = G.girder.H * IN;
    const yT = Hr + 0.035 + tube / 2, gy0 = Hr + 0.035 + tube;
    for (const sx of [-1, 1]) {
      const x = sx * S / 2;
      box(g, tube, tube, Lt, x, yT, zb, M.yellow);
      for (const e of [-1, 1]) {
        const zp = zb + e * (Lt / 2 + 0.09);
        box(g, 0.19, 0.26, 0.19, x, Hr + 0.142, zp, M.yellow);
        cyl(g, 0.085, 0.2, x, Hr + 0.085, zp, M.poly, 'x');
        cyl(g, 0.036, 0.06, x, Hr + 0.13, zp + e * 0.12, M.black, 'z');
        box(g, 0.1, 0.3, 0.1, x, gy0 + 0.15, zb + e * (gs / 2 + gw / 2 + 0.07), M.yellow);
      }
      if (G.motorized) {
        box(g, 0.2, 0.23, 0.19, x - sx * 0.18, yT - 0.01, zb + Lt / 2 - 0.02, M.black);
        cyl(g, 0.075, 0.26, x - sx * 0.18, yT + 0.02, zb + Lt / 2 - 0.25, M.black, 'z');
      }
    }
    for (const e of [-1, 1]) {
      box(g, S + tube + 0.04, gh, gw, 0, gy0 + gh / 2, zb + e * gs / 2, M.yellow);
      box(g, S + tube - 0.05, 0.012, 0.05, 0, gy0 + gh + 0.006, zb + e * gs / 2, M.zinc);
    }
    const yRail = gy0 + gh + 0.012, zFace = zb + gs / 2 + gw / 2;
    if (G.motorized) {
      for (let i = 0; i < 4; i++) box(g, S - 1.3, 0.022, 0.014, -0.35, gy0 + 0.035 + i * 0.034, zFace + 0.05, M.orange);
      box(g, 0.4, 0.5, 0.2, S / 2 - 0.62, gy0 + gh - 0.22, zFace + 0.1, M.white);
    }
    const ph = Math.min(0.15, gh * 0.5), pw = ph * 4.3;
    plate = new Mesh(new PlaneGeometry(pw, ph), new MeshBasicMaterial({ map: ptex }));
    plate.position.set(Math.max(-S / 2 + pw, S / 2 - 2.2), gy0 + gh - ph / 2 - 0.02, zFace + 0.0015);
    g.add(plate);
    const xt = -S * 0.16, ys = yRail + 0.155;
    for (const e of [-1, 1]) {
      box(g, 0.84, 0.076, 0.076, xt, ys, zb + e * gs / 2, M.red);
      for (const sx of [-1, 1]) cyl(g, 0.055, 0.045, xt + sx * 0.33, yRail + 0.055, zb + e * gs / 2, M.poly, 'z');
    }
    for (const sx of [-1, 1]) box(g, 0.076, 0.076, gs, xt + sx * 0.2, ys, zb, M.red);
    box(g, 0.012, 0.44, 0.09, xt - 0.05, ys - 0.26, zb, M.red);
    box(g, 0.012, 0.44, 0.09, xt + 0.05, ys - 0.26, zb, M.red);
    hoist(g, xt, ys - 0.48, zb, G.hookIn * IN, 1, true);
    return g;
  }

  function buildJib(G) {
    const g = new Group();
    const R = G.reach * FT, H = G.underBoomIn * IN, od = G.mast.OD * IN, mh = G.mast.hIn * IN, bd = G.boom.d * IN, bf = G.boom.bf * IN;
    plateAt(g, 0, 0, G.basePlate * IN);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = od / 2 + 0.09;
      const gu = box(g, 0.012, 0.3, 0.18, Math.cos(a) * r, 0.17, Math.sin(a) * r, M.yellow);
      gu.rotation.y = -a;
    }
    cyl(g, od / 2, mh, 0, mh / 2, 0, M.yellow, 'y');
    cyl(g, od / 2 + 0.03, 0.12, 0, mh + 0.06, 0, M.yellow, 'y');
    ibeamX(g, bd, bf, R, R / 2, H + bd, 0, M.yellow);
    const k = Math.min(R * 0.4, 1.1);
    const br = box(g, k * Math.SQRT2, 0.08, 0.08, od / 2 + k / 2, H - k / 2, 0, M.yellow);
    br.rotation.z = Math.PI / 4;
    box(g, 0.02, bd + 0.02, bf + 0.02, R, H + bd / 2, 0, M.yellow);
    const xt = R * 0.72;
    box(g, 0.3, 0.1, bf + 0.08, xt, H - 0.05, 0, M.red);
    hoist(g, xt, H - 0.1, 0, G.hookIn * IN, 0.8, true);
    return g;
  }

  function buildGantry(G) {
    const g = new Group();
    const S = G.span * FT, H = G.underBeamIn * IN, bd = G.beam.d * IN, bf = G.beam.bf * IN, sp = G.spreadIn * IN, ch = G.casterIn * IN, lb = G.leg.B * IN;
    ibeamX(g, bd, bf, S + 0.6, 0, H + bd, 0, M.yellow);
    const yb = ch + 0.05;
    for (const sx of [-1, 1]) {
      const x = sx * S / 2;
      box(g, lb, 0.08, sp + 0.3, x, yb + 0.04, 0, M.yellow);
      const legL = Math.hypot(H - yb, sp / 2);
      const ang = Math.atan2(sp / 2, H - yb);
      for (const sz of [-1, 1]) {
        const leg = box(g, lb, legL, lb, x, (H + yb) / 2, sz * sp / 4, M.yellow);
        leg.rotation.x = -sz * ang;
        if (ch) { cyl(g, ch / 2, 0.05, x, ch / 2, sz * sp / 2, M.black, 'x'); box(g, 0.08, 0.05, 0.08, x, ch + 0.02, sz * sp / 2, M.zinc); }
        else box(g, 0.25, 0.02, 0.25, x, 0.01, sz * sp / 2, M.gray);
      }
      const yc = yb + (H - yb) * 0.45;
      box(g, lb * 0.8, lb * 0.8, sp * (1 - 0.45) , x, yc, 0, M.yellow);
      const k = 0.7;
      const kb = box(g, k * Math.SQRT2, 0.06, 0.06, x - sx * k / 2, H - k / 2, 0, M.yellow);
      kb.rotation.z = -sx * Math.PI / 4;
      box(g, 0.3, 0.02, 0.3, x, H + 0.01, 0, M.yellow);
    }
    const xt = S * -0.05;
    box(g, 0.3, 0.1, bf + 0.08, xt, H - 0.05, 0, M.red);
    hoist(g, xt, H - 0.1, 0, G.hookIn * IN, 0.8, true);
    return g;
  }

  function buildMonorail(G) {
    const g = new Group();
    const L = G.length * FT, H = G.underBeamIn * IN, bd = G.beam.d * IN, bf = G.beam.bf * IN, sp = G.spacingFt * FT;
    ibeamX(g, bd, bf, L, 0, H + bd, 0, M.yellow);
    for (const e of [-1, 1]) box(g, 0.02, bd * 0.5, bf + 0.03, e * (L / 2 - 0.08), H + bd * 0.25, 0, M.yellow);
    for (let i = 0; i <= G.bays; i++) {
      const x = -L / 2 + i * sp;
      if (G.support === 'free' && G.frame) {
        const W = G.frame.widthIn * IN, cb = G.frame.col.B * IN, hd = G.frame.header.d * IN, top = H + bd + hd;
        ibeamZ(g, hd, 0.13, W + 0.4, x, top, 0, M.gray);
        for (const sz of [-1, 1]) {
          plateAt(g, x, sz * W / 2, cb + 0.2);
          box(g, cb, top - hd - 0.025, cb, x, 0.025 + (top - hd - 0.025) / 2, sz * W / 2, M.gray);
          const k = 0.75;
          const kb = box(g, 0.06, k * Math.SQRT2, 0.06, x, top - hd - k / 2, sz * (W / 2 - k / 2), M.gray);
          kb.rotation.x = -sz * Math.PI / 4;
        }
      } else {
        cyl(g, 0.012, 1.0, x, H + bd + 0.5, 0, M.zinc, 'y');
      }
    }
    if (G.support !== 'free') box(g, L + 1.5, 0.35, 0.25, 0, H + bd + 1.18, 0, M.gray);
    const xt = -L * 0.2;
    box(g, 0.3, 0.1, bf + 0.08, xt, H - 0.05, 0, M.red);
    hoist(g, xt, H - 0.1, 0, G.hookIn * IN, 0.8, true);
    return g;
  }

  function build(d) {
    const G = d.geometry;
    labels = [];
    if (G.kind === 'bridge') return buildBridge(G);
    if (G.kind === 'jib') return buildJib(G);
    if (G.kind === 'gantry') return buildGantry(G);
    return buildMonorail(G);
  }

  function frame() {
    const b = new Box3().setFromObject(model);
    const c = b.getCenter(new Vector3());
    const r = b.getSize(new Vector3()).length() / 2;
    view.target.copy(c);
    corners = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners.push(new Vector3(x - c.x, y - c.y, z - c.z));
    cam.far = r * 12;
    const sc = r * 1.3;
    const sh = sun.shadow.camera;
    sh.left = -sc; sh.right = sc; sh.top = sc; sh.bottom = -sc; sh.near = 0.5; sh.far = r * 8;
    sh.updateProjectionMatrix();
    sun.position.set(c.x - r * 1.4, r * 2.6, c.z + r * 1.9);
    sun.target.position.copy(c);
  }

  // distance at which every corner of the model sits inside the view for the current angle
  function fitDistance() {
    const ce = Math.cos(view.el), se = Math.sin(view.el), sa = Math.sin(view.az), ca = Math.cos(view.az);
    const n = new Vector3(ce * sa, se, ce * ca);                 // target -> camera
    const right = new Vector3(ca, 0, -sa);
    const up = new Vector3().crossVectors(n, right);
    const tv = Math.tan(cam.fov * Math.PI / 360), th = tv * cam.aspect;
    let d = 1;
    for (const q of corners) {
      const dn = q.dot(n);
      d = Math.max(d, Math.abs(q.dot(right)) / th + dn, Math.abs(q.dot(up)) / tv + dn);
    }
    return d * 1.07;
  }

  function render() {
    if (!model) return;
    const ce = Math.cos(view.el);
    view.dist = fitDistance();
    cam.position.set(view.target.x + view.dist * ce * Math.sin(view.az), view.target.y + view.dist * Math.sin(view.el),
      view.target.z + view.dist * ce * Math.cos(view.az));
    cam.lookAt(view.target);
    cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    if (opts.onLabels) {
      const w = host.clientWidth, h = host.clientHeight, out = {};
      for (const l of labels) {
        const v = l.p.clone().project(cam);
        out[l.key] = { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, on: v.z < 1 };
      }
      opts.onLabels(out);
    }
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    if (model) frame();
    render();
  }

  function update(d) {
    if (!d || d.status !== 'ok') return false;
    state = { capLabel: d.capPlate || '' };
    if (model) {
      scene.remove(model);
      model.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    }
    model = build(d);
    scene.add(model);
    drawPlate();
    frame();
    render();
    canvas.setAttribute('aria-label', 'Three-dimensional model: ' + d.summary + '. Drag or use the arrow keys to rotate.');
    return true;
  }

  // PNG of the current view at a fixed size, for the printed quote.
  function snapshot(w, h) {
    const W = w || 1200, H = h || 900;
    const prev = { w: renderer.domElement.width, h: renderer.domElement.height, a: cam.aspect, pr: renderer.getPixelRatio() };
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    frame(); render();
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(prev.pr);
    resize();
    return url;
  }

  // drag to rotate; vertical page scrolling still works on touch screens
  let drag = null;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, az: view.az, el: view.el };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    if (opts.onInteract) opts.onInteract();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    view.az = drag.az - (e.clientX - drag.x) * 0.008;
    view.el = Math.max(0.04, Math.min(1.1, drag.el + (e.clientY - drag.y) * 0.005));
    render();
  });
  function end() { drag = null; canvas.style.cursor = 'grab'; }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', function (e) {
    const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
    if (!k) return;
    e.preventDefault();
    view.az += k[0];
    view.el = Math.max(0.04, Math.min(1.1, view.el + k[1]));
    render();
    if (opts.onInteract) opts.onInteract();
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { drawPlate(); render(); });

  return { update, resize, snapshot, reset: function () { view.az = 0.6; view.el = 0.24; render(); } };
}
