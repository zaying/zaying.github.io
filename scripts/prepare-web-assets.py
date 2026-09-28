"""Create small browser assets; retain all original PNGs and frame anchors."""
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / 'assets' / 'world'
path = WORLD / 'actors' / 'manifest.json'
manifest = json.loads(path.read_text(encoding='utf-8'))
original_bytes = render_bytes = 0
for frames in manifest['groups'].values():
    for frame in frames:
        source = ROOT / frame['src'].removeprefix('./')
        target = source.with_suffix('.webp')
        x, y, w, h = frame['crop']
        ratio = min(1, 560 / h, 1152 / w)
        # Match the existing canvas texture size, including all alpha padding.
        size = (math.ceil(w * ratio), math.ceil(h * ratio))
        with Image.open(source) as original:
            image = original.crop((x, y, x + w, y + h))
            image = image.resize(size, Image.Resampling.LANCZOS)
            image.save(target, 'WEBP', quality=92, alpha_quality=100, method=6, exact=True)
        frame['renderSrc'] = frame['src'].removesuffix('.png') + '.webp'
        frame['renderSize'] = list(size)
        original_bytes += source.stat().st_size
        render_bytes += target.stat().st_size
manifest['version'] = 3
path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
with Image.open(WORLD / 'panorama.png') as panorama:
    panorama.save(WORLD / 'panorama.webp', 'WEBP', quality=90, method=6)
print(f'58 frame downloads: {original_bytes:,} -> {render_bytes:,} bytes')
print(f'Panorama: {(WORLD / "panorama.png").stat().st_size:,} -> {(WORLD / "panorama.webp").stat().st_size:,} bytes')
