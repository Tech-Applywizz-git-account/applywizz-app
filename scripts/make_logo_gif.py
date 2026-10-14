"""Build ApplyWizz fill + float GIFs from favicon.png for splash/loading."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "favicon.png"
OUT_SPLASH = ROOT / "assets" / "logo-splash.gif"
OUT_LOAD = ROOT / "assets" / "logo-loading.gif"
OUT_STILL = ROOT / "assets" / "splash-icon.png"

CANVAS = 320
LOGO_W = 220
BLUE = (46, 125, 255, 255)
GREEN = (57, 255, 20, 255)
BG = (0, 0, 0, 255)


def load_logo() -> Image.Image:
    im = Image.open(SRC).convert("RGBA")
    arr = np.asarray(im)
    lum = arr[:, :, :3].astype(np.int32).sum(axis=2)
    ys, xs = np.where(lum > 60)
    pad = 24
    box = (
        int(max(0, xs.min() - pad)),
        int(max(0, ys.min() - pad)),
        int(min(im.size[0], xs.max() + pad)),
        int(min(im.size[1], ys.max() + pad)),
    )
    cropped = im.crop(box)
    cropped.thumbnail(
        (LOGO_W, int(LOGO_W * cropped.size[1] / cropped.size[0])),
        Image.Resampling.LANCZOS,
    )
    return cropped.convert("RGBA")


def split_layers(logo: Image.Image):
    arr = np.asarray(logo.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    lum = rgb.sum(axis=2)
    is_logo = lum > 50
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    is_green = is_logo & (g >= b + 6) & (g >= r - 12)
    is_blue = is_logo & ~is_green

    blue = np.zeros_like(arr)
    green = np.zeros_like(arr)
    blue[is_blue] = arr[is_blue]
    green[is_green] = arr[is_green]
    blue[is_blue, 3] = 255
    green[is_green, 3] = 255

    mask = np.zeros(lum.shape, dtype=np.uint8)
    mask[is_logo] = 255
    return (
        Image.fromarray(blue, "RGBA"),
        Image.fromarray(green, "RGBA"),
        Image.fromarray(mask, "L"),
    )


def make_outline(mask: Image.Image) -> Image.Image:
    solid = mask.point(lambda p: 255 if p > 20 else 0)
    inner = solid.filter(ImageFilter.MinFilter(5))
    edge = ImageChops.subtract(solid, inner)
    return edge.point(lambda p: 255 if p > 40 else 0)


def dual_outline(mask: Image.Image, blue: Image.Image, green: Image.Image) -> Image.Image:
    edge = np.asarray(make_outline(mask))
    bp = np.asarray(blue)
    gp = np.asarray(green)
    out = np.zeros((*edge.shape, 4), dtype=np.uint8)
    on = edge > 40
    green_on = on & (gp[:, :, 3] > 20)
    blue_on = on & ~green_on
    out[blue_on] = BLUE
    out[green_on] = GREEN
    return Image.fromarray(out, "RGBA")


def wipe(layer: Image.Image, progress: float) -> Image.Image:
    progress = min(1.0, max(0.0, progress))
    if progress <= 0:
        return Image.new("RGBA", layer.size, (0, 0, 0, 0))
    if progress >= 1:
        return layer
    w, h = layer.size
    x_end = max(1, int(w * progress))
    cut = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cut.paste(layer.crop((0, 0, x_end, h)), (0, 0))
    return cut


def glow(layer: Image.Image, radius: int = 8, strength: float = 1.15) -> Image.Image:
    blur = layer.filter(ImageFilter.GaussianBlur(radius))
    r, g, b, a = blur.split()
    a = a.point(lambda p: min(255, int(p * strength)))
    return Image.merge("RGBA", (r, g, b, a))


def paste_centered(canvas: Image.Image, layer: Image.Image, dy: int = 0, scale: float = 1.0):
    if scale != 1.0:
        nw = max(1, int(layer.size[0] * scale))
        nh = max(1, int(layer.size[1] * scale))
        layer = layer.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (canvas.size[0] - layer.size[0]) // 2
    y = (canvas.size[1] - layer.size[1]) // 2 + int(dy)
    canvas.alpha_composite(layer, (x, y))


def compose_splash(outline, blue, green, full, t: float) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), BG)
    float_y = math.sin(t * math.pi * 2) * 8

    if t < 0.20:
        p = 0.06 + 0.94 * (t / 0.20)
        dy = float_y * 0.15
        paste_centered(canvas, wipe(outline, p), dy=dy)
    elif t < 0.30:
        p = (t - 0.20) / 0.10
        dy = float_y * 0.25
        paste_centered(canvas, glow(outline, 6 + int(4 * p), 1.1 + 0.35 * p), dy=dy)
        paste_centered(canvas, outline, dy=dy)
    elif t < 0.50:
        p = (t - 0.30) / 0.20
        dy = float_y * 0.4
        paste_centered(canvas, glow(outline, 6, 0.9), dy=dy)
        paste_centered(canvas, outline, dy=dy)
        paste_centered(canvas, wipe(blue, p), dy=dy)
    elif t < 0.70:
        p = (t - 0.50) / 0.20
        dy = float_y * 0.55
        paste_centered(canvas, glow(outline, 5, 0.8), dy=dy)
        paste_centered(canvas, outline, dy=dy)
        paste_centered(canvas, blue, dy=dy)
        paste_centered(canvas, wipe(green, p), dy=dy)
    elif t < 0.82:
        p = (t - 0.70) / 0.12
        scale = 1.0 + 0.07 * math.sin(p * math.pi)
        dy = float_y * 0.7
        paste_centered(canvas, glow(full, 8, 0.85 + 0.45 * math.sin(p * math.pi)), dy=dy, scale=scale)
        paste_centered(canvas, full, dy=dy, scale=scale)
    else:
        dy = math.sin(t * math.pi * 2) * 11
        paste_centered(canvas, glow(full, 5, 0.55), dy=dy)
        paste_centered(canvas, full, dy=dy)
    return canvas


def compose_loading(full, t: float) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), BG)
    dy = math.sin(t * math.pi * 2) * 12
    pulse = 0.55 + 0.35 * (0.5 + 0.5 * math.sin(t * math.pi * 2))
    scale = 1.0 + 0.03 * math.sin(t * math.pi * 2)
    paste_centered(canvas, glow(full, 7, pulse), dy=dy, scale=scale)
    paste_centered(canvas, full, dy=dy, scale=scale)
    return canvas


def to_gif_frames(frames: list[Image.Image]) -> list[Image.Image]:
    out = []
    for im in frames:
        rgb = Image.new("RGB", im.size, (0, 0, 0))
        rgb.paste(im, mask=im.split()[-1])
        out.append(rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=32))
    return out


def save_gif(frames: list[Image.Image], path: Path, duration: int):
    pal = to_gif_frames(frames)
    pal[0].save(
        path,
        save_all=True,
        append_images=pal[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(f"Wrote {path} ({path.stat().st_size / 1024:.0f} KB, {len(pal)} frames)")


def main():
    logo = load_logo()
    blue, green, mask = split_layers(logo)
    outline = dual_outline(mask, blue, green)
    full = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    full.alpha_composite(blue)
    full.alpha_composite(green)

    splash_frames = [
        compose_splash(outline, blue, green, full, i / 36) for i in range(36)
    ]
    save_gif(splash_frames, OUT_SPLASH, duration=70)

    load_src = [compose_loading(full, i / 18) for i in range(18)]
    small = [f.resize((160, 160), Image.Resampling.LANCZOS) for f in load_src]
    save_gif(small, OUT_LOAD, duration=90)

    still = Image.new("RGBA", (CANVAS, CANVAS), BG)
    paste_centered(still, full)
    rgb = Image.new("RGB", still.size, (0, 0, 0))
    rgb.paste(still, mask=still.split()[-1])
    rgb.save(OUT_STILL, "PNG")
    print(f"Wrote {OUT_STILL}")


if __name__ == "__main__":
    main()
