"""Copy original frames and record their alpha bounds; never rewrite source pixels."""
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '01_布丁小鼻噶游戏开发' / '00_人物'
PUDDING = SOURCE / '00_主角-布丁小鼻嘎' / '01_本皮'
NPC = SOURCE / '01_NPC-石心人'
OUTPUT = ROOT / 'assets' / 'world' / 'actors'
GROUPS = {
    'idle': (PUDDING / '00_原地', ['00_呼吸1.png', '01_静止.png', '02_呼吸2.png', '03_静止 - 副本.png', '04_呼吸1 - 副本.png', '05_静止 - 副本.png', '06_呼吸2 - 副本.png']),
    'walk': (PUDDING / '01_行走', ['01_向前走1.png', '02_向前走2.png', '03_向前走3.png', '04_向前走4.png', '05_向前走3 - 副本.png', '06_向前走2 - 副本.png', '07_向前走1 - 副本.png']),
    'run': (PUDDING / '02_跑', ['00_向前走1.png', '01_跑1.png', '02_跑2.png', '03_跑3.png', '04_向前走1 - 副本.png']),
    'jump': (PUDDING / '03_跳-蹲' / '00_跳', ['01_跳1.png', '02_跳2.png', '03_跳3.png', '04_跳2 - 副本.png']),
    'land': (PUDDING / '04_降落', ['01_降落1.png', '02_降落2.png', '03_降落3.png', '04_降落2 - 副本.png']),
    'crouch': (PUDDING / '03_跳-蹲' / '01_蹲', ['00_蹲0.png', '01_蹲1.png', '02_蹲2.png']),
    'crouchWalk': (PUDDING / '03_跳-蹲' / '01_蹲', ['03_蹲走1.png', '04_蹲走2.png']),
    'attack': (PUDDING / '05_攻击', ['01_攻击1-0.png', '02_攻击1-1.png', '03_攻击1-2.png', '04_攻击1-3.png', '05_攻击1-4.png']),
    'attack2': (PUDDING / '05_攻击', ['01_攻击1-0.png', '06_攻击2-1.png', '07_攻击2-2.png', '08_攻击2-3.png', '09_攻击1-4 - 副本.png']),
    'hurt': (PUDDING / '06_被攻击', ['01_被攻击1.png', '02_被攻击2.png', '03_被攻击3.png', '04_被攻击4.png']),
    # The source skips frame 2 and explicitly labels another frame as discarded.
    'death': (PUDDING / '07_死亡', ['01_死亡1.png', '03_死亡3.png', '04_死亡4.png', '05_死亡5.png', '06_死亡6.png']),
    'npcIdle': (NPC / '00_原地', ['00_呼吸3.png', '01_静止.png', '02_呼吸2.png', '03_静止 - 副本.png', '05_呼吸3 - 副本.png', '06_静止 - 副本.png', '07_呼吸2 - 副本.png']),
}
manifest = {'version': 2, 'pixelScale': 0.00265, 'groups': {}, 'source': 'Original user artwork; byte-for-byte copies', 'revive': 'Reverse death frames + procedural teleport light'}
for group, (directory, names) in GROUPS.items():
    target = OUTPUT / group
    target.mkdir(parents=True, exist_ok=True)
    frames = []
    for index, name in enumerate(names):
        source = directory / name
        filename = f'{index:02d}.png'
        shutil.copy2(source, target / filename)
        with Image.open(source) as image:
            bounds = image.getchannel('A').getbbox()
            if not bounds:
                raise ValueError(f'Empty alpha channel: {source}')
            # Pad the full alpha bounds; there is no hand-drawn silhouette mask.
            left, top, right, bottom = bounds
            left, top = max(0, left - 8), max(0, top - 8)
            right, bottom = min(image.width, right + 8), min(image.height, bottom + 8)
            anchor_x = 500 if group in ('attack', 'attack2') else 945
            if group == 'npcIdle':
                anchor_x = 890
            frames.append({'src': f'./assets/world/actors/{group}/{filename}', 'crop': [left, top, right - left, bottom - top], 'anchor': [anchor_x - left, bounds[3] - top + 2], 'source': str(source.relative_to(SOURCE)), 'size': list(image.size)})
    manifest['groups'][group] = frames
OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Prepared {sum(map(len, manifest["groups"].values()))} original frames in {len(GROUPS)} groups.')
