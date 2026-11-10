"""Reusable crane parts. Everything is built in metres; +Z is up."""
import math, os
import bpy
from mathutils import Vector, Matrix
import kit
from kit import (mat, image_mat, box, cyl, prism, ring_prism, member, hss, pipe, sweep, catmull, bolt, plane, join,
                 P_I, P_rect, P_C, P_L, P_circle, P_round_rect, IN, FT)

TEX = os.path.join(os.path.dirname(__file__), 'tex')
_link_mesh = {}


class M:
    """Material palette (created on first use after kit.reset())."""
    pass


def materials():
    m = M()
    m.yellow = mat('ezup_yellow', '#F6C700', rough=0.30, coat=0.35)
    m.red = mat('trolley_red', '#B5202A', rough=0.32, coat=0.3)
    m.gray = mat('runway_gray', '#727880', rough=0.40, coat=0.2)
    m.lgray = mat('light_gray', '#B9BDC2', rough=0.42, coat=0.15)
    m.dgray = mat('dark_gray', '#3A3D42', rough=0.45)
    m.black = mat('black', '#141516', rough=0.5)
    m.castblack = mat('cast_black', '#1B1C1E', rough=0.55, bump=0.25, bump_scale=600)
    m.rubber = mat('rubber', '#0D0D0E', rough=0.85)
    m.zinc = mat('zinc', (0.66, 0.68, 0.70, 1), rough=0.36, metal=1.0)
    m.steel = mat('steel', (0.50, 0.51, 0.53, 1), rough=0.30, metal=1.0)
    m.dsteel = mat('dark_steel', (0.10, 0.10, 0.11, 1), rough=0.42, metal=1.0)
    m.orange = mat('conductor_orange', '#EA5F1A', rough=0.42)
    m.white = mat('enclosure_white', '#E6E6E3', rough=0.33, coat=0.25)
    m.silver = mat('hoist_silver', '#BFC4CA', rough=0.36, metal=0.55, coat=0.2)
    m.alu = mat('rail_silver', '#DADDE0', rough=0.30, metal=0.35, coat=0.3)
    m.poly = mat('poly_red', '#C63A30', rough=0.5)
    m.cord = mat('cord_yellow', '#E3B400', rough=0.6)
    m.wood = mat('wood', '#C8A36D', rough=0.72, bump=0.35, bump_scale=60)
    m.ply = mat('plywood', '#D9BC8C', rough=0.7, bump=0.2, bump_scale=90)
    m.sling = mat('sling_purple', '#6A3FA0', rough=0.8, bump=0.3, bump_scale=900)
    m.sling_y = mat('sling_yellow', '#E8C21A', rough=0.8, bump=0.3, bump_scale=900)
    m.tire = mat('tire', '#101011', rough=0.8, bump=0.2, bump_scale=300)
    m.green = mat('tarp_green', '#1F5A3A', rough=0.55, bump=0.15, bump_scale=120)
    m.blue = mat('steel_blue', '#2F5E8E', rough=0.38, coat=0.2)
    m.primer = mat('building_steel', '#8A3A2C', rough=0.55)
    m.struct = mat('structure_dark', '#4C5158', rough=0.42, coat=0.2)
    m.concrete = mat('concrete', '#A9A7A1', rough=0.55, bump=0.15, bump_scale=40)
    return m


# ----------------------------------------------------------------- chain, hook, hoist
def _link(m, wire, pitch, width):
    key = (round(wire, 4), round(pitch, 4), round(width, 4))
    if key not in _link_mesh:
        hw = (width - wire) / 2
        hl = (pitch + wire) / 2 - hw
        pts = []
        for i in range(9):
            a = math.pi * i / 8
            pts.append((hw * math.cos(a), 0, hl + hw * math.sin(a)))
        for i in range(9):
            a = math.pi + math.pi * i / 8
            pts.append((hw * math.cos(a), 0, -hl + hw * math.sin(a)))
        ob = sweep('link', pts, wire / 2, m.dsteel, segs=8, closed=True)
        _link_mesh[key] = ob.data
        ob.data.use_fake_user = True
        bpy.data.objects.remove(ob)
    return _link_mesh[key]


def chain(p0, p1, m, wire=0.008, pitch=0.026, width=0.027):
    """Round-link chain from p0 to p1 (instanced links)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    n = max(1, int(round(L / pitch)))
    me = _link(m, wire, L / n, width)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    out = []
    for i in range(n):
        ob = bpy.data.objects.new('link', me)
        kit.COL.objects.link(ob)
        ob.matrix_world = Matrix.Translation(p0 + d * ((i + 0.5) / n)) @ q @ Matrix.Rotation(math.pi / 2 * (i % 2), 4, 'Z')
        out.append(ob)
    return out


def hook(m, s=1.0, color=None):
    """Forged hook with latch. Local origin at the top of the shank, hook hangs down -Z in the XZ plane.
    Returns (objects, bowl_point) with bowl_point the inside-bottom of the hook (where a sling sits)."""
    c = color or m.dsteel
    ctrl = [(0, 0, 0.0), (0.004, 0, -0.028), (0.044, 0, -0.064), (0.052, 0, -0.100), (0.026, 0, -0.140),
            (-0.016, 0, -0.146), (-0.050, 0, -0.118), (-0.055, 0, -0.082), (-0.047, 0, -0.058)]
    rad = [0.016, 0.017, 0.020, 0.0225, 0.0225, 0.020, 0.016, 0.011, 0.006]
    pts = catmull([Vector(p) * s for p in ctrl], 8)
    rr = []
    for i in range(len(ctrl) - 1):
        for k in range(8):
            rr.append((rad[i] + (rad[i + 1] - rad[i]) * k / 8) * s)
    rr.append(rad[-1] * s)
    objs = [sweep('hook', pts, 0.02 * s, c, segs=14, radii=rr)]
    # latch
    a, b = Vector((0.006, 0, -0.03)) * s, Vector((-0.046, 0, -0.066)) * s
    objs.append(member('latch', P_rect(0.016 * s, 0.003 * s), a, b, m.zinc, up=(0, 1, 0), bevel=0.0005))
    return objs, Vector((0.0, 0, -0.121)) * s


def hook_block(m, s=1.0):
    """Bottom block + hook for a chain hoist. Origin at chain attachment (top). Returns (objs, bowl_point)."""
    objs = []
    objs.append(member('blk', P_round_rect(0.075 * s, 0.062 * s, 0.018 * s), (0, 0, -0.105 * s), (0, 0, 0), m.yellow, up=(1, 0, 0), bevel=0.003 * s))
    objs.append(box('blk_band', (0.079 * s, 0.066 * s, 0.022 * s), (0, 0, -0.052 * s), m.black, bevel=0.002))
    objs.append(cyl('swivel', 0.02 * s, 0.03 * s, (0, 0, -0.118 * s), m.zinc))
    hk, bowl = hook(m, s)
    for o in hk:
        o.matrix_world = Matrix.Translation((0, 0, -0.13 * s)) @ o.matrix_world
    return objs + hk, bowl + Vector((0, 0, -0.13 * s))


def chain_hoist(m, drop=1.5, s=1.0, bag=True, body=None, accent=None, pendant=0.0):
    """Generic electric chain hoist. Origin at the suspension point (top eye); body axis along X.
    Returns (group_empty, bowl_point_local)."""
    body = body or m.silver
    accent = accent or m.dgray
    o = []
    zc = -0.21 * s
    # suspension eye
    o.append(box('eye', (0.05 * s, 0.014 * s, 0.11 * s), (0, 0, -0.045 * s), m.steel, bevel=0.002))
    o.append(cyl('eye_pin', 0.014 * s, 0.05 * s, (0, 0, -0.012 * s), m.zinc, axis='y'))
    # gearbox housing
    o.append(member('gearbox', P_round_rect(0.22 * s, 0.25 * s, 0.05 * s), (-0.15 * s, 0, zc), (0.15 * s, 0, zc), body, bevel=0.004 * s))
    o.append(box('gear_seam', (0.006 * s, 0.225 * s, 0.255 * s), (0, 0, zc), accent, bevel=0.001))
    # motor with fins
    o.append(cyl('motor', 0.098 * s, 0.22 * s, (0.26 * s, 0, zc), body, axis='x'))
    for i in range(7):
        o.append(cyl('fin', 0.108 * s, 0.007 * s, ((0.175 + i * 0.026) * s, 0, zc), body, axis='x', bevel=0.001))
    o.append(cyl('fan_cover', 0.104 * s, 0.06 * s, (0.40 * s, 0, zc), accent, axis='x', bevel=0.012 * s))
    # control end cover
    o.append(member('cover', P_round_rect(0.205 * s, 0.235 * s, 0.05 * s), (-0.33 * s, 0, zc), (-0.15 * s, 0, zc), accent, bevel=0.012 * s))
    o.append(box('cover_plate', (0.004 * s, 0.11 * s, 0.07 * s), (-0.331 * s, 0, zc), m.zinc, bevel=0.001))
    for a in range(6):
        ang = math.radians(60 * a + 30)
        o.append(bolt((0.43 * s, 0.085 * s * math.cos(ang), zc + 0.085 * s * math.sin(ang)), (1, 0, 0), d=0.008 * s, material=m.zinc, stick=0))
    # chain outlet + chain + block
    xo = 0.04 * s
    o.append(box('outlet', (0.075 * s, 0.075 * s, 0.05 * s), (xo, 0, zc - 0.145 * s), accent, bevel=0.006 * s))
    top = Vector((xo, 0, zc - 0.165 * s))
    bot = top + Vector((0, 0, -drop))
    o += chain(top, bot, m, wire=0.0075 * s, pitch=0.024 * s, width=0.026 * s)
    blk, bowl = hook_block(m, s)
    for b in blk:
        b.matrix_world = Matrix.Translation(bot) @ b.matrix_world
    o += blk
    bowl = bowl + bot
    if bag:
        zb = zc - 0.14 * s
        o.append(member('bag', [(-0.085 * s, -0.075 * s), (0.085 * s, -0.075 * s), (0.085 * s, 0.075 * s), (-0.085 * s, 0.075 * s)],
                        (-0.12 * s, 0, zb - 0.30 * s), (-0.12 * s, 0, zb), m.black, up=(1, 0, 0), bevel=0.01 * s))
        o.append(box('bag_rim', (0.18 * s, 0.16 * s, 0.02 * s), (-0.12 * s, 0, zb - 0.005 * s), m.dgray, bevel=0.004))
    if pendant:
        px = -0.26 * s
        pts = catmull([(px, 0.02, zc - 0.11 * s), (px - 0.02, 0.04, zc - 0.4), (px + 0.015, 0.03, zc - pendant * 0.6), (px, 0.03, zc - pendant)], 10)
        o.append(sweep('pend_cable', pts, 0.007, m.black, segs=8))
        o += pendant_station(m, Vector((px, 0.03, zc - pendant)))
    g = join(o, 'hoist')
    return g, bowl


def pendant_station(m, top, buttons=4):
    o = []
    h = 0.05 + 0.04 * buttons
    c = Vector(top) + Vector((0, 0, -h / 2 - 0.02))
    o.append(member('pend', P_round_rect(0.06, 0.05, 0.014), c - Vector((0, 0, h / 2)), c + Vector((0, 0, h / 2)), m.cord, up=(1, 0, 0), bevel=0.004))
    o.append(cyl('pend_gland', 0.012, 0.03, Vector(top) + Vector((0, 0, -0.01)), m.black))
    for i in range(buttons):
        z = c.z + h / 2 - 0.045 - i * 0.04
        col = m.red if i == 0 else m.black
        o.append(cyl('btn', 0.013, 0.012, (c.x, c.y - 0.027, z), col, axis='y', bevel=0.002))
    return o


def beam_trolley(m, bf, s=1.0, color=None, motor=False):
    """Underhung trolley on the bottom flange of an I-beam running along X. Origin at the centre of the
    flange underside. Returns (objects, hang_point)."""
    c = color or m.red
    o = []
    off = bf / 2 + 0.012 * s
    for sy in (-1, 1):
        o.append(box('tr_plate', (0.30 * s, 0.012 * s, 0.20 * s), (0, sy * off, 0.0), c, bevel=0.003))
        for sx in (-1, 1):
            o.append(cyl('tr_wheel', 0.045 * s, 0.03 * s, (sx * 0.09 * s, sy * (bf / 2 - 0.022 * s), 0.057 * s), m.steel, axis='y'))
            o.append(bolt((sx * 0.09 * s, sy * (off + 0.006 * s), 0.057 * s), (0, sy, 0), d=0.018 * s, material=m.zinc, stick=0.004))
    o.append(cyl('tr_bar', 0.016 * s, bf + 0.07 * s, (0, 0, -0.065 * s), m.zinc, axis='y'))
    o.append(box('tr_lug', (0.07 * s, 0.03 * s, 0.07 * s), (0, 0, -0.075 * s), c, bevel=0.004))
    if motor:
        o.append(box('tr_gear', (0.10 * s, 0.09 * s, 0.11 * s), (0.11 * s, -(off + 0.05 * s), 0.05 * s), m.castblack, bevel=0.008))
        o.append(cyl('tr_motor', 0.045 * s, 0.14 * s, (0.11 * s, -(off + 0.165 * s), 0.05 * s), m.castblack, axis='y', bevel=0.006))
    return o, Vector((0, 0, -0.105 * s))


# ----------------------------------------------------------------- columns, runways
def base_column(x, y, top, m, size=8 * IN, plate=20 * IN, color=None, cap=True, gussets=False, pt=0.025, bolts=4):
    c = color or m.gray
    o = [box('baseplate', (plate, plate, pt), (x, y, 0), c, anchor='b', bevel=0.003)]
    o.append(hss('col', size, size, (x, y, pt), (x, y, top - (0.019 if cap else 0)), c, up=(1, 0, 0)))
    if cap:
        o.append(box('cap', (size + 0.09, size + 0.09, 0.019), (x, y, top - 0.019), c, anchor='b', bevel=0.002))
    e = plate / 2 - 0.05
    spots = [(sx * e, sy * e) for sx in (-1, 1) for sy in (-1, 1)]
    if bolts == 8:
        spots += [(sx * e, 0) for sx in (-1, 1)] + [(0, sy * e) for sy in (-1, 1)]
    for bx, by in spots:
        o.append(bolt((x + bx, y + by, pt), d=0.022, material=m.zinc, stick=0.022))
    if gussets:
        g = (plate - size) / 2 - 0.03
        t = 0.012
        for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0))):
            Y = Vector((0, 0, 1)).cross(d)
            p0 = Vector((x, y, pt)) + d * (size / 2 - 0.002) - Y * t / 2
            o.append(member('gusset', [(0, 0), (g, 0), (g, 0.025), (0.03, g * 1.4), (0, g * 1.4)], p0, p0 + Y * t, c, up=(0, 0, 1), bevel=0.001))
    return o


def knee(p_col, p_beam, m, color=None, size=0.064, plane_n=(1, 0, 0)):
    """Knee brace with gusset plates between a point on a column face and a point on a beam soffit."""
    c = color or m.gray
    p0, p1 = Vector(p_col), Vector(p_beam)
    d = (p1 - p0).normalized()
    o = [hss('knee', size, size, p0 + d * 0.07, p1 - d * 0.07, c, up=plane_n)]
    n = Vector(plane_n)
    for p, dd in ((p0, d), (p1, -d)):
        side = n.cross(dd)
        a = p - dd * 0.02
        ob = member('gusset', P_rect(0.012, 0.16), a, a + dd * 0.22, c, up=side, bevel=0.001)
        o.append(ob)
    return o


def runway(S, L, H, m, bays=2, beam=(0.31, 0.165, 0.0097, 0.0058), col=8 * IN, plate=20 * IN, knees=True,
           stops=True, color=None, over=0.25):
    """Free-standing top-running runway: two lines of columns along Y at x = +/-S/2, beam tops at z = H."""
    c = color or m.gray
    d, bf, tf, tw = beam
    ys = [-L / 2 + i * L / bays for i in range(bays + 1)]
    o = []
    for sx in (-1, 1):
        x = sx * S / 2
        for y in ys:
            o += base_column(x, y, H - d, m, col, plate, c)
        o.append(member('rw_beam', P_I(d, bf, tf, tw), (x, -L / 2 - over, H - d / 2), (x, L / 2 + over, H - d / 2), c))
        for y in ys:   # bearing stiffeners over columns
            for s2 in (-1, 1):
                o.append(box('stiff', ((bf - tw) / 2 - 0.004, 0.01, d - 2 * tf), (x + s2 * (bf + tw) / 4, y, H - d / 2), c, bevel=0.001))
        if knees:
            k = 0.85
            for i, y in enumerate(ys):
                for dr in (-1, 1):
                    if (i == 0 and dr < 0) or (i == bays and dr > 0):
                        continue
                    o += knee((x, y + dr * col / 2, H - d - k), (x, y + dr * (col / 2 + k), H - d), m, c)
        if stops:
            for e in (-1, 1):
                ye = e * (L / 2 + over - 0.07)
                o.append(box('stop', (bf * 0.8, 0.1, 0.2), (x, ye, H), m.yellow, anchor='b', bevel=0.004))
                o.append(cyl('stop_bumper', 0.04, 0.05, (x, ye - e * 0.075, H + 0.12), m.rubber, axis='y'))
    return o


def conductor_bars(p0, p1, normal, m, n=4, pitch=0.034, bar=(0.014, 0.022), standoff=0.05, every=1.2, cover_end=True):
    """Insulated conductor bars running p0->p1 (the lowest bar), stacked upward, standing off a face along `normal`."""
    p0, p1, nrm = Vector(p0), Vector(p1), Vector(normal).normalized()
    o = []
    for i in range(n):
        a = p0 + nrm * standoff + Vector((0, 0, i * pitch))
        b = p1 + nrm * standoff + Vector((0, 0, i * pitch))
        o.append(member('cbar', P_round_rect(bar[0], bar[1], 0.004, 3), a, b, m.orange, up=(0, 0, 1), bevel=0.0))
    L = (p1 - p0).length
    d = (p1 - p0).normalized()
    k = max(2, int(L / every) + 1)
    for j in range(k):
        q = p0 + d * (0.15 + (L - 0.3) * j / (k - 1))
        h = (n - 1) * pitch + 0.05
        o.append(member('cbracket', P_rect(0.03, h), q + Vector((0, 0, h / 2 - 0.025)), q + Vector((0, 0, h / 2 - 0.025)) + nrm * (standoff - 0.004), m.black, up=(0, 0, 1), bevel=0.001))
    return o


def control_box(m, size=(0.40, 0.20, 0.50), antenna=True, cords=True):
    """Wall-mount control enclosure. Local: back face on the plane y=0, front toward -Y, centred in x, base at z=0."""
    w, dp, h = size
    o = [box('encl', (w, dp, h), (0, -dp / 2, h / 2), m.white, bevel=0.006)]
    o.append(box('door', (w - 0.03, 0.006, h - 0.03), (0, -dp - 0.002, h / 2), m.white, bevel=0.003))
    o.append(cyl('latch', 0.012, 0.012, (w / 2 - 0.045, -dp - 0.008, h / 2), m.black, axis='y'))
    for z in (0.09, h - 0.09):
        o.append(cyl('hinge', 0.006, 0.05, (-w / 2 + 0.006, -dp - 0.004, z), m.zinc))
    o.append(box('label', (0.09, 0.002, 0.05), (0, -dp - 0.006, h - 0.1), m.cord, bevel=0.0005))
    for i, x in enumerate((-0.1, 0.0, 0.1)):
        o.append(cyl('gland', 0.013, 0.03, (x, -dp / 2, -0.012), m.black))
    if antenna:
        o.append(cyl('ant_base', 0.01, 0.02, (w / 2 - 0.06, -dp / 2, h + 0.01), m.black))
        o.append(cyl('antenna', 0.004, 0.13, (w / 2 - 0.06, -dp / 2, h + 0.08), m.black))
    return o


# ----------------------------------------------------------------- EZUP double-girder bridge
def ezup_end_truck(x, yb, H, m, Lt=1.5, tube=6 * IN, inward=1, drive=True):
    """End truck along Y on the runway beam at x. `inward` = +1 if the crane centre is toward +x."""
    o = []
    zb = H + 0.035
    zc = zb + tube / 2
    o.append(hss('truck', tube, tube, (x, yb - Lt / 2, zc), (x, yb + Lt / 2, zc), m.yellow))
    for e in (-1, 1):
        yp = yb + e * (Lt / 2 + 0.088)
        o.append(member('pocket', P_round_rect(0.19, 0.19, 0.022), (x, yp, H + 0.012), (x, yp, H + 0.27), m.yellow,
                        up=(1, 0, 0), bevel=0.0, inner=P_round_rect(0.17, 0.17, 0.014)))
        o.append(cyl('wheel', 0.085, 0.075, (x, yp, H + 0.085), m.poly, axis='x', bevel=0.006))
        o.append(cyl('wheel_hub', 0.045, 0.085, (x, yp, H + 0.085), m.steel, axis='x'))
        o.append(cyl('axle', 0.02, 0.215, (x, yp, H + 0.085), m.zinc, axis='x'))
        o.append(cyl('bumper', 0.036, 0.055, (x, yp + e * 0.122, H + 0.13), m.rubber, axis='y', bevel=0.008))
        o.append(box('guide', (0.27, 0.055, 0.008), (x, yp + e * 0.125, H + 0.024), m.yellow, bevel=0.001))
        for s in (-1, 1):
            o.append(cyl('hole', 0.03, 0.003, (x + s * tube / 2, yb + e * (Lt / 2 - 0.13), zc), m.black, axis='x', bevel=0))
    if drive:
        xd = x + inward * (tube / 2 + 0.105)
        yd = yb - Lt / 2 + 0.02
        o.append(box('gearbox', (0.20, 0.19, 0.23), (xd, yd, zc - 0.01), m.castblack, bevel=0.012))
        o.append(box('gear_flange', (0.012, 0.21, 0.25), (x + inward * (tube / 2 + 0.006), yd, zc - 0.01), m.yellow, bevel=0.002))
        o.append(cyl('drive_motor', 0.075, 0.26, (xd, yd + 0.225, zc + 0.02), m.castblack, axis='y', bevel=0.01))
        o.append(cyl('motor_cap', 0.078, 0.03, (xd, yd + 0.36, zc + 0.02), m.black, axis='y', bevel=0.008))
        for sy in (-1, 1):
            for sz in (-1, 1):
                o.append(bolt((xd + inward * 0.1, yd + sy * 0.07, zc - 0.01 + sz * 0.085), (inward, 0, 0), d=0.01, material=m.zinc, stick=0))
    return o, zb + tube


def ezup_trolley(xt, yb, ztop, gs, m, hang_drop=0.44):
    """Red top-running trolley across two girders (girder centres at yb +/- gs/2, rail tops at ztop).
    Returns (objects, hang_point)."""
    o = []
    wr = 0.055
    zs = ztop + 0.155
    for e in (-1, 1):
        yg = yb + e * gs / 2
        o.append(hss('trl_side', 0.076, 0.076, (xt - 0.42, yg, zs), (xt + 0.42, yg, zs), m.red))
        for sx in (-1, 1):
            xw = xt + sx * 0.33
            o.append(cyl('trl_wheel', wr, 0.045, (xw, yg, ztop + wr), m.poly, axis='y', bevel=0.004))
            o.append(cyl('trl_axle', 0.012, 0.11, (xw, yg, ztop + wr), m.zinc, axis='y'))
            for s2 in (-1, 1):
                o.append(box('trl_yoke', (0.10, 0.008, 0.125), (xw, yg + s2 * 0.034, ztop + 0.075), m.red, bevel=0.002))
    for sx in (-1, 1):
        o.append(hss('trl_cross', 0.076, 0.076, (xt + sx * 0.20, yb - gs / 2, zs), (xt + sx * 0.20, yb + gs / 2, zs), m.red))
    o.append(box('trl_deck', (0.36, 0.26, 0.012), (xt, yb, zs - 0.044), m.red, bevel=0.002))
    hz = zs - 0.044 - hang_drop
    for s2 in (-1, 1):
        o.append(box('trl_hanger', (0.012, 0.09, hang_drop), (xt + s2 * 0.05, yb, zs - 0.044 - hang_drop / 2), m.red, bevel=0.002))
    o.append(cyl('trl_pin', 0.016, 0.14, (xt, yb, hz + 0.03), m.zinc, axis='x'))
    # trolley drive: gearmotor on the far side beam and a cross shaft
    yg = yb + gs / 2
    o.append(box('trl_gear', (0.13, 0.11, 0.14), (xt - 0.33, yg + 0.10, ztop + 0.07), m.castblack, bevel=0.01))
    o.append(cyl('trl_motor', 0.052, 0.18, (xt - 0.33 + 0.15, yg + 0.10, ztop + 0.085), m.castblack, axis='x', bevel=0.008))
    o.append(cyl('trl_shaft', 0.011, gs, (xt - 0.33, yb, ztop + wr), m.zinc, axis='y'))
    return o, Vector((xt, yb, hz + 0.045))


def ezup_bridge(S, yb, H, m, gs=30 * IN, girder=(4 * IN, 14 * IN), xt=0.0, drop=1.6, plate='nameplate-3ton.png',
                near=-1, hoist_scale=1.0, Lt=1.5, tube=6 * IN, cbars=True, panel_end=-1, control=True,
                box_size=(0.40, 0.20, 0.50), pendant=0.0, plate_x=None, hang_drop=0.44):
    """EZUP double-girder top-running bridge on runway beams at x = +/-S/2 with tops at z = H.
    `near` is the Y side (-1 or +1) that carries the conductor bars, nameplate and control panel."""
    gw, gh = girder
    o = []
    for sx in (-1, 1):
        t, gz0 = ezup_end_truck(sx * S / 2, yb, H, m, Lt, tube, inward=-sx)
        o += t
    ztop = gz0 + gh + 0.012
    for e in (-1, 1):
        yg = yb + e * gs / 2
        o.append(hss('girder', gw, gh, (-S / 2 - tube / 2 - 0.02, yg, gz0 + gh / 2), (S / 2 + tube / 2 + 0.02, yg, gz0 + gh / 2), m.yellow, r=0.012))
        o.append(box('rail', (S + tube - 0.05, 0.05, 0.012), (0, yg, gz0 + gh), m.zinc, anchor='b', bevel=0.002))
        for sx in (-1, 1):
            xs = sx * S / 2
            # trolley end stop posts on the end truck, outboard of each girder
            o.append(member('post', P_round_rect(0.1, 0.1, 0.012), (xs, yb + e * (gs / 2 + gw / 2 + 0.07), gz0), (xs, yb + e * (gs / 2 + gw / 2 + 0.07), gz0 + 0.30), m.yellow,
                            up=(1, 0, 0), bevel=0.0, inner=P_round_rect(0.084, 0.084, 0.006)))
            # bolted clip angles, girder to end truck
            for s2 in (-1, 1):
                yc = yg + s2 * (gw / 2 + 0.004)
                o.append(box('clip', (tube - 0.02, 0.008, 0.09), (xs, yc, gz0 + 0.045), m.yellow, bevel=0.001))
                o.append(box('clip_h', (tube - 0.02, 0.06, 0.008), (xs, yc + s2 * 0.03, gz0 + 0.004), m.yellow, bevel=0.001))
                for bx in (-0.04, 0.04):
                    o.append(bolt((xs + bx, yc + s2 * 0.004, gz0 + 0.05), (0, s2, 0), d=0.014, material=m.yellow, stick=0.006))
                    o.append(bolt((xs + bx, yc + s2 * 0.035, gz0 + 0.008), (0, 0, 1), d=0.014, material=m.yellow, stick=0.006))
            # trolley stop bumpers on the rail ends
            o.append(box('rail_stop', (0.03, 0.06, 0.07), (sx * (S / 2 - tube / 2 - 0.01), yg, gz0 + gh + 0.012), m.yellow, anchor='b', bevel=0.003))
    tr, hang = ezup_trolley(xt, yb, ztop, gs, m, hang_drop=hang_drop)
    o += tr
    g, bowl = chain_hoist(m, drop=drop, s=hoist_scale, pendant=pendant)
    g.location = hang
    bowl = bowl + hang
    yface = yb + near * (gs / 2 + gw / 2)
    nrm = (0, near, 0)
    if cbars:
        z0 = gz0 + 0.035
        xa = -S / 2 + (0.95 if panel_end < 0 else 0.3)
        xb = S / 2 - (0.95 if panel_end > 0 else 0.3)
        o += conductor_bars((xa, yface, z0), (xb, yface, z0), nrm, m)
        # collector arm from the trolley
        ys = yb + near * gs / 2
        ya = yface + near * 0.085
        zs = ztop + 0.155
        o.append(box('coll_arm_h', (0.04, abs(ya - ys) + 0.04, 0.012), (xt + 0.12, (ya + ys) / 2, zs + 0.044), m.red, bevel=0.002))
        o.append(box('coll_arm_v', (0.04, 0.012, zs + 0.05 - z0), (xt + 0.12, ya, (zs + 0.05 + z0) / 2), m.red, bevel=0.002))
        for i in range(4):
            o.append(box('coll_shoe', (0.07, 0.03, 0.022), (xt + 0.12, ya - near * 0.02, z0 + i * 0.034), m.black, bevel=0.003))
    if plate:
        pm = image_mat('plate_' + plate, os.path.join(TEX, plate), rough=0.3)
        ph = min(0.15, gh * 0.5)
        pw = ph * 4.3
        px = plate_x if plate_x is not None else panel_end * (S / 2 - 2.2)
        o.append(plane('nameplate', pw, ph, pm, (px, yface + near * 0.0015, gz0 + gh - ph / 2 - 0.02), normal=nrm))
    if control:
        cb = control_box(m, size=box_size)
        e = join(cb, 'control')
        e.rotation_euler = (0, 0, 0 if near < 0 else math.pi)
        e.location = (panel_end * (S / 2 - 0.22 - box_size[0]), yface, gz0 + gh + 0.03 - box_size[2])
        # power cord from the box down to the conductor collector on the runway side
        o.append(e)
    return o, bowl, g


# ----------------------------------------------------------------- loads
def crate(m, size=(1.0, 0.8, 0.7)):
    """Wooden shipping crate, base centre at origin."""
    sx, sy, sz = size
    o = []
    for y in (-sy / 2 + 0.05, 0, sy / 2 - 0.05):
        o.append(box('skid', (sx, 0.09, 0.09), (0, y, 0), m.wood, anchor='b', bevel=0.004))
    b = sz - 0.09
    o.append(box('crate_body', (sx - 0.04, sy - 0.04, b), (0, 0, 0.09), m.ply, anchor='b', bevel=0.003))
    bw, bt = 0.09, 0.02
    for s in (-1, 1):
        y = s * (sy / 2 - 0.02 + bt / 2)
        for z in (0.09 + bw / 2, sz - bw / 2):
            o.append(box('cleat', (sx, bt, bw), (0, y, z), m.wood, bevel=0.003))
        for x in (-sx / 2 + bw / 2, 0, sx / 2 - bw / 2):
            o.append(box('cleat', (bw, bt, b - 2 * bw), (x, y, 0.09 + b / 2), m.wood, bevel=0.003))
        x = s * (sx / 2 - 0.02 + bt / 2)
        for z in (0.09 + bw / 2, sz - bw / 2):
            o.append(box('cleat', (bt, sy - 0.04, bw), (x, 0, z), m.wood, bevel=0.003))
        for y2 in (-sy / 2 + 0.02 + bw / 2, sy / 2 - 0.02 - bw / 2):
            o.append(box('cleat', (bt, bw, b - 2 * bw), (x, y2, 0.09 + b / 2), m.wood, bevel=0.003))
    o.append(box('lid', (sx + 0.01, sy + 0.01, 0.02), (0, 0, sz), m.wood, anchor='b', bevel=0.003))
    return o


def pallet(m, size=(1.2, 1.0)):
    sx, sy = size
    o = []
    for y in (-sy / 2 + 0.045, 0, sy / 2 - 0.045):
        o.append(box('stringer', (sx, 0.04, 0.095), (0, y, 0.018), m.wood, anchor='b', bevel=0.003))
    n = 7
    for i in range(n):
        x = -sx / 2 + 0.05 + i * (sx - 0.1) / (n - 1)
        o.append(box('deck', (0.1, sy, 0.018), (x, 0, 0.113), m.wood, anchor='b', bevel=0.003))
    for x in (-sx / 2 + 0.05, 0, sx / 2 - 0.05):
        o.append(box('bottom', (0.1, sy, 0.018), (x, 0, 0), m.wood, anchor='b', bevel=0.003))
    return o


def sling_legs(hook_pt, pts, m, r=0.009, color=None, sag=0.0):
    """Sling legs from the hook bowl to pick points."""
    o = []
    for p in pts:
        o.append(sweep('sling', [Vector(hook_pt), Vector(p)], r, color or m.sling_y, segs=10))
    return o


def place(objs, loc=(0, 0, 0), rz=0.0, name='grp'):
    e = join([o for o in objs if o.parent is None], name)
    e.location = loc
    e.rotation_euler = (0, 0, rz)
    return e


def wheel_block(m, loc=(0, 0, 0)):
    """Stand-alone EZUP wheel block (pocket, polyurethane wheel, axle, bumper) sitting on the floor."""
    x, y, z = loc
    o = [member('pocket', P_round_rect(0.19, 0.19, 0.022), (x, y, z + 0.012), (x, y, z + 0.27), m.yellow, up=(1, 0, 0), bevel=0.0,
                inner=P_round_rect(0.17, 0.17, 0.014))]
    o.append(cyl('wheel', 0.085, 0.075, (x, y, z + 0.085), m.poly, axis='x', bevel=0.006))
    o.append(cyl('wheel_hub', 0.045, 0.085, (x, y, z + 0.085), m.steel, axis='x'))
    o.append(cyl('axle', 0.02, 0.215, (x, y, z + 0.085), m.zinc, axis='x'))
    o.append(cyl('bumper', 0.036, 0.055, (x, y - 0.122, z + 0.13), m.rubber, axis='y', bevel=0.008))
    return o


# ----------------------------------------------------------------- light (enclosed-track) rail
def P_rail(w=0.10, h=0.125, slot=0.028, c=0.018):
    return [(-w / 2, -h / 2 + c), (-w / 2 + c, -h / 2), (-slot / 2, -h / 2), (-slot / 2, -h / 2 + 0.03), (slot / 2, -h / 2 + 0.03),
            (slot / 2, -h / 2), (w / 2 - c, -h / 2), (w / 2, -h / 2 + c), (w / 2, h / 2 - c), (w / 2 - c, h / 2), (-w / 2 + c, h / 2), (-w / 2, h / 2 - c)]


def rail(p0, p1, m, color=None, caps=True, w=0.10, h=0.125):
    """Enclosed-track rail between two points (centre of section)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    o = [member('rail', P_rail(w, h), p0, p1, color or m.alu, bevel=0.0015)]
    if caps:
        cap = P_round_rect(w + 0.008, h + 0.008, 0.012)
        o.append(member('rail_cap', cap, p0 - d * 0.018, p0 + d * 0.004, m.black, bevel=0.002))
        o.append(member('rail_cap', cap, p1 - d * 0.004, p1 + d * 0.018, m.black, bevel=0.002))
    return o


def rail_path(pts, m, color=None, w=0.10, h=0.125):
    """Enclosed-track rail swept along a horizontal polyline (for curves)."""
    import bmesh
    prof = P_rail(w, h)
    P = [Vector(p) for p in pts]
    bm = bmesh.new()
    rings = []
    n = len(P)
    for i in range(n):
        a = P[max(i - 1, 0)]
        b = P[min(i + 1, n - 1)]
        t = (b - a).normalized()
        side = Vector((t.y, -t.x, 0))
        rings.append([bm.verts.new(P[i] + side * x + Vector((0, 0, z))) for x, z in prof])
    k = len(prof)
    for i in range(n - 1):
        for j in range(k):
            l = (j + 1) % k
            bm.faces.new((rings[i][j], rings[i][l], rings[i + 1][l], rings[i + 1][j]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return kit._finish('rail_curve', bm, color or m.alu, 0.0, angle=30)


def rail_hanger(p, zsup, m, along='y', h=0.125):
    """Threaded-rod hanger from a support at height zsup down to the top of a rail centred at p."""
    p = Vector(p)
    top = p.z + h / 2
    sz = (0.13, 0.055, 0.03) if along == 'y' else (0.055, 0.13, 0.03)
    o = [box('h_clamp', sz, (p.x, p.y, top + 0.012), m.dgray, bevel=0.004)]
    o.append(cyl('h_rod', 0.008, zsup - top - 0.02, (p.x, p.y, (zsup + top + 0.02) / 2), m.zinc))
    o.append(cyl('h_ball', 0.022, 0.03, (p.x, p.y, top + 0.04), m.zinc, bevel=0.006))
    o.append(box('h_bracket', (0.09, 0.09, 0.012), (p.x, p.y, zsup - 0.006), m.dgray, bevel=0.002))
    o.append(cyl('h_nut', 0.014, 0.014, (p.x, p.y, zsup - 0.02), m.zinc, segs=6, bevel=0.001))
    return o


def rail_carrier(p, m, drop=0.07, along='x'):
    """Small trolley/carrier block visible below a rail slot. p = bottom centre of the rail."""
    p = Vector(p)
    sz = (0.11, 0.045, drop) if along == 'x' else (0.045, 0.11, drop)
    o = [box('carrier', sz, (p.x, p.y, p.z - drop / 2 + 0.01), m.dgray, bevel=0.006)]
    o.append(cyl('carrier_pin', 0.012, 0.07, (p.x, p.y, p.z - drop + 0.02), m.zinc, axis='y' if along == 'x' else 'x'))
    return o


# ----------------------------------------------------------------- hoist on an I-beam
def hoist_on_beam(m, p, bf, rz=0.0, s=1.0, drop=1.4, motor=True, pendant=0.0, trolley_color=None, bag=True):
    """Trolley + chain hoist under an I-beam flange. p = centre of flange underside. rz rotates about Z
    (0 for beams along X, pi/2 for beams along Y). Returns world position of the hook bowl."""
    tr, hang = beam_trolley(m, bf, s, trolley_color, motor)
    g, bowl = chain_hoist(m, drop=drop, s=s, pendant=pendant, bag=bag)
    g.location = hang
    e = place(tr + [g], p, rz, 'hoist_unit')
    return Vector(p) + Matrix.Rotation(rz, 3, 'Z') @ (hang + bowl)


# ----------------------------------------------------------------- shop furniture and loads
def workbench(m, size=(1.8, 0.8, 0.9)):
    sx, sy, sz = size
    o = [box('bench_top', (sx, sy, 0.045), (0, 0, sz - 0.045), m.wood, anchor='b', bevel=0.004)]
    for x in (-sx / 2 + 0.06, sx / 2 - 0.06):
        for y in (-sy / 2 + 0.06, sy / 2 - 0.06):
            o.append(hss('bench_leg', 0.05, 0.05, (x, y, 0), (x, y, sz - 0.045), m.dgray, up=(1, 0, 0)))
    for y in (-sy / 2 + 0.06, sy / 2 - 0.06):
        o.append(hss('bench_rail', 0.04, 0.04, (-sx / 2 + 0.06, y, 0.2), (sx / 2 - 0.06, y, 0.2), m.dgray))
        o.append(hss('bench_rail', 0.04, 0.04, (-sx / 2 + 0.06, y, sz - 0.085), (sx / 2 - 0.06, y, sz - 0.085), m.dgray))
    for x in (-sx / 2 + 0.06, sx / 2 - 0.06):
        o.append(hss('bench_rail', 0.04, 0.04, (x, -sy / 2 + 0.06, 0.2), (x, sy / 2 - 0.06, 0.2), m.dgray))
    o.append(box('bench_shelf', (sx - 0.14, sy - 0.14, 0.02), (0, 0, 0.21), m.lgray, anchor='b', bevel=0.002))
    return o


def gear_part(m, s=1.0):
    """Blue gearbox-style casting with shafts and a lifting eye. Base centre at origin. Returns (objs, eye_point)."""
    o = [box('casting', (0.52 * s, 0.36 * s, 0.30 * s), (0, 0, 0.04 * s), m.blue, anchor='b', bevel=0.03 * s, segs=3)]
    o.append(box('casting_foot', (0.60 * s, 0.42 * s, 0.04 * s), (0, 0, 0), m.blue, anchor='b', bevel=0.006))
    for sx in (-1, 1):
        o.append(cyl('flange', 0.11 * s, 0.05 * s, (sx * 0.28 * s, 0, 0.19 * s), m.blue, axis='x', bevel=0.006))
        o.append(cyl('shaft', 0.032 * s, 0.14 * s, (sx * 0.36 * s, 0, 0.19 * s), m.steel, axis='x'))
        for a in range(6):
            ang = math.radians(60 * a)
            o.append(bolt((sx * 0.305 * s, 0.085 * s * math.cos(ang), 0.19 * s + 0.085 * s * math.sin(ang)), (sx, 0, 0), d=0.012 * s, material=m.zinc, stick=0))
    o.append(box('cover', (0.34 * s, 0.24 * s, 0.015 * s), (0, 0, 0.34 * s), m.blue, anchor='b', bevel=0.003))
    ring = [(0.03 * s * math.cos(t), 0, 0.395 * s + 0.03 * s * math.sin(t)) for t in [2 * math.pi * i / 16 for i in range(16)]]
    o.append(sweep('eye', ring, 0.008 * s, m.zinc, segs=8, closed=True))
    return o, Vector((0, 0, 0.42 * s))


def plate_stack(m, size=(1.5, 0.9), n=6, t=0.022):
    o = []
    for i in range(n):
        dx = (0.012 if i % 2 else -0.008) * (1 + i % 3)
        o.append(box('steel_plate', (size[0], size[1], t), (dx, -dx * 0.6, i * (t + 0.001)), m.dsteel, anchor='b', bevel=0.002))
    return o, n * (t + 0.001)


def tank(m, size=(2.0, 1.2, 1.0), t=0.012, liquid='#27506B'):
    sx, sy, sz = size
    c = mat('stainless', (0.72, 0.73, 0.74, 1), rough=0.32, metal=1.0)
    lq = mat('liquid_' + liquid, liquid, rough=0.08, coat=0.6)
    o = [box('tank_bottom', (sx, sy, t), (0, 0, 0.1), c, anchor='b', bevel=0.002)]
    for s in (-1, 1):
        o.append(box('tank_wall', (sx, t, sz - 0.1), (0, s * (sy / 2 - t / 2), 0.1), c, anchor='b', bevel=0.002))
        o.append(box('tank_wall', (t, sy, sz - 0.1), (s * (sx / 2 - t / 2), 0, 0.1), c, anchor='b', bevel=0.002))
        o.append(hss('tank_rim', 0.05, 0.05, (-sx / 2, s * (sy / 2), sz), (sx / 2, s * (sy / 2), sz), c))
        o.append(hss('tank_rim', 0.05, 0.05, (s * (sx / 2), -sy / 2, sz), (s * (sx / 2), sy / 2, sz), c))
        for x in (-sx / 2 + 0.15, sx / 2 - 0.15):
            o.append(hss('tank_leg', 0.06, 0.06, (x, s * (sy / 2 - 0.05), 0), (x, s * (sy / 2 - 0.05), 0.1), m.dgray, up=(1, 0, 0)))
    o.append(box('liquid', (sx - 2 * t, sy - 2 * t, 0.01), (0, 0, sz - 0.18), lq, anchor='b', bevel=0))
    return o


def parts_basket(m, size=(1.2, 0.7, 0.6)):
    """Open steel parts basket with a lifting bail. Base centre at origin. Returns (objs, pick_point)."""
    sx, sy, sz = size
    o = []
    c = m.zinc
    for z in (0, sz):
        for s in (-1, 1):
            o.append(hss('bk', 0.03, 0.03, (-sx / 2, s * sy / 2, z), (sx / 2, s * sy / 2, z), c))
            o.append(hss('bk', 0.03, 0.03, (s * sx / 2, -sy / 2, z), (s * sx / 2, sy / 2, z), c))
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            o.append(hss('bk', 0.03, 0.03, (sx_ * sx / 2, sy_ * sy / 2, 0), (sx_ * sx / 2, sy_ * sy / 2, sz), c, up=(1, 0, 0)))
    n = 9
    for i in range(1, n):
        x = -sx / 2 + i * sx / n
        o.append(cyl('bk_bar', 0.006, sy, (x, 0, 0.0), c, axis='y'))
        for s in (-1, 1):
            o.append(cyl('bk_bar', 0.006, sz, (x, s * sy / 2, sz / 2), c))
    for i in range(5):
        o.append(cyl('part', 0.07, 0.5, (-0.4 + i * 0.2, 0, 0.09), m.steel, axis='y', bevel=0.004))
        if i < 4:
            o.append(cyl('part', 0.07, 0.5, (-0.3 + i * 0.2, 0, 0.21), m.steel, axis='y', bevel=0.004))
    top = Vector((0, 0, sz + 0.55))
    for s in (-1, 1):
        o.append(sweep('bail', [(s * sx / 2, 0, sz), top], 0.008, m.dsteel, segs=8))
    return o, top


def caster(m, r=0.10):
    """Swivel caster. Origin at the top of the mounting plate; wheel bottom at z = -(2r + 0.06)."""
    o = [box('cst_plate', (0.14, 0.12, 0.008), (0, 0, -0.004), m.zinc, bevel=0.001)]
    o.append(cyl('cst_swivel', 0.045, 0.03, (0, 0, -0.023), m.zinc))
    zc = -(r + 0.06)
    for s in (-1, 1):
        o.append(box('cst_fork', (0.07, 0.006, r + 0.05), (0.03, s * 0.036, -0.038 - (r + 0.05) / 2 + 0.01), m.zinc, bevel=0.001))
    o.append(cyl('cst_wheel', r, 0.05, (0.035, 0, zc), m.poly, axis='y', bevel=0.008))
    o.append(cyl('cst_hub', r * 0.55, 0.054, (0.035, 0, zc), m.dgray, axis='y'))
    o.append(cyl('cst_axle', 0.01, 0.09, (0.035, 0, zc), m.zinc, axis='y'))
    return o


def P_lug(R, D, n=32):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        if s >= -1e-9:
            pts.append((R * c, R * s))
        else:
            t = min(R / abs(c) if abs(c) > 1e-6 else 1e9, D / abs(s))
            pts.append((t * c, t * s))
    return pts


def lug(m, R=0.07, D=0.10, hole=0.03, t=0.025, color=None, flip=False):
    """Plate lug with a hole. Local: hole centre at origin, plate in the XZ plane, base D below the hole
    (or above when flip=True), thickness centred on Y."""
    ob = ring_prism('lug', P_lug(R, D), P_circle(hole, 32), t, color or m.yellow, bevel=0.002)
    M = Matrix.Translation((0, -t / 2, 0))
    if flip:
        M = Matrix.Rotation(math.pi, 4, 'Y') @ M
    ob.matrix_world = M
    return ob


def shackle(m, s=1.0, down=True):
    """Bow shackle. Pin along X through the origin, bow hanging down (-Z) or up."""
    a, b = 0.03 * s, 0.07 * s
    sg = -1 if down else 1
    pts = [(-a, 0, 0), (-a * 1.25, 0, sg * b * 0.55)]
    for i in range(9):
        t = math.pi * i / 8
        pts.append((-a * 1.25 * math.cos(t), 0, sg * (b * 0.75 + a * 1.1 * math.sin(t))))
    pts += [(a * 1.25, 0, sg * b * 0.55), (a, 0, 0)]
    o = [sweep('shackle', catmull(pts, 3), 0.011 * s, m.zinc, segs=10)]
    o.append(cyl('shackle_pin', 0.013 * s, 2 * a + 0.05 * s, (0, 0, 0), m.zinc, axis='x'))
    o.append(cyl('shackle_head', 0.02 * s, 0.012 * s, (a + 0.03 * s, 0, 0), m.red, axis='x', segs=6))
    return o


# ----------------------------------------------------------------- controls
def radio_tx(m):
    """Handheld crane radio transmitter lying on its back; long axis along Y, origin at the base centre."""
    o = [member('tx_body', P_round_rect(0.072, 0.038, 0.014), (0, -0.095, 0.019), (0, 0.095, 0.019), m.black, bevel=0.006)]
    o.append(box('tx_face', (0.058, 0.165, 0.006), (0, 0, 0.039), m.cord, bevel=0.002))
    o.append(cyl('tx_estop_base', 0.016, 0.006, (0, 0.062, 0.045), m.cord))
    o.append(cyl('tx_estop', 0.0135, 0.014, (0, 0.062, 0.054), m.red, bevel=0.004))
    for r in range(4):
        for c in (-1, 1):
            o.append(cyl('tx_btn', 0.0095, 0.007, (c * 0.015, 0.026 - r * 0.027, 0.0445), m.dgray, bevel=0.002))
    o.append(box('tx_led', (0.02, 0.006, 0.002), (0, -0.074, 0.0425), m.zinc, bevel=0.0005))
    o.append(cyl('tx_ant', 0.007, 0.03, (0.022, 0.108, 0.02), m.black, axis='y', bevel=0.003))
    return o


def vfd(m, size=(0.09, 0.14, 0.18)):
    """Variable frequency drive module. Local: back on y=0, front toward -Y, base z=0."""
    w, d, h = size
    o = [box('vfd', (w, d, h), (0, -d / 2, h / 2), m.dgray, bevel=0.004)]
    o.append(box('vfd_face', (w - 0.012, 0.004, h * 0.55), (0, -d - 0.001, h * 0.66), m.lgray, bevel=0.002))
    o.append(box('vfd_disp', (w * 0.55, 0.003, 0.022), (0, -d - 0.004, h * 0.82), m.black, bevel=0.001))
    for i in range(3):
        o.append(cyl('vfd_key', 0.006, 0.004, ((i - 1) * 0.02, -d - 0.004, h * 0.62), m.dgray, axis='y', bevel=0.001))
    for i in range(6):
        o.append(box('vfd_vent', (w - 0.03, 0.003, 0.004), (0, -d - 0.001, h * 0.08 + i * 0.011), m.black, bevel=0))
    return o


def control_panel_open(m, size=(0.60, 0.22, 0.76)):
    """Crane control enclosure with the door open, showing drives and terminals. Back on y=0, base z=0."""
    w, d, h = size
    t = 0.012
    o = [box('enc_back', (w, t, h), (0, -t / 2, h / 2), m.white, bevel=0.003)]
    for s in (-1, 1):
        o.append(box('enc_side', (t, d, h), (s * (w / 2 - t / 2), -d / 2, h / 2), m.white, bevel=0.003))
        o.append(box('enc_tb', (w, d, t), (0, -d / 2, h / 2 + s * (h / 2 - t / 2)), m.white, bevel=0.003))
    o.append(box('backpanel', (w - 0.06, 0.004, h - 0.06), (0, -t - 0.012, h / 2), m.zinc, bevel=0.001))
    yb = -t - 0.014
    # wire duct
    duct = mat('duct_gray', '#9EA3A8', rough=0.6)
    for z in (h - 0.085, h * 0.47, 0.085):
        o.append(box('duct', (w - 0.1, 0.045, 0.04), (0, yb - 0.0225, z), duct, bevel=0.002))
    for s in (-1, 1):
        o.append(box('duct', (0.04, 0.045, h - 0.13), (s * (w / 2 - 0.07), yb - 0.0225, h / 2), duct, bevel=0.002))
    # two drives on the upper row, breaker + contactors
    for i, x in enumerate((-0.13, -0.02)):
        for ob in vfd(m):
            ob.matrix_world = Matrix.Translation((x, yb, h * 0.53)) @ ob.matrix_world
            o.append(ob)
    o.append(box('breaker', (0.075, 0.075, 0.12), (0.12, yb - 0.0375, h * 0.53 + 0.09), m.black, bevel=0.003))
    o.append(box('breaker_handle', (0.02, 0.02, 0.035), (0.12, yb - 0.085, h * 0.53 + 0.09), m.white, bevel=0.003))
    o.append(box('xfmr', (0.09, 0.08, 0.09), (0.12, yb - 0.04, h * 0.53 - 0.035 + 0.0), m.orange, bevel=0.004))
    # lower row: DIN rail with contactors and terminals
    zr = 0.24
    o.append(box('din', (w - 0.2, 0.008, 0.035), (0, yb - 0.004, zr), m.zinc, bevel=0.001))
    cont = mat('contactor', '#D9D7D0', rough=0.5)
    for i in range(4):
        o.append(box('contactor', (0.044, 0.07, 0.075), (-0.17 + i * 0.05, yb - 0.043, zr), cont, bevel=0.003))
        o.append(box('cont_top', (0.03, 0.01, 0.03), (-0.17 + i * 0.05, yb - 0.08, zr), m.black, bevel=0.002))
    term = mat('terminal', '#8A8F96', rough=0.55)
    for i in range(14):
        col = term if i % 5 else m.cord
        o.append(box('terminal', (0.0075, 0.045, 0.05), (0.035 + i * 0.0085, yb - 0.03, zr), col, bevel=0.001))
    # door, open about the left hinge
    door = [box('door', (w, 0.02, h), (w / 2, -0.01, h / 2), m.white, bevel=0.004)]
    for zz in (0.03, h - 0.03):
        door.append(box('door_gasket', (w - 0.06, 0.006, 0.012), (w / 2, 0.003, zz), m.black, bevel=0.001))
    for xx in (0.03, w - 0.03):
        door.append(box('door_gasket', (0.012, 0.006, h - 0.06), (xx, 0.003, h / 2), m.black, bevel=0.001))
    door.append(box('doc_pocket', (w * 0.5, 0.02, h * 0.28), (w / 2, 0.01, h * 0.3), m.lgray, bevel=0.003))
    door.append(box('doc_sheet', (w * 0.42, 0.004, h * 0.3), (w / 2, 0.014, h * 0.36), mat('paper', '#F2F1EC', rough=0.6), bevel=0.0005))
    door.append(cyl('door_latch', 0.014, 0.014, (w - 0.045, -0.024, h / 2), m.black, axis='y'))
    door.append(box('door_label', (0.12, 0.002, 0.06), (w / 2, -0.021, h - 0.12), m.cord, bevel=0.0005))
    e = join(door, 'door')
    e.location = (-w / 2, -d, 0)
    e.rotation_euler = (0, 0, math.radians(-118))
    o.append(e)
    for x in (-0.15, 0.0, 0.15):
        o.append(cyl('gland', 0.016, 0.03, (x, -d / 2, -0.012), m.black))
    o.append(cyl('ant_base', 0.012, 0.02, (w / 2 - 0.08, -d / 2, h + 0.01), m.black))
    o.append(cyl('antenna', 0.004, 0.16, (w / 2 - 0.08, -d / 2, h + 0.09), m.black))
    return o
