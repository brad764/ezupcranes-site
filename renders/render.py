import os, sys, time, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit, parts, scenes
ap = argparse.ArgumentParser()
ap.add_argument('name'); ap.add_argument('--w', type=int, default=800); ap.add_argument('--h', type=int, default=600)
ap.add_argument('--spp', type=int, default=40); ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
ap.add_argument('--nocyc', action='store_true'); ap.add_argument('--hero', action='store_true'); ap.add_argument('--margin', type=float); ap.add_argument('--view'); ap.add_argument('--look'); ap.add_argument('--floor'); ap.add_argument('--sunel', type=float); ap.add_argument('--sunside', type=float); ap.add_argument('--sun', type=float); ap.add_argument('--amb', type=float); ap.add_argument('--exp', type=float); ap.add_argument('--focus'); ap.add_argument('--tag', default=''); ap.add_argument('--az', type=float); ap.add_argument('--el', type=float); ap.add_argument('--lens', type=float)
a = ap.parse_args()
kit.reset()
kit.HERO = a.hero
m = parts.materials()
cfg = scenes.SCENES[a.name](m) or {}
az = a.az if a.az is not None else cfg.get('az', 35)
el = a.el if a.el is not None else cfg.get('el', 12)
lens = a.lens or cfg.get('lens', 50)
st = dict(cfg.get('studio', {}))
if a.sun is not None: st['sun_strength'] = a.sun
if a.amb is not None: st['ambient'] = a.amb
if a.exp is not None: st['exposure'] = a.exp
if a.view: st['view'] = a.view
if a.look: st['look'] = a.look
if a.floor: st['cyc_color'] = a.floor
if a.sunel is not None: st['sun_el'] = a.sunel
if a.sunside is not None: st['sun_side'] = a.sunside
if not a.nocyc:
    kit.bpy.context.view_layer.update()
    P = [o.matrix_world @ kit.Vector(c) for o in kit.all_meshes() for c in o.bound_box]
    lo = kit.Vector((min(p.x for p in P), min(p.y for p in P), min(p.z for p in P)))
    hi = kit.Vector((max(p.x for p in P), max(p.y for p in P), max(p.z for p in P)))
    st['cyc'] = ((lo + hi) / 2, (hi - lo).length / 2)
kit.studio(az=az, **st)
print('LOOK', kit.bpy.context.scene.view_settings.view_transform, kit.bpy.context.scene.view_settings.look)
pts = cfg.get('pts')
if a.focus:
    v = [float(x) for x in a.focus.split(',')]
    pts = [(x, y, z) for x in (v[0], v[3]) for y in (v[1], v[4]) for z in (v[2], v[5])]
kit.fit_camera(az=az, el=el, lens=lens, margin=a.margin or cfg.get('margin', 1.06), res=(a.w, a.h), pts=pts, extra=cfg.get('fit_extra') if not pts else None)
if cfg.get('marks'):
    import json
    from bpy_extras.object_utils import world_to_camera_view
    scn = kit.bpy.context.scene
    kit.bpy.context.view_layer.update()
    out = {}
    for k, v in cfg['marks'].items():
        c = world_to_camera_view(scn, scn.camera, kit.Vector(v))
        out[k] = [round(c.x, 4), round(1 - c.y, 4)]
    json.dump(out, open(f'{a.out}/{a.name}{a.tag}.marks.json', 'w'), indent=1)
t = time.time()
kit.render(f'{a.out}/{a.name}{a.tag}.png', samples=a.spp)
print('RENDER SECONDS', round(time.time() - t, 1), 'objects', len(list(kit.bpy.context.scene.objects)))
