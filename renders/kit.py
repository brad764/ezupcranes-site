"""Core helpers for building and rendering crane product scenes with Blender (bpy) + Cycles.

Units are metres. IN and FT convert from inches and feet.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

IN = 0.0254
FT = 0.3048
COL = None          # active collection
HERO = False        # set by render.py --hero: frame the annotation lines too
_mats = {}
_bolt_mesh = {}


# ----------------------------------------------------------------- scene / materials
def reset():
    global COL
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear(); _bolt_mesh.clear()
    COL = bpy.context.scene.collection
    return bpy.context.scene


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def _principled(m):
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        nt.nodes.clear()
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(b.outputs[0], out.inputs[0])
    return b


def mat(name, color=None, rough=0.5, metal=0.0, coat=0.0, emit=None, emit_strength=0.0, ior=None,
        bump=0.0, bump_scale=200.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = _principled(m)
    b.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if emit:
        b.inputs['Emission Color'].default_value = srgb(emit) if isinstance(emit, str) else emit
        b.inputs['Emission Strength'].default_value = emit_strength
    if ior:
        b.inputs['IOR'].default_value = ior
    if bump:
        nt = m.node_tree
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = bump_scale
        noise.inputs['Detail'].default_value = 4.0
        bn = nt.nodes.new('ShaderNodeBump')
        bn.inputs['Strength'].default_value = bump
        bn.inputs['Distance'].default_value = 0.002
        nt.links.new(noise.outputs['Fac'], bn.inputs['Height'])
        nt.links.new(bn.outputs['Normal'], b.inputs['Normal'])
    _mats[name] = m
    return m


def image_mat(name, path, rough=0.35, alpha=False):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = _principled(m)
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path)
    tex.extension = 'EXTEND'
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = rough
    _mats[name] = m
    return m


# ----------------------------------------------------------------- mesh plumbing
def _finish(name, bm, material=None, bevel=0.0, segs=2, smooth=True, angle=35):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    if material is not None:
        me.materials.append(material)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(angle))
    if bevel > 0:
        b = ob.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = segs
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(angle)
        if smooth:
            wn = ob.modifiers.new('WN', 'WEIGHTED_NORMAL')
            wn.keep_sharp = True
            wn.weight = 100
    return ob


def V(*a):
    return Vector(a[0]) if len(a) == 1 else Vector(a)


def box(name, size, loc=(0, 0, 0), material=None, bevel=0.003, anchor='c', rot=None, segs=2):
    """Axis-aligned box. anchor: 'c' centre, 'b' bottom-centre, 'min' minimum corner."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    ob = _finish(name, bm, material, min(bevel, min(size) * 0.3), segs)
    loc = Vector(loc)
    if anchor == 'b':
        loc = loc + Vector((0, 0, size[2] / 2))
    elif anchor == 'min':
        loc = loc + Vector(size) / 2
    M = Matrix.Translation(loc)
    if rot:
        from mathutils import Euler
        M = M @ Euler(rot).to_matrix().to_4x4()
    ob.matrix_world = M
    return ob


def cyl(name, r, h, loc=(0, 0, 0), material=None, axis='z', segs=40, bevel=0.002, r2=None, anchor='c'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r, radius2=r if r2 is None else r2, depth=h)
    ob = _finish(name, bm, material, min(bevel, r * 0.3, h * 0.3))
    loc = Vector(loc)
    R = Matrix.Identity(4)
    if axis == 'x':
        R = Matrix.Rotation(math.radians(90), 4, 'Y')
        if anchor == 'b': loc.x += h / 2
    elif axis == 'y':
        R = Matrix.Rotation(math.radians(-90), 4, 'X')
        if anchor == 'b': loc.y += h / 2
    else:
        if anchor == 'b': loc.z += h / 2
    ob.matrix_world = Matrix.Translation(loc) @ R
    return ob


def frame(p0, p1, up=(0, 0, 1)):
    """Matrix whose local +Y runs p0->p1, local +Z as close to `up` as possible, origin at p0."""
    p0, p1, up = Vector(p0), Vector(p1), Vector(up)
    y = (p1 - p0).normalized()
    z = up - up.dot(y) * y
    if z.length < 1e-6:
        alt = Vector((1, 0, 0)) if abs(y.x) < 0.9 else Vector((0, 1, 0))
        z = alt - alt.dot(y) * y
    z.normalize()
    x = y.cross(z)
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = p0
    return M


def prism(name, pts, length, material=None, bevel=0.002, segs=2):
    """Extrude a closed 2D profile (x, z) along local +Y."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0, length, 0))
    return _finish(name, bm, material, bevel, segs)


def ring_prism(name, outer, inner, length, material=None, bevel=0.0015):
    """Hollow section: outer and inner loops with equal vertex counts, extruded along +Y."""
    bm = bmesh.new()
    n = len(outer)
    O0 = [bm.verts.new((x, 0, z)) for x, z in outer]
    I0 = [bm.verts.new((x, 0, z)) for x, z in inner]
    O1 = [bm.verts.new((x, length, z)) for x, z in outer]
    I1 = [bm.verts.new((x, length, z)) for x, z in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((O0[i], O0[j], O1[j], O1[i]))
        bm.faces.new((I0[j], I0[i], I1[i], I1[j]))
        bm.faces.new((O0[j], O0[i], I0[i], I0[j]))
        bm.faces.new((O1[i], O1[j], I1[j], I1[i]))
    return _finish(name, bm, material, bevel)


def member(name, pts, p0, p1, material=None, up=(0, 0, 1), bevel=0.002, inner=None):
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    ob = ring_prism(name, pts, inner, L, material, bevel) if inner else prism(name, pts, L, material, bevel)
    ob.matrix_world = frame(p0, p1, up)
    return ob


# ----------------------------------------------------------------- section profiles (x, z), centred
def P_I(d, bf, tf, tw):
    h, b, w = d / 2, bf / 2, tw / 2
    return [(-b, -h), (b, -h), (b, -h + tf), (w, -h + tf), (w, h - tf), (b, h - tf), (b, h), (-b, h),
            (-b, h - tf), (-w, h - tf), (-w, -h + tf), (-b, -h + tf)]


def P_rect(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


def P_C(d, bf, tf, tw):
    """Channel, web on -x side, toes pointing +x, centred on depth."""
    h = d / 2
    return [(0, -h), (bf, -h), (bf, -h + tf), (tw, -h + tf), (tw, h - tf), (bf, h - tf), (bf, h), (0, h)]


def P_L(a, b, t):
    """Angle, heel at origin, legs along +x (a) and +z (b)."""
    return [(0, 0), (a, 0), (a, t), (t, t), (t, b), (0, b)]


def P_circle(r, n=32):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def P_round_rect(w, h, r, n=5):
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def hss(name, w, h, p0, p1, material, up=(0, 0, 1), t=None, r=None):
    """Rectangular tube. Solid with rounded corners unless wall thickness t is given (then hollow, open ends)."""
    r = r if r is not None else min(w, h) * 0.09
    outer = P_round_rect(w, h, r)
    if t:
        inner = P_round_rect(w - 2 * t, h - 2 * t, max(r - t, 0.001))
        return member(name, outer, p0, p1, material, up, bevel=0.0, inner=inner)
    return member(name, outer, p0, p1, material, up, bevel=0.0025)


def pipe(name, r, p0, p1, material, t=None, n=40):
    if t:
        return member(name, P_circle(r, n), p0, p1, material, bevel=0.0, inner=P_circle(r - t, n))
    return member(name, P_circle(r, n), p0, p1, material, bevel=0.002)


# ----------------------------------------------------------------- swept tubes (cables, hooks, chain links)
def catmull(ctrl, per=10, closed=False):
    P = [Vector(p) for p in ctrl]
    n = len(P)
    out = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[0]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else P[-1]
        for s in range(per):
            t = s / per
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out


def sweep(name, pts, r, material=None, segs=12, closed=False, radii=None):
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    tang = []
    for i in range(n):
        a = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        b = pts[(i + 1) % n] if (closed or i < n - 1) else pts[i]
        tang.append((b - a).normalized())
    t0 = tang[0]
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    N = (ref - ref.dot(t0) * t0).normalized()
    rings = []
    for i in range(n):
        t = tang[i]
        N = (N - N.dot(t) * t)
        if N.length < 1e-6:
            N = t.orthogonal()
        N.normalize()
        B = t.cross(N)
        ri = radii[i] if radii else r
        rings.append([bm.verts.new(pts[i] + ri * (math.cos(2 * math.pi * k / segs) * N + math.sin(2 * math.pi * k / segs) * B)) for k in range(segs)])
    m = n if closed else n - 1
    for i in range(m):
        A, Bq = rings[i], rings[(i + 1) % n]
        for k in range(segs):
            l = (k + 1) % segs
            bm.faces.new((A[k], A[l], Bq[l], Bq[k]))
    if not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    return _finish(name, bm, material, 0.0, angle=50)


# ----------------------------------------------------------------- hardware
def bolt(loc, axis=(0, 0, 1), d=0.02, material=None, stick=0.012):
    """Hex bolt head / nut with washer, sitting on a surface at loc, pointing along axis."""
    key = (round(d, 4), round(stick, 4))
    if key not in _bolt_mesh:
        bm = bmesh.new()
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=d * 1.05, radius2=d * 1.05, depth=d * 0.16)
        bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, d * 0.08))
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=d * 0.85, radius2=d * 0.85, depth=d * 0.65)
        bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, d * 0.16 + d * 0.325))
        if stick > 0:
            r = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=d * 0.5, radius2=d * 0.5, depth=stick)
            bmesh.ops.translate(bm, verts=r['verts'], vec=(0, 0, d * 0.81 + stick / 2))
        ob = _finish('bolt', bm, material, 0.0, smooth=True)
        _bolt_mesh[key] = ob.data
    else:
        ob = bpy.data.objects.new('bolt', _bolt_mesh[key])
        COL.objects.link(ob)
    ob.matrix_world = Matrix.Translation(Vector(loc)) @ Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized()).to_matrix().to_4x4()
    return ob


def plane(name, w, h, material, loc=(0, 0, 0), normal=(0, 0, 1), up=(0, 0, 1)):
    """Textured quad of size w x h centred at loc, facing `normal`, with UVs (0..1)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new(c) for c in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
    f = bm.faces.new(vs)
    for l, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = c
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    me.materials.append(material)
    n = Vector(normal).normalized()
    upv = Vector(up)
    z = (upv - upv.dot(n) * n).normalized()
    x = z.cross(n)           # so that local (x, y=-n?, z)
    # local +Y of the quad should point INTO the surface (-n) so the face normal (-Y) faces out
    M = Matrix((x, -n, z)).transposed().to_4x4()
    M.translation = Vector(loc)
    ob.matrix_world = M
    return ob


def join(objs, name):
    """Parent a group of objects under an empty so they can be moved together."""
    e = bpy.data.objects.new(name, None)
    COL.objects.link(e)
    for o in objs:
        o.parent = e
    return e


# ----------------------------------------------------------------- camera / light / render
def all_meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.get('nofit')]


def fit_camera(az=35, el=12, lens=50, margin=1.08, res=(1600, 1200), objs=None, shift=(0, 0), pts=None, extra=None):
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    cd = bpy.data.cameras.new('Cam')
    cd.lens = lens
    cd.sensor_width = 36
    cd.clip_end = 500
    cam = bpy.data.objects.new('Cam', cd)
    COL.objects.link(cam)
    scene.camera = cam
    if pts:
        pts = [Vector(p) for p in pts]
    else:
        objs = objs or all_meshes()
        pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    if extra:
        pts = pts + [Vector(p) for p in extra]
    C = sum(pts, Vector()) / len(pts)
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    q = (-d).to_track_quat('-Z', 'Y')
    R = q.to_matrix()
    right, up, fwd = R @ Vector((1, 0, 0)), R @ Vector((0, 1, 0)), R @ Vector((0, 0, -1))
    aspect = res[0] / res[1]
    th = 18.0 / lens
    tv = th / aspect
    X = [(p - C).dot(right) for p in pts]
    Y = [(p - C).dot(up) for p in pts]
    Z = [(p - C).dot(fwd) for p in pts]

    def need(sa, sb):
        return max(max(abs(x - sa) * margin / th - z, abs(y - sb) * margin / tv - z) for x, y, z in zip(X, Y, Z))

    sa, sb = (min(X) + max(X)) / 2, (min(Y) + max(Y)) / 2
    span = max(max(X) - min(X), max(Y) - min(Y))
    for _ in range(4):
        for which in (0, 1):
            lo, hi = -span, span
            for _ in range(40):
                m1, m2 = lo + (hi - lo) / 3, hi - (hi - lo) / 3
                f1 = need(sa + m1, sb) if which == 0 else need(sa, sb + m1)
                f2 = need(sa + m2, sb) if which == 0 else need(sa, sb + m2)
                if f1 < f2: hi = m2
                else: lo = m1
            if which == 0: sa += (lo + hi) / 2
            else: sb += (lo + hi) / 2
    t = need(sa, sb)
    cam.location = C + t * d + sa * right + sb * up
    cam.rotation_euler = q.to_euler()
    cd.shift_x, cd.shift_y = shift
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    cam['az'] = az
    return cam


def cyclorama(az, center, R, material, back=1.6, fillet=1.2):
    """Seamless studio backdrop: floor sweeping up into a wall behind the subject, facing the camera azimuth."""
    a = math.radians(az)
    h = Vector((math.cos(a), math.sin(a), 0))          # horizontal direction toward the camera
    side = Vector((-h.y, h.x, 0))
    cx = Vector((center[0], center[1], 0))
    rf = fillet * R
    wall = -back * R                                       # wall position along h (behind the subject)
    prof = [(60 * R, 0.0)]
    for i in range(25):
        t = math.radians(90 * i / 24)
        prof.append((wall + rf - rf * math.sin(t), rf - rf * math.cos(t)))
    prof.append((wall, 60 * R))
    bm = bmesh.new()
    W = 90 * R
    rows = []
    for u, z in prof:
        p = cx + h * u + Vector((0, 0, z))
        rows.append((bm.verts.new(p - side * W), bm.verts.new(p + side * W)))
    for i in range(len(rows) - 1):
        bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    ob = _finish('cyc', bm, material, 0.0, angle=80)
    ob['nofit'] = 1
    return ob


def studio(az=35, sun_strength=3.4, sun_el=42, sun_side=-70, sun_angle=14, ambient=0.72, floor=True, exposure=0.0,
           transparent=True, look='None', view='Khronos PBR Neutral', cyc=None, cyc_color='#C6C4BE', cyc_rough=0.45):
    """Soft dome light + one soft sun, shadow-catching floor, transparent film."""
    scene = bpy.context.scene
    w = bpy.data.worlds.new('World')
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (0.55, 0.57, 0.60, 1)
    ramp.color_ramp.elements[1].position = 0.95
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
    mapr = nt.nodes.new('ShaderNodeMapRange')
    mapr.inputs['From Min'].default_value = -1.0
    mapr.inputs['From Max'].default_value = 1.0
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = ambient
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mapr.inputs['Value'])
    nt.links.new(mapr.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs['Surface'])

    sd = bpy.data.lights.new('Sun', 'SUN')
    sd.energy = sun_strength
    sd.angle = math.radians(sun_angle)
    sun = bpy.data.objects.new('Sun', sd)
    COL.objects.link(sun)
    a, e = math.radians(az + sun_side), math.radians(sun_el)
    d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    sun.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()

    if cyc is not None:
        fm = mat('cyc_floor', cyc_color, rough=cyc_rough, coat=0.25)
        cyclorama(az, cyc[0], cyc[1], fm)
        transparent = False
    elif floor:
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=400)
        fl = _finish('floor', bm, mat('floor_catch', (0.72, 0.72, 0.70, 1), rough=0.9), smooth=False)
        fl['nofit'] = 1
        fl.is_shadow_catcher = True

    scene.render.film_transparent = transparent
    vs = scene.view_settings
    vs.view_transform = view
    try:
        vs.look = look
    except Exception:
        try:
            vs.look = view + ' - ' + look
        except Exception:
            pass
    vs.exposure = exposure


def render(path, samples=96, threshold=0.03, denoise=True):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    c = scene.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = threshold
    c.use_denoising = denoise
    try:
        c.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 3
    c.transparent_max_bounces = 6
    scene.render.use_persistent_data = False
    im = scene.render.image_settings
    im.file_format = 'PNG'
    im.color_mode = 'RGBA'
    im.color_depth = '8'
    scene.render.filepath = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    return path
