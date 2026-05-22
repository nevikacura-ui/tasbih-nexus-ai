"""Generate a premium WhatsApp/Open Graph share card (1200×630).

Run this once whenever brand assets change:
    cd /app && python3 frontend/public/_make_og.py

The result is written to /app/frontend/public/og-share.jpg and is referenced
from index.html via og:image / twitter:image meta tags.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

W, H = 1200, 630
OUT = Path("/app/frontend/public/og-share.jpg")

# Tasbih palette
DEEP_TOP = (10, 40, 32)       # #0a2820
DEEP_MID = (15, 61, 54)       # #0F3D36
DEEP_BOT = (31, 84, 72)       # #1f5448
GOLD = (244, 216, 138)        # #F4D88A
GOLD_DEEP = (232, 195, 106)   # #E8C36A
IVORY = (247, 243, 236)       # #F7F3EC

def vert_gradient(size, top, mid, bot):
    img = Image.new("RGB", size, top)
    px = img.load()
    w, h = size
    for y in range(h):
        if y < h * 0.45:
            t = y / (h * 0.45)
            r = int(top[0] + (mid[0]-top[0]) * t)
            g = int(top[1] + (mid[1]-top[1]) * t)
            b = int(top[2] + (mid[2]-top[2]) * t)
        else:
            t = (y - h*0.45) / (h*0.55)
            r = int(mid[0] + (bot[0]-mid[0]) * t)
            g = int(mid[1] + (bot[1]-mid[1]) * t)
            b = int(mid[2] + (bot[2]-mid[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img

def add_halo(base, center, radius, color, alpha):
    layer = Image.new("RGBA", base.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.ellipse([center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius], fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=radius//4))
    base.alpha_composite(layer)

def mosque_silhouette(img):
    """Subtle gold dome + minarets silhouette across the bottom."""
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    base_y = int(h * 0.78)
    # central dome
    cx, cy = w//2, base_y
    dome_w, dome_h = 320, 200
    d.ellipse([cx - dome_w//2, cy - dome_h, cx + dome_w//2, cy + dome_h//2], fill=(*GOLD, 32))
    d.rectangle([cx - dome_w//2, cy, cx + dome_w//2, h], fill=(*GOLD, 22))
    # finial
    d.polygon([(cx-6, cy-dome_h-8), (cx+6, cy-dome_h-8), (cx, cy-dome_h-28)], fill=(*GOLD, 80))
    # minarets
    for mx in [cx - 280, cx + 280]:
        d.rectangle([mx-12, base_y-180, mx+12, h], fill=(*GOLD, 26))
        d.ellipse([mx-22, base_y-220, mx+22, base_y-180], fill=(*GOLD, 30))
        d.polygon([(mx-4, base_y-235), (mx+4, base_y-235), (mx, base_y-255)], fill=(*GOLD, 60))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=2))
    img.alpha_composite(layer)

def load_font(size, weight="regular"):
    """Try system fonts; fall back gracefully."""
    candidates = [
        # Display
        ("display", "/usr/share/fonts/truetype/dejavu/DejaVu-Serif.ttf"),
        ("display", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        ("display", "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"),
        # Regular
        ("regular", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("regular", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for kind, path in candidates:
        try:
            if (weight == "display" and kind == "display") or (weight != "display" and kind == "regular"):
                return ImageFont.truetype(path, size)
        except Exception:
            continue
    # Last resort
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.load_default()

def main():
    base = vert_gradient((W, H), DEEP_TOP, DEEP_MID, DEEP_BOT).convert("RGBA")
    # Halos
    add_halo(base, (W//2, int(H*0.32)), 320, GOLD, 80)
    add_halo(base, (int(W*0.18), int(H*0.7)), 200, GOLD_DEEP, 36)
    add_halo(base, (int(W*0.82), int(H*0.7)), 200, GOLD_DEEP, 36)
    mosque_silhouette(base)

    # Stars (small drift dots)
    d = ImageDraw.Draw(base)
    import random
    random.seed(7)
    for _ in range(28):
        x = random.randint(40, W-40)
        y = random.randint(30, int(H*0.55))
        r = random.choice([1, 1, 2])
        a = random.randint(120, 200)
        d.ellipse([x-r, y-r, x+r, y+r], fill=(*IVORY, a))

    # Try to paste the icon as a soft seal at top-left for brand cohesion
    try:
        icon = Image.open("/app/frontend/public/icon-512.png").convert("RGBA").resize((140, 140), Image.LANCZOS)
        # Drop shadow
        shadow = Image.new("RGBA", (160, 160), (0,0,0,0))
        sd = ImageDraw.Draw(shadow)
        sd.ellipse([0,0,160,160], fill=(0,0,0,140))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=10))
        base.alpha_composite(shadow, (52, 52))
        base.alpha_composite(icon, (62, 62))
    except Exception:
        pass

    # Type
    d = ImageDraw.Draw(base)
    title_font = load_font(110, "display")
    sub_font = load_font(36, "display")
    tag_font = load_font(20, "regular")
    cta_font = load_font(28, "regular")

    # Eyebrow tag
    eyebrow = "Y\u0100  \u02BFAL\u012A  MADAD"
    eb_w = d.textlength(eyebrow, font=tag_font)
    eb_x = (W - eb_w) // 2
    eb_y = int(H * 0.26)
    d.text((eb_x, eb_y), eyebrow, font=tag_font, fill=(*GOLD, 235))

    # Hairline under eyebrow
    line_y = eb_y + 38
    d.line([(W//2 - 28, line_y), (W//2 + 28, line_y)], fill=(*GOLD, 200), width=1)

    # Main title
    title = "Tasbih.ai"
    title_w = d.textlength(title, font=title_font)
    title_x = (W - title_w) // 2
    title_y = line_y + 18
    # Soft glow underneath
    glow = Image.new("RGBA", base.size, (0,0,0,0))
    gd = ImageDraw.Draw(glow)
    gd.text((title_x, title_y), title, font=title_font, fill=(*GOLD, 180))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=18))
    base.alpha_composite(glow)
    d.text((title_x, title_y), title, font=title_font, fill=IVORY)

    # Subline (italic-feel by spacing)
    subline = "Remember.  Reflect.  Seek Noor."
    sub_w = d.textlength(subline, font=sub_font)
    sub_x = (W - sub_w) // 2
    sub_y = title_y + 130
    d.text((sub_x, sub_y), subline, font=sub_font, fill=(*IVORY, 200))

    # Pill at bottom
    pill_text = "Holy Du'a  \u00B7  Noor AI  \u00B7  Jamatkhana  \u00B7  Sangat"
    pw = d.textlength(pill_text, font=cta_font)
    pad_x, pad_y = 36, 18
    px_y = int(H * 0.81)
    px_x = (W - (pw + pad_x*2)) // 2
    d.rounded_rectangle([px_x, px_y, px_x + pw + pad_x*2, px_y + 56], radius=28, fill=(0, 0, 0, 130), outline=(*GOLD, 140), width=1)
    d.text((px_x + pad_x, px_y + 14), pill_text, font=cta_font, fill=(*GOLD, 240))

    # Final flatten + save as JPEG (WhatsApp preview prefers JPEG)
    flat = Image.new("RGB", base.size, DEEP_MID)
    flat.paste(base, (0, 0), base)
    flat.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"wrote {OUT}  size={OUT.stat().st_size} bytes")

if __name__ == "__main__":
    main()
