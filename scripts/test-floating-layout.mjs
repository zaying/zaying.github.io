import assert from 'node:assert/strict';
import { placeFloating, intersects } from '../assets/world/floating-layout.js';

const anchor = { x: 300, y: 260, width: 110, height: 170 };
const size = { width: 205, height: 38 }, bounds = { x: 0, y: 0, width: 780, height: 520 };
const card = { x: 410, y: 150, width: 170, height: 90 };
const options = { anchor, size, bounds, obstacles: [card] };
const clear = placeFloating(options);
assert.ok(clear); assert.ok(!intersects(clear, card, 10)); assert.ok(!intersects(clear, anchor, 10));
// A moving character and different viewport sizes still get bounded, clear text.
for (const width of [320, 375, 760, 1024, 1440]) for (const x of [10, width / 2, width - 80]) {
  const a = { x, y: 180, width: 65, height: 95 };
  const b = { x: 8, y: 8, width: width - 16, height: 330 };
  const obstacles = [{ x: width / 2, y: 60, width: 90, height: 100 }];
  const fit = placeFloating({ anchor: a, size: { width: 180, height: 36 }, bounds: b, obstacles });
  if (fit) {
    assert.ok(fit.x >= b.x && fit.y >= b.y && fit.x + fit.width <= b.x + b.width && fit.y + fit.height <= b.y + b.height);
    assert.ok(!intersects(fit, a, 10)); assert.ok(!intersects(fit, obstacles[0], 10));
  }
}
assert.equal(placeFloating({ ...options, obstacles: [bounds] }), null);
assert.equal(placeFloating({ ...options, size: { width: 800, height: 38 } }), null);
console.log('Passed: research-card avoidance, bounded placement across viewport sizes and moving anchors, and omission when no clear space exists.');
