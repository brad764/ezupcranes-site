# Product renderings

The product pictures on the site are 3D models built and rendered by these scripts. Nothing here is deployed;
the finished images live in `site/assets/img/render/`.

## Setup
Blender's Python module needs Python 3.11:

    python3.11 -m venv .venv
    .venv/bin/pip install bpy          # Blender 5.0 as a module, CPU rendering with Cycles
    pip install pillow numpy           # for post.py and cutout.py (any Python 3)

## Files
- `kit.py` – primitives (boxes, steel sections, swept tubes, bolts), camera fitting, studio lighting, render settings
- `parts.py` – crane parts: runway and columns, the EZUP bridge, end trucks, trolley, hoist, hook, light rail, loads, controls
- `scenes.py` – one function per picture; `SCENES` lists them
- `render.py` – renders one scene
- `post.py` – converts finished renders to the 800 and 1600 px WebP files the site uses
- `cutout.py` – cleans a transparent render (hero and family pictures) so its shadows fade into the page
- `mkga.py` – writes the annotated hero figure for the home page from the render's marks file
- `tex/` – nameplate and shop-drawing textures

## Rendering
    .venv/bin/python render.py ezup_industrial --w 640 --h 480 --spp 20          # quick preview, about 15 s
    .venv/bin/python render.py ezup_industrial --w 1600 --h 1200 --spp 48 --exp 0.15
    python3 post.py ezup_industrial

Transparent pictures (no studio backdrop):

    .venv/bin/python render.py ezup_industrial --nocyc --hero --w 2000 --h 1400 --spp 64 --exp 0.15 --tag _hero
    python3 cutout.py out/ezup_industrial_hero.png ../site/assets/img/render/ezup-crane-cutout 2000 1000
    python3 mkga.py out/ezup_industrial_hero.marks.json      # paste between the GA:start / GA:end comments in src/index.html

## Changing a model
Dimensions are in metres; `IN` and `FT` convert. The EZUP bridge is `parts.ezup_bridge()`; its span, girder size,
end truck length, nameplate and control panel are arguments. Paint colours are in `parts.materials()`.
