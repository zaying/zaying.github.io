import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ActorController, ACTIONS } from '../assets/world/actor-controller.js';

const manifest = JSON.parse(await readFile(new URL('../assets/world/actors/manifest.json', import.meta.url), 'utf8'));
const actor = new ActorController(manifest.groups);
const advance = (seconds, input = {}) => { let result; for (let i = 0; i < seconds * 100; i++) result = actor.update(.01, input); return result; };
assert.ok(ACTIONS.includes('stand'));
assert.equal(actor.frame().group, 'idle');
assert.equal(advance(.2, { moving: true }).group, 'walk');
assert.equal(advance(.2, { moving: true, running: true }).group, 'run');
actor.trigger('jump');
assert.equal(advance(.3).group, 'jump');
assert.ok(actor.frame().height > 1);
assert.equal(advance(.45).group, 'land');
assert.equal(advance(.5).action, 'idle');
actor.trigger('crouch');
assert.equal(advance(.4).index, 2);
assert.equal(advance(.4, { moving: true }).group, 'crouchWalk');
actor.trigger('crouch'); assert.equal(actor.action, 'stand'); assert.equal(actor.frame().index, 2);
assert.equal(advance(.14).index, 1); assert.equal(advance(.14).index, 0);
assert.equal(actor.trigger('walk'), false); // Movement controls cannot skip the rising frames.
assert.equal(advance(.14).action, 'idle');
actor.trigger('crouch'); advance(.4); actor.trigger('idle');
assert.equal(actor.action, 'stand'); assert.equal(advance(.4).action, 'idle');
actor.trigger('crouch'); advance(.4); actor.trigger('walk', { demo: true });
assert.equal(advance(.4).action, 'walk'); advance(2);
actor.trigger('crouch'); advance(.05); const partialCrouch = actor.frame().index; actor.trigger('crouch');
assert.equal(actor.frame().index, partialCrouch); advance(.4); // Fast toggles do not jump to a fully crouched pose.
for (const action of ['attack', 'attack2']) {
  assert.ok(actor.trigger(action));
  assert.equal(advance(.45).group, action);
  assert.equal(actor.drainEvents().filter((event) => event.type === 'strike').length, 1);
  advance(1); assert.equal(actor.drainEvents().filter((event) => event.type === 'strike').length, 0);
}
assert.ok(actor.hit()); assert.equal(actor.hp, 2); assert.equal(actor.action, 'hurt');
assert.equal(actor.hit(), false); // Damage animation has an invulnerability window.
advance(1); actor.hit(); advance(1); actor.hit();
assert.equal(actor.hp, 0); assert.equal(actor.action, 'death');
assert.equal(advance(3).index, manifest.groups.death.length - 1);
assert.equal(actor.trigger('walk'), false);
assert.ok(actor.trigger('revive')); assert.equal(actor.frame().index, manifest.groups.death.length - 1);
advance(2.1); assert.equal(actor.dead, false); assert.equal(actor.hp, 3); assert.equal(actor.action, 'idle');
assert.equal(actor.trigger('revive'), false);
const automatic = new ActorController(manifest.groups);
automatic.trigger('death'); automatic.update(4.99);
assert.equal(automatic.action, 'death'); assert.ok(automatic.reviveIn > 0);
automatic.update(.02);
assert.equal(automatic.action, 'revive'); assert.equal(automatic.reviveIn, 0);
assert.equal(automatic.trigger('revive'), false); // Do not restart an ongoing revival.
assert.equal(automatic.hit(), false);
automatic.update(2);
assert.equal(automatic.action, 'idle'); assert.equal(automatic.hp, 3); assert.equal(automatic.dead, false);
assert.equal(automatic.drainEvents().filter((event) => event.type === 'revived').length, 1);
automatic.update(6); assert.equal(automatic.action, 'idle'); // No stale timer revives a living player.
for (const [name, frames] of Object.entries(manifest.groups)) {
  for (const frame of frames) {
    const [x, y, w, h] = frame.crop;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0);
    assert.ok(x + w <= frame.size[0] && y + h <= frame.size[1]);
    assert.ok(frame.anchor[0] >= 0 && frame.anchor[0] <= w && frame.anchor[1] >= 0 && frame.anchor[1] <= h, name);
  }
}
console.log('Passed: movement, run, jump/landing, crouch walk, reverse-frame standing, both attacks, damage, death, manual and automatic 5-second revival, and all 58 frame bounds.');
