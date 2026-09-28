export const ALERT_RADIUS = 195;
export const NPC_FADE_DURATION = .75;
export const NPC_RESPAWN_DELAY = 5;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const facingFor = (dx, previous = 1) => dx < 0 ? -1 : dx > 0 ? 1 : previous;

// Fade completely, wait five seconds, then reappear before resuming combat.
export class StoneheartController {
  constructor() { this.hp = 5; this.phase = 'alive'; this.elapsed = 0; this.events = []; }
  damage(amount) {
    if (!this.active || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (!this.hp) { this.phase = 'fading'; this.elapsed = 0; this.events.push({ type: 'defeated' }); }
    return true;
  }
  update(dt) {
    if (this.active) return;
    this.elapsed += dt;
    while (!this.active) {
      const duration = this.phase === 'waiting' ? NPC_RESPAWN_DELAY : NPC_FADE_DURATION;
      if (this.elapsed < duration) break;
      this.elapsed -= duration;
      if (this.phase === 'fading') this.phase = 'waiting';
      else if (this.phase === 'waiting') { this.phase = 'reviving'; this.hp = 5; this.events.push({ type: 'reviving' }); }
      else { this.phase = 'alive'; this.elapsed = 0; this.events.push({ type: 'revived' }); }
    }
  }
  get active() { return this.phase === 'alive'; }
  get opacity() { return this.phase === 'fading' ? Math.max(0, 1 - this.elapsed / NPC_FADE_DURATION) : this.phase === 'waiting' ? 0 : this.phase === 'reviving' ? Math.min(1, this.elapsed / NPC_FADE_DURATION) : 1; }
  get reviveIn() { return this.phase === 'waiting' ? Math.max(0, NPC_RESPAWN_DELAY - this.elapsed) : 0; }
  drainEvents() { const events = this.events; this.events = []; return events; }
}

// A stationary guard: proximity starts the wind-up; only an actual shard hit deals damage.
export class EncounterController {
  constructor() { this.phase = 'idle'; this.timer = 0; this.projectiles = []; this.events = []; this.shots = 0; this.hitCooldown = 0; }
  update(dt, { player, npc, target, alive = true, npcHP = 5 }) {
    this.timer = Math.max(0, this.timer - dt); this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const nearby = alive && npcHP > 0 && distance(player, npc) < ALERT_RADIUS;
    if (!alive || !npcHP) { this.phase = npcHP ? 'idle' : 'defeated'; this.projectiles = []; }
    else if (!nearby) { if (this.phase === 'charge') this.timer = 0; this.phase = 'idle'; }
    else if (this.phase === 'idle' && this.timer === 0) { this.phase = 'charge'; this.timer = .72; }
    else if (this.phase === 'charge' && this.timer === 0) {
      const origin = { x: npc.x, y: npc.y - 60 };
      const angle = Math.atan2(player.y - 60 - origin.y, player.x - origin.x);
      for (const spread of [-.1, 0, .1]) this.projectiles.push({ ...origin, vx: Math.cos(angle + spread) * 270, vy: Math.sin(angle + spread) * 270, angle: angle + spread, life: 2.25 });
      this.shots++; this.events.push({ type: 'shot' }); this.phase = 'idle'; this.timer = 1.8;
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shard = this.projectiles[i]; shard.x += shard.vx * dt; shard.y += shard.vy * dt; shard.life -= dt;
      const hit = alive && !this.hitCooldown && distance(shard, target) < 17;
      if (hit) { this.events.push({ type: 'hit', position: { ...target } }); this.hitCooldown = 1.05; }
      if (hit || shard.life <= 0) this.projectiles.splice(i, 1);
    }
    return { nearby, phase: this.phase, shots: this.shots, projectiles: this.projectiles };
  }
  drainEvents() { const events = this.events; this.events = []; return events; }
  reset() { this.phase = 'idle'; this.timer = 1.5; this.projectiles = []; }
}
