"""Clean a shadow-catcher render into a web cut-out: drop the faint floor haze, fade shadows out before
the frame edge so no rectangle shows on the page, and write WebP files with transparency.
usage: cutout.py in.png out_stem width [width2 ...]"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def clean(im, haze=5.0, gain=1.2, edge=0.075):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    shadow = (rgb.max(axis=2) < 14) & (al < 250)
    H, W = al.shape
    x = np.arange(W)[None, :] / (W - 1)
    y = np.arange(H)[:, None] / (H - 1)
    fade = smooth(x / edge) * smooth((1 - x) / edge) * smooth(y / edge) * smooth((1 - y) / (edge * 0.8))
    new = np.clip((al - haze) * gain, 0, 255) * fade
    al2 = np.where(shadow, new, al)
    a[..., 3] = al2
    a[..., :3] = np.where(shadow[..., None], 0, rgb)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    src, stem = sys.argv[1], sys.argv[2]
    im = clean(Image.open(src))
    for w in [int(v) for v in sys.argv[3:]]:
        r = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(f'{stem}-{w}.webp', 'WEBP', quality=86, method=6)
        import os
        print(f'{stem}-{w}.webp', os.path.getsize(f'{stem}-{w}.webp') // 1024, 'KB')
