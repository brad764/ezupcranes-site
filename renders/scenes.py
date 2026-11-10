"""Scene definitions. Each builds a scene and returns camera/lighting settings; run with render.py."""
import math, os, random
from mathutils import Vector, Matrix
import kit
from kit import *
from parts import *
import parts


def _turtle(start, heading, segs):
    """Polyline from straight ('s', length) and arc ('a', radius, degrees; + turns toward +X) segments.
    heading in radians measured from +Y toward +X."""
    pts = [Vector((start[0], start[1], 0.0))]
    h = heading
    for seg in segs:
        if seg[0] == 's':
            n = max(1, int(seg[1] / 0.2))
            for _ in range(n):
                pts.append(pts[-1] + Vector((math.sin(h), math.cos(h), 0)) * (seg[1] / n))
        else:
            R, deg = seg[1], seg[2]
            n = max(6, int(abs(deg) / 3))
            dth = math.radians(deg) / n
            ds = R * abs(dth)
            for _ in range(n):
                h += dth / 2
                pts.append(pts[-1] + Vector((math.sin(h), math.cos(h), 0)) * ds)
                h += dth / 2
    return pts


def _nameplate(m, tex, loc, normal, h=0.11):
    pm = image_mat('plate_' + tex, os.path.join(parts.TEX, tex), rough=0.3)
    return plane('nameplate', h * 4.3, h, pm, loc, normal=normal)


# ============================================================ EZUP
def ezup_industrial(m):
    S, L, H = 24 * FT, 30 * FT, 12 * FT
    runway(S, L, H, m, bays=2)
    yb = -L / 2 + 2.3
    xt = -1.1
    o, bowl, g = ezup_bridge(S, yb, H, m, xt=xt, drop=1.45, near=-1, panel_end=1)
    conductor_bars((S / 2 + 0.0825, -L / 2 - 0.1, H - 0.25), (S / 2 + 0.0825, L / 2 + 0.1, H - 0.25), (1, 0, 0), m, every=1.5)
    c = crate(m, (1.1, 0.8, 0.75))
    place(c, (xt + 0.04, yb, 0.55), 0.0, 'crate')
    top = 0.55 + 0.77
    sling_legs(bowl, [(xt + 0.04 + sx * 0.45, yb + sy * 0.3, top) for sx in (-1, 1) for sy in (-1, 1)], m, r=0.008)
    place(pallet(m), (xt + 0.04, yb, 0), 0.0, 'pallet')
    tube, gh, gs, gw = 6 * IN, 14 * IN, 30 * IN, 4 * IN
    gz0 = H + 0.035 + tube
    ztop = gz0 + gh + 0.012
    yface = yb - gs / 2 - gw / 2
    marks = {
        'span_a': (-S / 2, yb - gs / 2, ztop + 1.30), 'span_b': (S / 2, yb - gs / 2, ztop + 1.30),
        'ext_a0': (-S / 2, yb - gs / 2, ztop + 0.12), 'ext_a1': (-S / 2, yb - gs / 2, ztop + 1.42),
        'ext_b0': (S / 2, yb - gs / 2, ztop + 0.12), 'ext_b1': (S / 2, yb - gs / 2, ztop + 1.42),
        'trolley': (xt, yb, ztop + 0.20), 'control': (S / 2 - 0.42, yface - 0.2, gz0 + gh - 0.22),
        'drive': (S / 2 - 0.18, yb - 0.75 + 0.1, H + 0.10), 'cbar': (1.2, yface - 0.05, gz0 + 0.09),
        'hoist': (xt + 0.15, yb - 0.11, ztop - 0.50), 'base': (S / 2, -L / 2, 0.03),
        'load': (xt + 0.04, yb - 0.4, 0.95), 'hook': tuple(bowl),
    }
    return dict(az=-68, el=10, lens=70, marks=marks, fit_extra=[marks['ext_a1'], marks['ext_b1']] if kit.HERO else None)


def ezup_end_truck_detail(m):
    ezup_industrial(m)
    S, L, H = 24 * FT, 30 * FT, 12 * FT
    yb = -L / 2 + 2.3
    focus = [(x, y, z) for x in (S / 2 - 1.5, S / 2 + 0.35) for y in (yb - 1.0, yb + 1.0) for z in (H - 0.5, H + 0.75)]
    return dict(az=-52, el=16, lens=70, pts=focus)


def ezup_trolley_detail(m):
    ezup_industrial(m)
    S, L, H = 24 * FT, 30 * FT, 12 * FT
    yb = -L / 2 + 2.3
    xt = -1.1
    focus = [(x, y, z) for x in (xt - 1.0, xt + 1.0) for y in (yb - 0.5, yb + 0.5) for z in (H - 0.55, H + 0.85)]
    return dict(az=-64, el=5, lens=70, pts=focus)


def ezup_professional(m):
    S, L, H = 16 * FT, 18 * FT, 10 * FT
    runway(S, L, H, m, bays=1, beam=(0.21, 0.134, 0.0102, 0.0062), col=6 * IN, plate=16 * IN)
    yb = -L / 2 + 1.7
    xt = 0.25
    o, bowl, g = ezup_bridge(S, yb, H, m, gs=24 * IN, girder=(3 * IN, 9 * IN), xt=xt, drop=1.15, plate='nameplate-1ton.png',
                             near=-1, hoist_scale=0.72, Lt=1.2, tube=5 * IN, cbars=False, panel_end=1,
                             box_size=(0.30, 0.16, 0.40), pendant=1.55, plate_x=1.05, hang_drop=0.30)
    place(workbench(m), (xt + 0.03, yb, 0), 0.0, 'bench')
    gp, eye = gear_part(m, 0.9)
    zl = bowl.z - eye.z - 0.02
    place(gp, (xt + 0.03, yb, zl), 0.0, 'part')
    return dict(az=-66, el=10, lens=70)


def component_kit(m):
    for y in (1.05, 0.35):
        t, _ = ezup_end_truck(0, 0, 0.0, m, drive=True, inward=1)
        place(t, (-0.35, y, 0), -math.pi / 2, 'truck')
    tr, _ = ezup_trolley(0, 0, 0.0, 30 * IN, m, hang_drop=0.10)
    place(tr, (-1.25, -0.85, 0), 0.0, 'trolley')
    place(control_box(m), (0.05, -0.55, 0), 0.0, 'panel')
    place(wheel_block(m), (0.75, -0.72, 0), math.radians(90), 'wb1')
    place(wheel_block(m), (1.10, -0.72, 0), math.radians(90), 'wb2')
    place(radio_tx(m), (0.72, -1.22, 0), math.radians(12), 'tx1')
    place(radio_tx(m), (0.90, -1.20, 0), math.radians(-6), 'tx2')
    bp = image_mat('blueprint', os.path.join(parts.TEX, 'blueprint.png'), rough=0.6)
    sheet = plane('sheet', 0.84, 0.594, bp, (1.75, -0.95, 0.002), normal=(0, 0, 1), up=(0.15, 1, 0))
    cyl('roll', 0.03, 0.86, (1.75, -0.5, 0.03), mat('paper', '#F2F1EC', rough=0.6), axis='x', bevel=0.002)
    cyl('roll_band', 0.031, 0.012, (1.55, -0.5, 0.03), m.rubber, axis='x', bevel=0.0)
    # conductor bar lengths on dunnage behind the trucks
    for i in range(4):
        member('cbar', P_round_rect(0.014, 0.022, 0.004, 3), (-1.6, 1.62 + i * 0.03, 0.061), (1.5, 1.62 + i * 0.03, 0.061), m.orange, bevel=0.0)
    for x in (-1.2, 1.1):
        box('dunnage', (0.09, 0.3, 0.05), (x, 1.66, 0), m.wood, anchor='b')
    # parts bin with hardware
    bn = mat('bin_blue', '#1F4E8C', rough=0.5)
    bx, by = 1.85, 0.25
    box('bin_bottom', (0.36, 0.26, 0.008), (bx, by, 0), bn, anchor='b')
    for s in (-1, 1):
        box('bin_wall', (0.36, 0.008, 0.13), (bx, by + s * 0.126, 0), bn, anchor='b')
        box('bin_wall', (0.008, 0.26, 0.13), (bx + s * 0.176, by, 0), bn, anchor='b')
    random.seed(4)
    for i in range(40):
        ax = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-0.3, 1))).normalized()
        bolt((bx + random.uniform(-0.14, 0.14), by + random.uniform(-0.09, 0.09), 0.02 + random.uniform(0, 0.035)), ax, d=0.016, material=m.zinc, stick=0.03)
    return dict(az=-62, el=30, lens=65)


def runway_tiebacks(m):
    S, L, H = 22 * FT, 30 * FT, 12 * FT
    rw = runway(S, L, H, m, bays=2)
    kit.bpy.context.view_layer.update()
    for ob in rw:                       # keep only the runway line next to the building
        if ob.matrix_world.translation.x < 0 or (ob.type == 'MESH' and sum((ob.matrix_world @ Vector(c)).x for c in ob.bound_box) / 8 < 0):
            kit.bpy.data.objects.remove(ob)
    ezup_bridge(S, -0.6, H, m, xt=1.3, drop=1.5, near=-1, panel_end=1, plate_x=-0.2)
    conductor_bars((S / 2 - 0.0825, -L / 2 - 0.1, H - 0.25), (S / 2 - 0.0825, L / 2 + 0.1, H - 0.25), (-1, 0, 0), m, every=1.5)
    xb = S / 2 + 1.25
    dcol = 0.26
    zt = H - 0.31 - 0.13
    for y in (-L / 2, 0, L / 2):
        member('bldg_col', P_I(dcol, 0.203, 0.013, 0.008), (xb, y, 0.02), (xb, y, 5.6), m.primer, up=(1, 0, 0))
        box('bldg_bp', (0.42, 0.36, 0.02), (xb, y, 0), m.primer, anchor='b')
        for sx in (-1, 1):
            for sy in (-1, 1):
                bolt((xb + sx * 0.16, y + sy * 0.13, 0.02), d=0.02, material=m.zinc, stick=0.02)
        xa, xc = S / 2 + 4 * IN + 0.014, xb - dcol / 2 - 0.014
        hss('tieback', 0.089, 0.089, (xa, y, zt), (xc, y, zt), m.yellow)
        for xx, sg in ((xa - 0.007, -1), (xc + 0.007, 1)):
            box('tb_plate', (0.014, 0.19, 0.19), (xx, y, zt), m.yellow, bevel=0.002)
            for sy in (-1, 1):
                for sz in (-1, 1):
                    bolt((xx - sg * 0.007, y + sy * 0.07, zt + sz * 0.07), (-sg, 0, 0), d=0.016, material=m.zinc, stick=0.008)
    for z in (1.5, 3.3, 5.0):
        member('girt', P_C(0.2, 0.065, 0.006, 0.005), (xb + dcol / 2 + 0.1, -L / 2 - 0.3, z), (xb + dcol / 2 + 0.1, L / 2 + 0.3, z), m.primer, up=(1, 0, 0))
    member('eave', P_I(0.2, 0.134, 0.0102, 0.0062), (xb, -L / 2 - 0.4, 5.6 + 0.1), (xb, L / 2 + 0.4, 5.6 + 0.1), m.primer)
    focus = [(x, y, z) for x in (S / 2 - 1.6, xb + 0.5) for y in (-L / 2 - 0.5, L / 2 + 0.5) for z in (0, 5.85)]
    return dict(az=-138, el=21, lens=60, pts=focus)


# ============================================================ light rail (KBK-type) systems
def kbk_workstation(m):
    SX, SY, H = 4.6, 5.2, 3.3
    hd = 0.21
    for sx in (-1, 1):
        for sy in (-1, 1):
            base_column(sx * SX / 2, sy * SY / 2, H, m, size=6 * IN, plate=20 * IN, gussets=True, color=m.struct)
    for sy in (-1, 1):
        member('header', P_I(hd, 0.134, 0.0102, 0.0062), (-SX / 2 - 0.2, sy * SY / 2, H + hd / 2), (SX / 2 + 0.2, sy * SY / 2, H + hd / 2), m.struct)
        for sx in (-1, 1):
            knee((sx * (SX / 2 - 3 * IN), sy * SY / 2, H - 0.7), (sx * (SX / 2 - 3 * IN - 0.7), sy * SY / 2, H), m, color=m.struct, plane_n=(0, 1, 0))
    xr = 1.35
    zr = H - 0.14 - 0.0625
    for sx in (-1, 1):
        rail((sx * xr, -SY / 2 - 0.35, zr), (sx * xr, SY / 2 + 0.35, zr), m)
        for sy in (-1, 1):
            rail_hanger((sx * xr, sy * SY / 2, zr), H, m, along='y')
    yb = -0.9
    zb = zr - 0.0625 - 0.07 - 0.0625
    rail((-xr - 0.3, yb, zb), (xr + 0.3, yb, zb), m)
    for sx in (-1, 1):
        rail_carrier((sx * xr, yb, zr - 0.0625), m, drop=0.07, along='y')
    xh = 0.35
    rail_carrier((xh, yb, zb - 0.0625), m, drop=0.07, along='x')
    g, bowl = chain_hoist(m, drop=0.75, s=0.62, pendant=1.15)
    hang = Vector((xh, yb, zb - 0.0625 - 0.06))
    g.location = hang
    bowl = bowl + hang
    place(workbench(m, (1.9, 0.85, 0.9)), (xh + 0.25, yb, 0), 0.0, 'bench')
    gp, eye = gear_part(m, 0.8)
    place(gp, (xh + 0.02, yb, bowl.z - eye.z - 0.01), 0.0, 'part')
    return dict(az=-62, el=10, lens=65)


def kbk_monorail(m):
    H = 3.25
    hd = 0.21
    zr = H - 0.15 - 0.0625
    path = _turtle((-1.15, -4.7), 0.0, [('s', 2.3), ('a', 1.6, 50), ('s', 1.2), ('a', 1.6, -50), ('s', 3.9)])
    pts = [p + Vector((0, 0, zr)) for p in path]
    rail_path(pts, m)
    for p, q in ((pts[0], pts[1]), (pts[-1], pts[-2])):
        d = (p - q).normalized()
        member('rail_cap', P_round_rect(0.108, 0.133, 0.012), p - d * 0.004, p + d * 0.018, m.black, bevel=0.002)

    def at_y(y):
        for a, b in zip(pts, pts[1:]):
            if a.y <= y <= b.y:
                t = (y - a.y) / (b.y - a.y)
                return a + (b - a) * t
        return pts[-1]

    XC = 2.5
    for y in (-4.0, -0.35, 3.6):
        for sx in (-1, 1):
            base_column(sx * XC, y, H, m, size=6 * IN, plate=20 * IN, gussets=True, color=m.struct)
            knee((sx * (XC - 3 * IN), y, H - 0.7), (sx * (XC - 3 * IN - 0.7), y, H), m, color=m.struct, plane_n=(0, 1, 0))
        member('header', P_I(hd, 0.134, 0.0102, 0.0062), (-XC - 0.2, y, H + hd / 2), (XC + 0.2, y, H + hd / 2), m.struct)
        rail_hanger(at_y(y), H, m, along='x')
    # hoist on the first straight
    ph = at_y(-3.0)
    rail_carrier((ph.x, ph.y, zr - 0.0625), m, drop=0.07, along='y')
    g, bowl = chain_hoist(m, drop=0.9, s=0.62, pendant=1.1)
    g.rotation_euler = (0, 0, math.pi / 2)
    hang = Vector((ph.x, ph.y, zr - 0.0625 - 0.06))
    g.location = hang
    bowl = hang + Matrix.Rotation(math.pi / 2, 3, 'Z') @ bowl
    c = crate(m, (0.7, 0.55, 0.5))
    zc = bowl.z - 0.5 - 0.42
    place(c, (bowl.x, bowl.y, zc), 0.0, 'crate')
    sling_legs(bowl, [(bowl.x + sx * 0.28, bowl.y + sy * 0.2, zc + 0.52) for sx in (-1, 1) for sy in (-1, 1)], m, r=0.006)
    place(pallet(m), (bowl.x, bowl.y, 0), 0.0, 'pallet')
    pe = at_y(3.0)
    place(workbench(m, (1.6, 0.8, 0.85)), (pe.x, 3.0, 0), 0.0, 'bench')
    return dict(az=-52, el=14, lens=65)


def kbk_jib(m):
    Hc = 3.35
    base_column(0, 0, Hc, m, size=6 * IN, plate=26 * IN, gussets=True, bolts=8, color=m.struct)
    za, La = 2.78, 3.3
    x0 = 3 * IN + 0.09
    rail((x0, 0, za), (La, 0, za), m)
    # pivot: bracket plates on the column and a vertical pivot pin
    for z in (za + 0.11, za - 0.11):
        box('pivot_plate', (0.16, 0.14, 0.014), (3 * IN + 0.07, 0, z), m.struct, bevel=0.002)
    cyl('pivot_pin', 0.02, 0.30, (3 * IN + 0.085, 0, za), m.zinc)
    box('arm_yoke', (0.10, 0.13, 0.20), (x0 + 0.02, 0, za), m.dgray, bevel=0.01)
    # tie rod
    zt = Hc - 0.14
    box('tie_bracket', (0.12, 0.12, 0.014), (3 * IN + 0.05, 0, zt + 0.05), m.struct, bevel=0.002)
    cyl('tie_pin', 0.016, 0.12, (3 * IN + 0.075, 0, zt), m.zinc)
    xa = 2.15
    sweep('tie_rod', [(3 * IN + 0.075, 0, zt), (xa, 0, za + 0.0625 + 0.05)], 0.0095, m.zinc, segs=12)
    mid = Vector((3 * IN + 0.075, 0, zt)).lerp(Vector((xa, 0, za + 0.1125)), 0.5)
    dvec = (Vector((xa, 0, za + 0.1125)) - Vector((3 * IN + 0.075, 0, zt))).normalized()
    member('turnbuckle', P_circle(0.018, 12), mid - dvec * 0.09, mid + dvec * 0.09, m.zinc, bevel=0.003)
    box('tie_clamp', (0.06, 0.13, 0.05), (xa, 0, za + 0.0625 + 0.025), m.dgray, bevel=0.004)
    xh = 2.75
    rail_carrier((xh, 0, za - 0.0625), m, drop=0.07, along='x')
    g, bowl = chain_hoist(m, drop=0.95, s=0.62, pendant=1.2)
    hang = Vector((xh, 0, za - 0.0625 - 0.06))
    g.location = hang
    bowl = bowl + hang
    gp, eye = gear_part(m, 0.75)
    place(gp, (xh + 0.02, 0, bowl.z - eye.z - 0.01), 0.0, 'part')
    place(pallet(m), (xh + 0.02, 0, 0), 0.0, 'pallet')
    return dict(az=-70, el=9, lens=70)


def chain_hoist_closeup(m):
    zb = 2.35
    d, bf = 0.25, 0.146
    member('beam', P_I(d, bf, 0.011, 0.007), (-1.1, 0, zb + d / 2), (1.1, 0, zb + d / 2), m.yellow)
    for sx in (-1, 1):
        hss('post', 0.1, 0.1, (sx * 1.0, 0, 0.1), (sx * 1.0, 0, zb), m.gray, up=(1, 0, 0))
        hss('foot', 0.1, 0.1, (sx * 1.0, -0.6, 0.05), (sx * 1.0, 0.6, 0.05), m.gray)
        box('post_cap', (0.2, 0.2, 0.014), (sx * 1.0, 0, zb - 0.014), m.gray, anchor='b')
    hoist_on_beam(m, (0.0, 0, zb), bf, rz=0.0, s=1.0, drop=0.42, motor=True, pendant=0.82)
    focus = [(x, y, z) for x in (-0.62, 0.62) for y in (-0.25, 0.25) for z in (1.22, zb + d + 0.02)]
    return dict(az=-64, el=4, lens=85, pts=focus, margin=1.03)


# ============================================================ engineered products
def _lumber_pack(m, size=(4.8, 1.2, 0.9), loc=(0, 0, 0)):
    sx, sy, sz = size
    x, y, z = loc
    o = []
    layers = 6
    lh = (sz - 0.08) / layers
    for i in range(layers):
        o.append(box('lumber', (sx - (i % 2) * 0.03, sy, lh - 0.006), (x + (0.015 if i % 2 else 0), y, z + 0.08 + i * lh), m.wood, anchor='b', bevel=0.004))
    for dx in (-sx / 2 + 0.6, 0, sx / 2 - 0.6):
        o.append(box('dunnage', (0.09, sy, 0.08), (x + dx, y, z), m.wood, anchor='b', bevel=0.003))
        o.append(box('band', (0.03, sy + 0.012, sz - 0.074), (x + dx + 0.25, y, z + 0.077), m.black, anchor='b', bevel=0.001))
    return o


def _trailer(m, L=14.6, W=2.59, deck=1.42):
    o = []
    dk = mat('deck_wood', '#8B6B45', rough=0.75, bump=0.3, bump_scale=30)
    fr = mat('trailer_frame', '#22262B', rough=0.45, coat=0.2)
    o.append(box('deck', (W, L, 0.06), (0, 0, deck - 0.06), dk, anchor='b', bevel=0.004))
    for sx in (-1, 1):
        o.append(member('side_rail', P_C(0.15, 0.06, 0.008, 0.006), (sx * (W / 2 - 0.0), -L / 2, deck - 0.075), (sx * (W / 2 - 0.0), L / 2, deck - 0.075), fr, up=(0, 0, 1)))
        o.append(member('main_beam', P_I(0.46, 0.15, 0.016, 0.008), (sx * 0.48, -L / 2 + 0.2, deck - 0.06 - 0.23), (sx * 0.48, L / 2 - 0.9, deck - 0.06 - 0.23), fr))
    n = 16
    for i in range(n + 1):
        y = -L / 2 + 0.15 + i * (L - 0.3) / n
        o.append(box('xmember', (W - 0.02, 0.06, 0.1), (0, y, deck - 0.16), fr, anchor='b', bevel=0.003))
    # tandem axles at the rear (-Y end)
    for y in (-L / 2 + 1.55, -L / 2 + 2.85):
        o.append(cyl('axle', 0.065, W - 0.3, (0, y, 0.52), fr, axis='x'))
        for sx in (-1, 1):
            for k in (0, 1):
                x = sx * (W / 2 - 0.15 - k * 0.31)
                o.append(cyl('tire', 0.52, 0.27, (x, y, 0.52), m.tire, axis='x', bevel=0.06))
                o.append(cyl('rim', 0.29, 0.275, (x, y, 0.52), m.lgray, axis='x', bevel=0.01))
            o.append(cyl('hub', 0.12, 0.06, (sx * (W / 2 - 0.02), y, 0.52), m.steel, axis='x', bevel=0.01))
        o.append(box('fender_hanger', (W - 0.9, 0.12, 0.35), (0, y, 0.75), fr, anchor='b', bevel=0.004))
    # landing gear near the front (+Y end)
    yl = L / 2 - 3.2
    for sx in (-1, 1):
        o.append(box('gear_leg', (0.13, 0.13, deck - 0.52), (sx * 0.75, yl, 0.05), fr, anchor='b', bevel=0.004))
        o.append(box('gear_pad', (0.28, 0.28, 0.05), (sx * 0.75, yl, 0), fr, anchor='b', bevel=0.004))
    o.append(cyl('gear_shaft', 0.02, 1.5, (0, yl, 0.75), m.steel, axis='x'))
    o.append(cyl('kingpin', 0.045, 0.12, (0, L / 2 - 0.9, deck - 0.56), m.steel))
    o.append(box('kingpin_plate', (1.1, 1.6, 0.02), (0, L / 2 - 0.9, deck - 0.52), fr, anchor='b'))
    # headboard
    for sx in (-1, 0, 1):
        o.append(box('hb_post', (0.08, 0.06, 1.3), (sx * (W / 2 - 0.05), L / 2 - 0.03, deck), fr, anchor='b', bevel=0.003))
    o.append(box('hb_panel', (W, 0.03, 1.25), (0, L / 2 - 0.02, deck + 0.02), m.alu, anchor='b', bevel=0.002))
    # lights / reflectors
    for sx in (-1, 1):
        o.append(box('tail', (0.3, 0.02, 0.1), (sx * (W / 2 - 0.3), -L / 2 - 0.005, deck - 0.2), m.red, bevel=0.003))
    return o


def _tarp(m, y0, y1, zbar, drop=1.9, rb=0.07, color=None):
    import bmesh
    bm = bmesh.new()
    nu, nv = 70, 46
    S0 = math.pi * rb / 2 + drop
    grid = []
    random.seed(7)
    ph1, ph2 = random.uniform(0, 6), random.uniform(0, 6)
    for i in range(nu + 1):
        u = i / nu
        y = y0 + (y1 - y0) * u
        row = []
        for j in range(nv + 1):
            s = -S0 + 2 * S0 * j / nv
            sg = 1 if s >= 0 else -1
            a = abs(s)
            if a <= math.pi * rb / 2:
                ph = a / rb
                x, z = sg * rb * math.sin(ph), rb * math.cos(ph)
            else:
                dz = a - math.pi * rb / 2
                f = min(1.0, dz / 0.5)
                wave = 0.055 * f * math.sin(u * 2 * math.pi * 6.5 + (ph1 if sg > 0 else ph2)) + 0.025 * f * math.sin(u * 2 * math.pi * 15 + 1.3 * sg)
                x, z = sg * (rb + 0.02 * f) + wave, -dz
            row.append(bm.verts.new((x, y, zbar + z)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return kit._finish('tarp', bm, color or m.green, 0.0, angle=180)


def tarping_crane(m):
    S, L, H = 5.8, 17.0, 7.0
    runway(S, L, H, m, bays=3, col=10 * IN, plate=26 * IN, beam=(0.36, 0.171, 0.0116, 0.0072))
    yb = 0.6
    o, bowl, g = ezup_bridge(S, yb, H, m, xt=0.0, drop=0.35, near=-1, panel_end=1, plate_x=1.1)
    conductor_bars((S / 2 + 0.0855, -L / 2 - 0.1, H - 0.28), (S / 2 + 0.0855, L / 2 + 0.1, H - 0.28), (1, 0, 0), m, every=1.5)
    # spreader bar along the trailer, hung from the hook
    zs = bowl.z - 1.0
    hss('spreader', 0.1, 0.1, (0, yb - 3.4, zs), (0, yb + 3.4, zs), m.yellow)
    for sy in (-1, 1):
        lg = lug(m, R=0.05, D=0.07, hole=0.02, t=0.02)
        lg.matrix_world = Matrix.Translation((0, yb + sy * 1.9, zs + 0.12)) @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ lg.matrix_world
        sweep('sp_sling', [bowl, (0, yb + sy * 1.9, zs + 0.12)], 0.008, m.dsteel, segs=8)
    _tarp(m, yb - 3.2, yb + 3.2, zs + 0.0, drop=1.75, rb=0.075)
    for i in range(9):
        y = yb - 3.0 + i * 0.75
        box('tarp_clamp', (0.16, 0.05, 0.03), (0, y, zs + 0.095), m.black, bevel=0.004)
    # trailer with lumber
    place(_trailer(m), (0, 0.0, 0), 0.0, 'trailer')
    deck = 1.42
    for iy, y in enumerate((-4.6, 0.3, 5.0)):
        for sx in (-1, 1):
            _lumber_pack(m, loc=(sx * 0.62, y, deck), size=(1.2, 4.6, 0.95)) if False else None
    for y in (-4.4, 0.4, 4.9):
        for sx in (-1, 1):
            pk = _lumber_pack(m, size=(4.5, 1.18, 0.95))
            place(pk, (sx * 0.61, y, deck), math.pi / 2, 'pack')
            if y != 4.9:
                pk2 = _lumber_pack(m, size=(4.5, 1.18, 0.95))
                place(pk2, (sx * 0.61, y, deck + 0.95), math.pi / 2, 'pack')
    return dict(az=-42, el=9, lens=60)


def jib_crane(m):
    Hm, r = 4.0, 0.162
    box('jib_base', (1.15, 1.15, 0.035), (0, 0, 0), m.yellow, anchor='b', bevel=0.004)
    pipe('mast', r, (0, 0, 0.035), (0, 0, Hm), m.yellow)
    for i in range(8):
        a = math.radians(45 * i + 22.5)
        d = Vector((math.cos(a), math.sin(a), 0))
        Y = Vector((0, 0, 1)).cross(d)
        p0 = Vector((0, 0, 0.035)) + d * (r - 0.004) - Y * 0.008
        member('gusset', [(0, 0), (0.34, 0), (0.34, 0.03), (0.03, 0.5), (0, 0.5)], p0, p0 + Y * 0.016, m.yellow, up=(0, 0, 1), bevel=0.001)
        b = Vector((math.cos(a + math.radians(22.5)), math.sin(a + math.radians(22.5)), 0)) * 0.52
        bolt((b.x, b.y, 0.035), d=0.03, material=m.zinc, stick=0.035)
    cyl('mast_cap', r + 0.015, 0.05, (0, 0, Hm + 0.025), m.yellow, bevel=0.004)
    cyl('pivot_housing', 0.11, 0.16, (0, 0, Hm + 0.13), m.yellow, bevel=0.006)
    cyl('pivot_pin', 0.045, 0.06, (0, 0, Hm + 0.24), m.zinc, bevel=0.004)
    d, bf = 0.36, 0.17
    zb = Hm + 0.21
    Lb = 4.9
    member('boom', P_I(d, bf, 0.016, 0.01), (-0.42, 0, zb + d / 2), (Lb, 0, zb + d / 2), m.yellow)
    # head assembly: side plates down to the roller carriage that bears on the mast
    for sy in (-1, 1):
        ob = prism('head_plate', [(-0.30, zb), (1.05, zb), (0.30, zb - 0.62), (-0.30, zb - 0.62)], 0.016, m.yellow, bevel=0.002)
        ob.matrix_world = Matrix.Translation((0, sy * (r + 0.05) - 0.008, 0))
    for sx in (-1, 1):
        cyl('roller', 0.075, 0.12, (sx * (r + 0.078), 0, zb - 0.50), m.steel, bevel=0.008)
        cyl('roller_pin', 0.02, 0.2, (sx * (r + 0.078), 0, zb - 0.50), m.zinc)
        box('roller_tie', (0.05, 2 * (r + 0.05), 0.016), (sx * (r + 0.078), 0, zb - 0.40), m.yellow, bevel=0.002)
        box('roller_tie', (0.05, 2 * (r + 0.05), 0.016), (sx * (r + 0.078), 0, zb - 0.60), m.yellow, bevel=0.002)
    for x in (0.75, Lb - 0.12):
        box('boom_stop', (0.02, bf - 0.03, 0.12), (x, 0, zb - 0.0), m.yellow, anchor='b', bevel=0.002)
        box('boom_stop2', (0.02, bf + 0.02, 0.09), (x, 0, zb + 0.016 + 0.045), m.yellow, bevel=0.002)
    box('boom_endplate', (0.014, bf + 0.02, d + 0.02), (Lb + 0.007, 0, zb + d / 2), m.yellow, bevel=0.002)
    _nameplate(m, 'nameplate-2ton.png', (2.0, -0.0052, zb + d / 2), (0, -1, 0), h=0.12).matrix_world.translation.y = -0.0052
    xh = 3.75
    bowl = hoist_on_beam(m, (xh, 0, zb), bf, rz=0.0, s=1.0, drop=1.35, motor=True, pendant=1.9)
    ps, th = plate_stack(m, (1.5, 0.9), n=5)
    zl = 0.55
    place(ps, (xh + 0.04, 0, zl), 0.0, 'plates')
    sling_legs(bowl, [(xh + 0.04 + sx * 0.6, sy * 0.36, zl + th) for sx in (-1, 1) for sy in (-1, 1)], m, r=0.007, color=m.dsteel)
    for x in (-0.45, 0.5):
        box('dunnage', (0.1, 1.0, 0.1), (xh + x, 0, 0), m.wood, anchor='b')
    return dict(az=-66, el=8, lens=70)


def gantry_crane(m):
    d, bf = 0.31, 0.165
    zb, Lb = 3.35, 4.9
    member('beam', P_I(d, bf, 0.0097, 0.0058), (-Lb / 2, 0, zb + d / 2), (Lb / 2, 0, zb + d / 2), m.yellow)
    xs, wy, zf = 2.05, 0.95, 0.30
    for sx in (-1, 1):
        x = sx * xs
        box('top_plate', (0.3, 0.3, 0.016), (x, 0, zb - 0.016), m.yellow, anchor='b', bevel=0.002)
        for bx in (-1, 1):
            for by in (-1, 1):
                bolt((x + bx * 0.11, by * 0.115, zb + 0.0097), d=0.016, material=m.zinc, stick=0.01)
        for sy in (-1, 1):
            hss('leg', 0.1, 0.1, (x, sy * 0.05, zb - 0.016), (x, sy * wy, zf + 0.05), m.yellow, up=(1, 0, 0))
            cs = caster(m, 0.10)
            place(cs, (x, sy * wy, zf - 0.04), math.radians(90 + sx * 12), 'caster')
        hss('base', 0.1, 0.1, (x, -wy - 0.12, zf + 0.01), (x, wy + 0.12, zf + 0.01), m.yellow)
        hss('leg_tie', 0.064, 0.064, (x, -0.42, 1.75), (x, 0.42, 1.75), m.yellow)
        knee((x - sx * 0.05, 0, zb - 0.85), (x - sx * 0.9, 0, zb), m, color=m.yellow, plane_n=(0, 1, 0))
        box('beam_endplate', (0.012, bf + 0.02, d + 0.02), (sx * (Lb / 2 + 0.006), 0, zb + d / 2), m.yellow, bevel=0.002)
        box('trolley_stop', (0.02, bf - 0.03, 0.11), (sx * (xs - 0.3), 0, zb), m.yellow, anchor='b', bevel=0.002)
    _nameplate(m, 'nameplate-2ton.png', (-0.9, -0.0035, zb + d / 2), (0, -1, 0), h=0.11)
    xh = 0.5
    bowl = hoist_on_beam(m, (xh, 0, zb), bf, rz=0.0, s=0.9, drop=1.05, motor=False, pendant=1.5)
    c = crate(m, (0.95, 0.75, 0.7))
    zc = 0.42
    place(c, (xh + 0.04, 0, zc), 0.0, 'crate')
    sling_legs(bowl, [(xh + 0.04 + sx * 0.4, sy * 0.3, zc + 0.72) for sx in (-1, 1) for sy in (-1, 1)], m, r=0.007)
    return dict(az=-64, el=9, lens=70)


def monorail(m):
    H, XC = 4.0, 1.9
    hd = 0.26
    d, bf = 0.31, 0.127
    Lb = 10.4
    ys = (-4.6, 0.0, 4.6)
    for y in ys:
        for sx in (-1, 1):
            base_column(sx * XC, y, H, m, size=6 * IN, plate=20 * IN, gussets=True)
            knee((sx * (XC - 3 * IN), y, H - 0.75), (sx * (XC - 3 * IN - 0.75), y, H), m, plane_n=(0, 1, 0))
        member('header', P_I(hd, 0.147, 0.0112, 0.0066), (-XC - 0.2, y, H + hd / 2), (XC + 0.2, y, H + hd / 2), m.gray)
        for s2 in (-1, 1):
            box('hanger_plate', (0.012, 0.16, 0.12), (s2 * (bf / 2 + 0.03), y, H - 0.05), m.gray, bevel=0.002)
            box('hanger_clip', (bf / 2 + 0.05, 0.16, 0.012), (s2 * (bf / 4 + 0.012), y, H - 0.006 - 0.0), m.gray, bevel=0.002)
            bolt((s2 * (bf / 2 + 0.01), y - 0.05, H - 0.012), (0, 0, -1), d=0.016, material=m.zinc, stick=0.008)
            bolt((s2 * (bf / 2 + 0.01), y + 0.05, H - 0.012), (0, 0, -1), d=0.016, material=m.zinc, stick=0.008)
    for sx in (-1, 1):
        hss('eave_strut', 0.089, 0.089, (sx * XC, ys[0], H - 0.2), (sx * XC, ys[-1], H - 0.2), m.gray)
    zt = H - 0.012
    member('mono_beam', P_I(d, bf, 0.0138, 0.009), (0, -Lb / 2, zt - d / 2), (0, Lb / 2, zt - d / 2), m.yellow)
    for sy in (-1, 1):
        box('end_stop', (bf + 0.03, 0.02, d * 0.5), (0, sy * (Lb / 2 - 0.1), zt - d - 0.0 + d * 0.25), m.yellow, bevel=0.002)
    _nameplate(m, 'nameplate-2ton.png', (bf / 2 - 0.057, -2.3, zt - d / 2), (1, 0, 0), h=0.105).matrix_world.translation.x = 0.0048
    zf = zt - d
    # process tanks
    for y, col in ((-0.4, '#27506B'), (2.4, '#3C6B4A')):
        place(tank(m, (1.5, 2.0, 1.0), liquid=col), (0, y, 0), 0.0, 'tank')
    # loaded hoist over the first tank, empty hoist at the loading end
    bowl = hoist_on_beam(m, (0, -0.4, zf), bf, rz=math.pi / 2, s=0.9, drop=0.55, motor=True)
    bk, pick = parts_basket(m, (0.9, 0.6, 0.45))
    zbk = bowl.z - pick.z
    place(bk, (0, -0.4, zbk), math.pi / 2, 'basket')
    bowl2 = hoist_on_beam(m, (0, -3.6, zf), bf, rz=math.pi / 2, s=0.9, drop=1.5, motor=True, pendant=1.6)
    bk2, pick2 = parts_basket(m, (0.9, 0.6, 0.45))
    place(bk2, (0, -3.6, 0.12), math.pi / 2, 'basket2')
    place(pallet(m), (0, -3.6, 0), 0.0, 'pallet')
    return dict(az=-40, el=10, lens=65)


def lifting_beam(m):
    L, w, h = 3.8, 0.152, 0.203
    zc = 2.75
    hss('lbeam', w, h, (-L / 2, 0, zc), (L / 2, 0, zc), m.yellow, r=0.014)
    # top bail
    lg = lug(m, R=0.11, D=0.2, hole=0.05, t=0.03)
    lg.matrix_world = Matrix.Translation((0, 0, zc + h / 2 + 0.19)) @ lg.matrix_world
    for sx in (-1, 1):
        ob = prism('bail_gusset', [(0, 0), (0.22, 0), (0, 0.16)], 0.012, m.yellow, bevel=0.001)
        ob.matrix_world = Matrix.Translation((sx * 0.11, 0.006 if sx > 0 else -0.006, zc + h / 2)) @ Matrix.Rotation(0 if sx > 0 else math.pi, 4, 'Z')
    # bottom lugs with shackles and slings
    pipe_r, zp = 0.26, 1.15
    stl = mat('pipe_steel', (0.33, 0.36, 0.40, 1), rough=0.38, metal=1.0)
    pipe('load_pipe', pipe_r, (-2.4, 0, zp), (2.4, 0, zp), stl, t=0.012)
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.2)
        lg = lug(m, R=0.07, D=0.10, hole=0.03, t=0.025, flip=True)
        lg.matrix_world = Matrix.Translation((x, 0, zc - h / 2 - 0.095)) @ lg.matrix_world
        sh = shackle(m, 1.4, down=True)
        place(sh, (x, 0, zc - h / 2 - 0.095), math.pi / 2, 'shackle')
        zs = zc - h / 2 - 0.095 - 0.135
        rs = pipe_r + 0.014
        loop = [(x, 0, zs)]
        for i in range(17):
            a = math.radians(160 + 220 * i / 16)
            loop.append((x, rs * math.cos(a), zp + rs * math.sin(a)))
        sweep('sling', loop + [(x, 0, zs)], 0.014, m.sling, segs=10)
        box('end_cap', (0.012, w + 0.01, h + 0.01), (sx * (L / 2 + 0.006), 0, zc), m.yellow, bevel=0.003)
    for x in (-0.95, 0.95):
        lg = lug(m, R=0.06, D=0.09, hole=0.026, t=0.022, flip=True)
        lg.matrix_world = Matrix.Translation((x, 0, zc - h / 2 - 0.085)) @ lg.matrix_world
    _nameplate(m, 'nameplate-5ton.png', (-0.9, -w / 2 - 0.0012, zc), (0, -1, 0), h=0.12)
    # crane hook from above, chain running out of frame
    blk, bowl = hook_block(m, 1.6)
    ztop = zc + h / 2 + 0.19 + 0.05 + 0.25 * 1.6 - 0.008
    e = place(blk, (0, 0, ztop), math.pi / 2, 'hookblock')
    for ob in chain((0, 0, ztop), (0, 0, ztop + 9), m, wire=0.012, pitch=0.038, width=0.042):
        ob['nofit'] = 1
    for x in (-1.5, 1.5):
        box('cradle', (0.14, 0.9, 0.14), (x, 0, 0), m.wood, anchor='b')
    return dict(az=-70, el=7, lens=80, top_pad=0.35)


def controls(m):
    place(control_panel_open(m), (0, 0.1, 0.0), 0.0, 'panel')
    place(radio_tx(m), (0.02, -0.52, 0), math.radians(18), 'tx1')
    place(radio_tx(m), (0.2, -0.47, 0), math.radians(-10), 'tx2')
    # receiver
    rx = [box('rx', (0.16, 0.07, 0.2), (0, 0, 0.1), m.black, bevel=0.008), cyl('rx_ant', 0.006, 0.12, (0.05, 0, 0.26), m.black),
          box('rx_label', (0.1, 0.002, 0.05), (0, -0.036, 0.13), m.cord, bevel=0.0005)]
    place(rx, (0.52, -0.3, 0), math.radians(-20), 'rx')
    return dict(az=-58, el=14, lens=85)


def kbk_detail(m):
    """Second view of the workstation crane, lower and closer, for page heroes."""
    kbk_workstation(m)
    return dict(az=-28, el=3, lens=45, margin=1.0)


def _grouped(fn, m, loc, rz=0.0):
    """Build another scene's objects and move them as one group."""
    before = set(kit.bpy.context.scene.objects)
    fn(m)
    new = [o for o in kit.bpy.context.scene.objects if o not in before and o.parent is None]
    e = join(new, 'grp_' + fn.__name__)
    e.location = loc
    e.rotation_euler = (0, 0, rz)
    return e


def family(m):
    """The product line in one picture."""
    _grouped(ezup_industrial, m, (0.0, 9.8, 0))
    _grouped(gantry_crane, m, (-10.2, 7.2, 0), math.radians(10))
    _grouped(kbk_workstation, m, (10.4, 7.6, 0), math.radians(-6))
    _grouped(kbk_jib, m, (-8.6, -0.8, 0), math.radians(4))
    _grouped(chain_hoist_closeup, m, (-3.4, -2.6, 0), math.radians(8))
    _grouped(jib_crane, m, (4.6, -1.2, 0), math.radians(6))
    _grouped(component_kit, m, (0.6, -6.6, 0), math.radians(4))
    return dict(az=-84, el=11, lens=70, margin=1.03)


ALL = [ezup_industrial, ezup_end_truck_detail, ezup_trolley_detail, ezup_professional, component_kit, runway_tiebacks, kbk_workstation, kbk_monorail, kbk_jib,
       chain_hoist_closeup, tarping_crane, jib_crane, gantry_crane, monorail, lifting_beam, controls, kbk_detail, family]
SCENES = {f.__name__: f for f in ALL}
