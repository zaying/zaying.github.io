export const ACTIONS = ['idle', 'walk', 'run', 'jump', 'crouch', 'stand', 'attack', 'attack2', 'hurt', 'death', 'revive'];
export const AUTO_REVIVE_DELAY = 5;
const DURATIONS = { jump: 1.12, stand: .39, attack: .95, attack2: 1.12, hurt: .8, death: 1.8, revive: 1.9 };
const LOCKED = new Set(['jump', 'stand', 'attack', 'attack2', 'hurt', 'death', 'revive']);

export class ActorController {
  constructor(groups) {
    this.groups = groups;
    this.action = 'idle'; this.elapsed = 0; this.dead = false;
    this.hp = 3; this.crouched = false; this.demoUntil = 0;
    this.attackEmitted = false; this.events = []; this.standNext = null; this.standStart = 0;
  }
  trigger(action, { demo = false } = {}) {
    if (!ACTIONS.includes(action)) return false;
    if (this.dead && action !== 'revive' && action !== 'death') return false;
    if (this.action === 'stand' && !['hurt', 'death'].includes(action)) return false;
    if (action === 'revive' && (!this.dead || this.action === 'revive')) return false;
    if (['attack', 'attack2', 'jump'].includes(action) && LOCKED.has(this.action) && this.action !== 'death') return false;
    this.standNext = null;
    if (this.crouched && ['crouch', 'idle', 'walk', 'run'].includes(action)) {
      const frame = this.frame();
      this.standStart = frame.group === 'crouch' ? frame.index : this.groups.crouch.length - 1;
      this.standNext = action === 'crouch' ? null : { action, demo };
      action = 'stand';
    }
    if (action === 'death') { this.dead = true; this.hp = 0; }
    if (action === 'hurt') { if (this.dead || this.action === 'revive') return false; this.crouched = false; }
    if (action === 'crouch') this.crouched = !this.crouched;
    else this.crouched = false;
    this.action = action; this.elapsed = 0; this.attackEmitted = false;
    this.demoUntil = demo && ['walk', 'run', 'crouch'].includes(action) ? 1.7 : 0;
    this.events.push({ type: 'action', action });
    return true;
  }
  hit() {
    if (this.dead || this.action === 'revive' || this.action === 'hurt') return false;
    this.hp = Math.max(0, this.hp - 1);
    return this.trigger(this.hp ? 'hurt' : 'death');
  }
  update(dt, { moving = false, running = false, crouching = false } = {}) {
    this.elapsed += dt;
    if (this.action === 'death' && this.elapsed >= AUTO_REVIVE_DELAY) this.trigger('revive');
    const duration = DURATIONS[this.action];
    if (['attack', 'attack2'].includes(this.action) && !this.attackEmitted && this.elapsed >= duration * .32) {
      this.attackEmitted = true; this.events.push({ type: 'strike', action: this.action });
    }
    if (duration && this.elapsed >= duration && this.action !== 'death') {
      const afterStand = this.action === 'stand' ? this.standNext : null;
      this.standNext = null;
      if (this.action === 'revive') { this.dead = false; this.hp = 3; this.events.push({ type: 'revived' }); }
      this.action = 'idle'; this.elapsed = 0; this.demoUntil = 0;
      if (afterStand) this.trigger(afterStand.action, { demo: afterStand.demo });
    }
    if (!LOCKED.has(this.action) && !this.dead && this.elapsed >= this.demoUntil) {
      const next = crouching || this.crouched ? 'crouch' : moving ? running ? 'run' : 'walk' : 'idle';
      if (next !== this.action) { this.action = next; this.elapsed = 0; this.events.push({ type: 'action', action: next }); }
    }
    return this.frame(moving);
  }
  get reviveIn() { return this.action === 'death' ? Math.max(0, AUTO_REVIVE_DELAY - this.elapsed) : 0; }
  frame(moving = false) {
    let group = this.action, index = 0, height = 0;
    const duration = DURATIONS[this.action];
    const progress = duration ? Math.min(this.elapsed / duration, 1) : 0;
    if (group === 'jump') {
      height = Math.sin(progress * Math.PI) * 1.85;
      if (progress >= .57) { group = 'land'; index = Math.min(this.groups.land.length - 1, Math.floor((progress - .57) / .43 * this.groups.land.length)); }
      else index = Math.min(this.groups.jump.length - 1, Math.floor(progress / .57 * this.groups.jump.length));
    } else if (group === 'revive') { group = 'death'; index = Math.max(0, this.groups.death.length - 1 - Math.floor(progress * this.groups.death.length)); }
    else if (group === 'stand') { group = 'crouch'; index = Math.max(0, this.standStart - Math.floor(progress * (this.standStart + 1))); }
    else if (group === 'crouch') {
      if (moving && this.elapsed > .25) { group = 'crouchWalk'; index = Math.floor(this.elapsed / .18) % this.groups.crouchWalk.length; }
      else index = Math.min(this.groups.crouch.length - 1, Math.floor(this.elapsed / .13));
    } else if (duration) index = Math.min(this.groups[group].length - 1, Math.floor(progress * this.groups[group].length));
    else index = Math.floor(this.elapsed / (group === 'run' ? .11 : group === 'walk' ? .17 : .42)) % this.groups[group].length;
    return { ...this.groups[group][index], group, index, action: this.action, progress, height };
  }
  drainEvents() { const events = this.events; this.events = []; return events; }
}
