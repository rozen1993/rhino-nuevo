"""Render the P19 artwork. Run with Python, Pillow and --ffmpeg PATH."""
import argparse
import math
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


MEDIA = Path(__file__).resolve().parents[1] / "public/media/show-telon"
SIZE = (1440, 720)
SCALE = SIZE[0] / 887
FPS = 30
PERIOD = 8
# Silhouette traced in the 540 x 612 detail of the master, starting at (560, 8).
TIPS = [(274, 30), (333, 218), (521, 165), (388, 312), (514, 453),
        (334, 412), (289, 590), (236, 424), (70, 508), (176, 341),
        (16, 228), (222, 232)]


def separate_star(source):
    box = (890, 12, 1220, 353)
    detail = source.crop(box)
    points = [((560 + x / 3) * SCALE - box[0], (8 + y / 3) * SCALE - box[1])
              for x, y in TIPS]
    pivot = points[0]
    mask = Image.new("L", (detail.width * 4, detail.height * 4))
    ImageDraw.Draw(mask).polygon([(x * 4, y * 4) for x, y in points], fill=255)
    mask = mask.resize(detail.size, Image.Resampling.LANCZOS)
    star = detail.convert("RGBA")
    star.putalpha(mask)
    # Interpolate the amber haze from all sides. Extending each straight edge
    # independently leaves angular streaks visible between the moving tips.
    erase = mask.filter(ImageFilter.MaxFilter(13))
    known = detail.convert("RGBA")
    known.putalpha(ImageOps.invert(erase))
    weighted = known.convert("RGBa")
    for radius in (60, 28, 14, 6):
        sample = weighted.filter(ImageFilter.GaussianBlur(radius)).convert("RGBA")
        color = sample.convert("RGB")
        if radius == 60:
            background = color
        else:
            confidence = sample.getchannel("A").point(lambda a: round(255 * smooth(30, 110, a)))
            background = Image.composite(color, background, confidence)
    blend = ImageChops.lighter(erase, erase.filter(ImageFilter.GaussianBlur(7)))
    background = Image.composite(background, detail, blend)
    # Retain the suspension thread immediately above the joint.
    joint = round(pivot[1])
    background.paste(detail.crop((0, 0, detail.width, joint)), (0, 0))
    return box, background, star, pivot


def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def curtain_mesh():
    step = 18
    nodes = {}
    for x in range(0, SIZE[0] + 1, step):
        for y in range(0, SIZE[1] + 1, step):
            u, v = x / SCALE, y / SCALE
            edge = 519 - .27 * v - .00053 * v * v
            cloth = (smooth(-170, -40, u-edge) * (1-smooth(4, 46, u-edge))
                     * smooth(-22, 162, v) * (1-smooth(332, 397, v)))
            # Pin the silhouette where it meets the fixed set and the audience.
            cloth *= 1 - smooth(-36, -10, u-edge)
            cloth *= 1 - smooth(326, 356, v)
            nodes[x, y] = cloth, -v * .007 + (u-edge) * .006
    cells = [((x, y, x+step, y+step), ((x, y), (x, y+step), (x+step, y+step), (x+step, y)))
             for x in range(0, SIZE[0], step) for y in range(0, SIZE[1], step)]
    return nodes, cells


def render(ffmpeg):
    photo = Image.open(MEDIA / "escenario-1774.webp").convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    box, background, star, pivot = separate_star(photo)
    nodes, cells = curtain_mesh()
    target = MEDIA / "telon-en-movimiento.webm"
    temporary = target.with_suffix(".partial.webm")
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe",
            "-c:v", "mjpeg", "-framerate", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libvpx",
            "-threads", "4", "-deadline", "good", "-cpu-used", "4", "-b:v", "1350k",
            "-crf", "10", "-pix_fmt", "yuv420p", str(temporary)]
    try:
        with subprocess.Popen(args, stdin=subprocess.PIPE) as encoder:
            for n in range(FPS * PERIOD):
                t = math.tau * n / (FPS * PERIOD)
                mapped = {(x, y): (x + cloth * 8.7 * SCALE * math.sin(t + phase),
                                   y + cloth * 1.1 * SCALE * math.sin(t + phase - .25))
                          for (x, y), (cloth, phase) in nodes.items()}
                mesh = [(cell, tuple(c for pt in corners for c in mapped[pt])) for cell, corners in cells]
                frame = photo.transform(SIZE, Image.Transform.MESH, mesh, Image.Resampling.BILINEAR)
                swing = math.degrees(.049 * math.sin(t))
                moving = star.rotate(swing, Image.Resampling.BICUBIC, center=pivot)
                frame.paste(background, box)
                frame.paste(moving, box, moving)
                data = BytesIO()
                frame.save(data, "JPEG", quality=91, subsampling=0)
                encoder.stdin.write(data.getvalue())
            encoder.stdin.close()
            if encoder.wait():
                raise RuntimeError("Video encoding failed")
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    render(parser.parse_args().ffmpeg)
