#!/usr/bin/env python
"""One-shot public/ image optimizer. Resize oversized rasters + recompress in
place (same name/format so no code refs change) and emit a .webp beside each.
Originals are backed up to public/_original_backup/ first — nothing is deleted.
Re-runnable: it always re-optimizes FROM the backup, never from an already-
optimized file, so quality never compounds. ponytail: PIL one-shot, not a Vite
plugin — swap to a build-time plugin only if new assets land often.
"""
import os, glob, shutil, sys
from PIL import Image

PUB = os.path.join(os.path.dirname(__file__), "..", "public")
# Backup lives OUTSIDE public/ so pristine originals never ship to dist / the PWA
# precache. Do not move this back under public/.
BAK = os.path.join(os.path.dirname(__file__), "..", ".image-originals")
os.makedirs(BAK, exist_ok=True)

# max longest-edge px per image; None = keep native (already small/icon)
CAP = {
    "hero-team.jpg": 1680, "mobile-landing.png": 1000, "bhashini-dev-team.png": 1680,
    "community-land.jpg": 1680, "Parcel-example.png": 800, "chatbot-lady-icon.png": 512,
    "logo-full.png": 1043, "land-governance-workshop.png": 556, "hero-bg.png": 1024,
    "emblem.png": 1024, "mobile-app.png": 1024, "logo-icon.png": 512, "Background.jpeg": 1600,
}
JPG_Q, WEBP_Q = 82, 80
SKIP = {"favicon-32.png", "apple-touch-icon.png", "logo-header.png", "bhoomisetu-logo.png"}

def has_alpha(im):
    return im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)

rows = []
for path in sorted(glob.glob(os.path.join(PUB, "*.png")) + glob.glob(os.path.join(PUB, "*.jpg")) + glob.glob(os.path.join(PUB, "*.jpeg"))):
    name = os.path.basename(path)
    if name in SKIP:
        continue
    bak = os.path.join(BAK, name)
    if not os.path.exists(bak):
        shutil.copy2(path, bak)           # preserve pristine original once
    src = bak                              # always optimize from the pristine copy
    before = os.path.getsize(bak)
    im = Image.open(src)
    w, h = im.size
    cap = CAP.get(name)
    if cap and max(w, h) > cap:
        s = cap / max(w, h)
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    nw, nh = im.size
    ext = name.rsplit(".", 1)[1].lower()
    alpha = has_alpha(im)
    # in-place, same format/name — write to a temp, then keep it ONLY if smaller
    # than the pristine original (PIL's PNG encoder can lose to already-optimized
    # source files; never regress bytes).
    tmp = path + ".tmp"
    if ext in ("jpg", "jpeg"):
        im.convert("RGB").save(tmp, "JPEG", quality=JPG_Q, optimize=True, progressive=True)
    else:  # png
        (im if alpha else im.convert("RGB")).save(tmp, "PNG", optimize=True)
    if os.path.getsize(tmp) < before:
        os.replace(tmp, path)
    else:
        os.remove(tmp)
        shutil.copy2(bak, path)            # restore pristine, it was already smaller
    # webp beside it (always a win; used where markup opts in)
    webp = path.rsplit(".", 1)[0] + ".webp"
    im.save(webp, "WEBP", quality=WEBP_Q, method=6)
    rows.append((name, w, h, nw, nh, before, os.path.getsize(path), os.path.getsize(webp)))

print(f"{'name':30}{'src WxH':>12}{'new WxH':>12}{'before KB':>11}{'inplace KB':>12}{'webp KB':>10}")
tb = ti = tw = 0
for n, w, h, nw, nh, b, a, wb in rows:
    tb += b; ti += a; tw += wb
    print(f"{n:30}{f'{w}x{h}':>12}{f'{nw}x{nh}':>12}{b/1024:>11.0f}{a/1024:>12.0f}{wb/1024:>10.0f}")
print(f"{'TOTAL':30}{'':>24}{tb/1024:>11.0f}{ti/1024:>12.0f}{tw/1024:>10.0f}")
print(f"\nin-place saves {(tb-ti)/1024/1024:.2f} MB ({100*(tb-ti)/tb:.0f}%); webp path saves {(tb-tw)/1024/1024:.2f} MB ({100*(tb-tw)/tb:.0f}%)")
