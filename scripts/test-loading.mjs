import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { loadFrame, loadFrames, firstFrames, availableFrame } from '../assets/world/actor-assets.js';

const manifest = JSON.parse(await readFile('assets/world/actors/manifest.json', 'utf8'));
const critical = firstFrames(manifest.groups);
assert.equal(critical.length, 2);
assert.equal(critical[0], manifest.groups.idle[0]);
assert.equal(critical[1], manifest.groups.npcIdle[0]);
let originalBytes = 0, renderBytes = 0;
for (const frames of Object.values(manifest.groups)) for (const frame of frames) {
  originalBytes += (await stat(frame.src)).size;
  renderBytes += (await stat(frame.renderSrc)).size;
  const [, , w, h] = frame.crop, ratio = Math.min(1, 560 / h, 1152 / w);
  assert.deepEqual(frame.renderSize, [Math.ceil(w * ratio), Math.ceil(h * ratio)]);
  assert.ok(frame.renderSize[0] <= 1152 && frame.renderSize[1] <= 560);
}
assert.ok(renderBytes < originalBytes * .5);

const requests = [], bad = new Set(); let active = 0, peak = 0, cropCalls = 0;
globalThis.Image = class {
  set src(src) {
    requests.push(src); active++; peak = Math.max(peak, active);
    setTimeout(() => { active--; bad.has(src) ? this.onerror() : this.onload(); }, 2);
  }
};
globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage: () => cropCalls++ }) }) };
await Promise.all(critical.map(loadFrame));
assert.deepEqual(requests.sort(), critical.map((frame) => frame.renderSrc).sort());
await loadFrame(critical[0]); assert.equal(requests.length, 2); // Entrance and world reuse the decoded image.

const ready = new Map(critical.map((frame) => [frame.src, true]));
assert.equal(availableFrame(manifest.groups.npcIdle[5], manifest.groups, ready), critical[1]);
assert.equal(availableFrame({ ...manifest.groups.attack[2], group: 'attack' }, manifest.groups, ready), critical[0]);
const frame = manifest.groups.walk[0]; bad.add(frame.renderSrc);
await loadFrame(frame); assert.ok(requests.includes(frame.src)); assert.equal(cropCalls, 1);
const broken = { src: 'broken.png', renderSrc: 'broken.webp', crop: [0, 0, 10, 10] };
bad.add(broken.src); bad.add(broken.renderSrc);
let errors = 0, loaded = 0; active = peak = 0;
await loadFrames([broken, ...manifest.groups.run], () => loaded++, () => errors++);
assert.equal(errors, 1); assert.equal(loaded, manifest.groups.run.length); assert.ok(peak <= 2);
bad.delete(broken.src); await loadFrame(broken); // Failed downloads can be retried.

console.log(`Passed: only two startup frames, shared cache, cropped PNG fallback, independent failures/retry, two-request concurrency, complete render assets (${originalBytes} -> ${renderBytes} bytes).`);
