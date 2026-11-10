"""Turn finished renders into web images: WebP at 1600 and 800 px (RGB) or with alpha for cut-outs."""
import sys, os
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'out')
DST = os.path.join(HERE, '..', 'site', 'assets', 'img', 'render')
NAMES = {
    'ezup_industrial': 'ezup-industrial', 'ezup_professional': 'ezup-professional', 'component_kit': 'component-kit',
    'runway_tiebacks': 'runway-tiebacks', 'kbk_workstation': 'kbk-workstation', 'kbk_monorail': 'kbk-monorail', 'kbk_jib': 'kbk-jib',
    'chain_hoist_closeup': 'chain-hoist', 'tarping_crane': 'tarping-crane', 'jib_crane': 'jib-crane', 'gantry_crane': 'gantry-crane',
    'monorail': 'monorail', 'lifting_beam': 'lifting-beam', 'controls': 'controls', 'ezup_end_truck_detail': 'ezup-end-truck',
    'ezup_trolley_detail': 'ezup-trolley', 'kbk_detail': 'kbk-detail',
}
def main(todo):
  os.makedirs(DST, exist_ok=True)
  for n in todo:
      f = f'{SRC}/{n}.png'
      if not os.path.exists(f):
          print('missing', n); continue
      im = Image.open(f).convert('RGB')
      for w in (1600, 800):
          r = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
          r = r.filter(ImageFilter.UnsharpMask(radius=1.0, percent=35, threshold=2))
          out = f'{DST}/{NAMES[n]}-{w}.webp'
          r.save(out, 'WEBP', quality=82 if w == 1600 else 84, method=6)
      print(n, '->', NAMES[n], os.path.getsize(f'{DST}/{NAMES[n]}-1600.webp') // 1024, 'KB /', os.path.getsize(f'{DST}/{NAMES[n]}-800.webp') // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:] or list(NAMES))
