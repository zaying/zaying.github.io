import assert from 'node:assert/strict';
import { SceneView } from '../assets/world/scene-view.js';
const view = new SceneView();
const advance = (seconds, options = {}) => { let state; for (let i = 0; i < seconds * 60; i++) state = view.update(1 / 60, { width: 1440, height: 900, ...options }); return state; };
view.focus(.85, .25);
const first = advance(.1); assert.ok(first.zoom > 1.035 && first.zoom < 1.18); // Smooth, rather than instant, focus.
const focus = advance(3); assert.ok(Math.abs(focus.zoom - 1.18) < .001); assert.ok(focus.x < 0 && focus.y > 0);
view.point(1, 0); const edge = advance(3); assert.ok(Math.abs(edge.x) < 1440 * (edge.zoom - 1) / 2); assert.ok(Math.abs(edge.y) < 900 * (edge.zoom - 1) / 2);
view.reset(); const reset = advance(3); assert.ok(Math.abs(reset.zoom - 1.035) < .001); assert.ok(Math.abs(reset.x) < .01 && Math.abs(reset.y) < .01);
view.focus(1, 1); const mobile = advance(3, { width: 390, height: 844, mobile: true }); assert.ok(Math.abs(mobile.zoom - 1.10) < .001);
view.setReduced(true); view.focus(.9, .1); assert.deepEqual(advance(1), { x: 0, y: 0, zoom: 1.035 }); assert.equal(view.focused, false);
view.setReduced(false); view.focus(-5, 8); assert.equal(view.focusX, 0); assert.equal(view.focusY, 1);
console.log('Passed: smooth click focus, directional pan, bounded edge movement, reset, mobile zoom, and reduced motion.');
