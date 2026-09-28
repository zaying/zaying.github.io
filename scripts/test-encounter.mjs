import assert from 'node:assert/strict';
import { EncounterController, StoneheartController, NPC_FADE_DURATION, facingFor } from '../assets/world/encounter-controller.js';

const npc = { x: 735, y: 470 };
const far = { x: 480, y: 480 }, near = { x: 590, y: 470 };
function simulate(encounter, seconds, player, center = { x: player.x, y: player.y - 60 }, extra = {}) {
  const events = [];
  for (let t = 0; t < seconds; t += .01) { encounter.update(.01, { player, npc, target: center, ...extra }); events.push(...encounter.drainEvents()); }
  return events;
}
const guard = new EncounterController();
assert.deepEqual(simulate(guard, 10, far), []); assert.equal(guard.shots, 0);
const hits = simulate(guard, 1.5, near);
assert.equal(hits.filter((event) => event.type === 'shot').length, 1);
assert.equal(hits.filter((event) => event.type === 'hit').length, 1);
const shots = guard.shots; simulate(guard, 5, far); assert.equal(guard.shots, shots);
const crouching = new EncounterController();
assert.equal(simulate(crouching, 1.5, near, { x: near.x, y: near.y - 20 }).filter((e) => e.type === 'hit').length, 0);
const jumping = new EncounterController();
assert.equal(simulate(jumping, 1.5, near, { x: near.x, y: near.y - 130 }).filter((e) => e.type === 'hit').length, 0);
const interrupted = new EncounterController(); simulate(interrupted, .4, near); simulate(interrupted, 2, far); assert.equal(interrupted.shots, 0);
const defeated = new EncounterController(); simulate(defeated, 5, near, undefined, { npcHP: 0 }); assert.equal(defeated.projectiles.length, 0); assert.equal(defeated.shots, 0);
const stoneheart = new StoneheartController();
assert.ok(stoneheart.damage(2)); assert.equal(stoneheart.hp, 3); assert.equal(stoneheart.opacity, 1);
stoneheart.damage(3); assert.equal(stoneheart.phase, 'fading'); assert.equal(stoneheart.active, false);
stoneheart.update(NPC_FADE_DURATION / 2); assert.equal(stoneheart.opacity, .5);
stoneheart.update(NPC_FADE_DURATION / 2); assert.equal(stoneheart.phase, 'waiting'); assert.equal(stoneheart.opacity, 0); assert.equal(stoneheart.reviveIn, 5);
assert.equal(stoneheart.damage(2), false); // Extra attacks cannot restart the respawn timer.
stoneheart.update(4.99); assert.equal(stoneheart.phase, 'waiting'); assert.equal(stoneheart.hp, 0);
stoneheart.update(.02); assert.equal(stoneheart.phase, 'reviving'); assert.equal(stoneheart.hp, 5); assert.equal(stoneheart.active, false);
assert.ok(stoneheart.opacity > 0 && stoneheart.opacity < 1); assert.equal(stoneheart.damage(2), false);
stoneheart.update(NPC_FADE_DURATION); assert.equal(stoneheart.active, true); assert.equal(stoneheart.opacity, 1);
assert.deepEqual(stoneheart.drainEvents().map((event) => event.type), ['defeated', 'reviving', 'revived']);
stoneheart.damage(5); stoneheart.update(6.5); assert.equal(stoneheart.active, true); assert.equal(stoneheart.hp, 5); // Repeat defeats still respawn.
const respawningGuard = new EncounterController(), respawningNPC = new StoneheartController(); respawningNPC.damage(5);
const respawnEvents = [];
for (let i = 0; i < 800; i++) {
  respawningNPC.update(.01);
  for (const event of respawningNPC.drainEvents()) { respawnEvents.push(event); respawningGuard.reset(); }
  respawningGuard.update(.01, { player: near, npc, target: { x: near.x, y: near.y - 60 }, npcHP: respawningNPC.active ? respawningNPC.hp : 0 });
  if (!respawningNPC.active) { assert.equal(respawningGuard.projectiles.length, 0); assert.equal(respawningGuard.shots, 0); }
}
assert.equal(respawnEvents.filter((event) => event.type === 'revived').length, 1); assert.equal(respawningGuard.phase, 'charge'); // Combat resumes with a fresh wind-up.
assert.equal(facingFor(-1), -1); assert.equal(facingFor(1, -1), 1); assert.equal(facingFor(0, -1), -1);
console.log('Passed: proximity-only firing, real projectile hits, crouch/jump avoidance, retreat cancellation, full fade-out and 5-second NPC respawn, safe combat resumption, and mirrored left facing.');
