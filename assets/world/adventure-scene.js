import { ActorController } from './actor-controller.js';
import { EncounterController, StoneheartController, distance, facingFor, ALERT_RADIUS } from './encounter-controller.js';
import { loadManifest, loadFrame, loadFrames, loadImage, firstFrames, availableFrame } from './actor-assets.js';

export async function createAdventure({ canvas, onOpen, onUpdate, onFocus, language = 'en' }) {
  const manifest = await loadManifest(), frames = Object.values(manifest.groups).flat();
  const images = new Map();
  await Promise.all(firstFrames(manifest.groups).map(async (frame) => images.set(frame.src, await loadFrame(frame))));
  // A small effect asset must never prevent either character from appearing.
  let crystal = document.createElement('canvas'); crystal.width = 64; crystal.height = 32;
  const shardContext = crystal.getContext('2d'); shardContext.fillStyle = '#c9b9ed';
  shardContext.beginPath(); shardContext.moveTo(0, 16); shardContext.lineTo(20, 4); shardContext.lineTo(64, 16); shardContext.lineTo(20, 28); shardContext.closePath(); shardContext.fill();
  loadImage('./assets/world/crystal-shard.svg').then((image) => { crystal = image; }).catch(console.warn);
  let animationsStarted = false;
  function loadAnimations() {
    if (animationsStarted) return; animationsStarted = true;
    loadFrames(frames, (frame, image) => { images.set(frame.src, image); frameToken = ''; }, () => {
      canvas.dataset.partial = 'true'; // Other frames keep animating after a failed download.
    });
  }
  const ctx = canvas.getContext('2d'), actor = new ActorController(manifest.groups), encounter = new EncounterController(), stoneheart = new StoneheartController();
  const held = new Set(), effects = [], player = { x: 480, y: 480 }, npc = { x: 735, y: 470 };
  let width = 0, height = 0, last = 0, elapsed = 0, paused = true, facing = 1, target = null, frameToken = '', lang = language;
  const preview = document.querySelector('#actor-preview'), previewCtx = preview.getContext('2d');
  const bubble = document.querySelector('#adventure-bubble');
  function resize() { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; width = rect.width; height = rect.height; const dpr = Math.min(devicePixelRatio, 1.7); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  new ResizeObserver(resize).observe(canvas); resize();
  const point = (position) => ({ x: position.x / 1000 * width, y: position.y / 600 * height });
  function drawFrame(context, frame, x, y, scale, direction = 1) {
    frame = availableFrame(frame, manifest.groups, images);
    const image = images.get(frame.src), [, , w, h] = frame.crop;
    context.save(); context.translate(x, y); context.scale(direction, 1);
    context.drawImage(image, -frame.anchor[0] * scale, -frame.anchor[1] * scale, w * scale, h * scale); context.restore();
  }
  function previewFrame(frame) {
    const requested = frame; frame = availableFrame(frame, manifest.groups, images);
    previewCtx.clearRect(0, 0, preview.width, preview.height);
    const [x, y, w, h] = frame.crop, scale = Math.min((preview.width - 36) / w, (preview.height - 36) / h);
    previewCtx.save(); previewCtx.translate(preview.width / 2, preview.height / 2); previewCtx.scale(facing, 1);
    previewCtx.drawImage(images.get(frame.src), -w * scale / 2, -h * scale / 2, w * scale, h * scale); previewCtx.restore();
    document.querySelector('#frame-name').textContent = `${requested.group} / ${String(requested.index + 1).padStart(2, '0')}`;
  }
  function action(name, demo = false) {
    if (['hurt', 'death'].includes(name)) return false;
    const group = name === 'revive' ? 'death' : name;
    loadFrames(manifest.groups[group] || [], (frame, image) => images.set(frame.src, image));
    const result = actor.trigger(name, { demo }); if (result) canvas.focus({ preventScroll: true }); return result;
  }
  function interact() {
    let nearest = null, best = 220;
    const stage = canvas.getBoundingClientRect();
    for (const station of document.querySelectorAll('.station')) {
      const rect = station.getBoundingClientRect();
      const x = (rect.left + rect.width / 2 - stage.left) / stage.width * 1000, y = (rect.bottom - stage.top) / stage.height * 600;
      const d = distance(player, { x, y }); if (d < best) { best = d; nearest = station.dataset.open; }
    }
    if (nearest) onOpen(nearest);
  }
  function keyboard(event, down) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!down) { held.delete(key); return; }
    if (paused || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const movement = ['w', 'a', 's', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift'];
    if (movement.includes(key)) { event.preventDefault(); held.add(key); target = null; actor.demoUntil = 0; if (['a', 'ArrowLeft'].includes(key)) facing = -1; if (['d', 'ArrowRight'].includes(key)) facing = 1; }
    if (event.repeat || event.target.closest('button,a')) return;
    const keys = { ' ': 'jump', c: 'crouch', j: 'attack', k: 'attack2', r: 'revive' };
    if (keys[key]) { event.preventDefault(); action(keys[key]); } if (key === 'e') interact();
  }
  window.addEventListener('keydown', (event) => keyboard(event, true)); window.addEventListener('keyup', (event) => keyboard(event, false));
  window.addEventListener('blur', () => held.clear()); document.addEventListener('visibilitychange', () => held.clear());
  function selectScenePoint(event) {
    if (paused) return; canvas.focus({ preventScroll: true }); const rect = canvas.getBoundingClientRect();
    const position = { x: (event.clientX - rect.left) / rect.width * 1000, y: (event.clientY - rect.top) / rect.height * 600 };
    if (stoneheart.opacity > 0 && Math.abs(position.x - npc.x) < 45 && position.y < npc.y && position.y > npc.y - 130) { onOpen('npc'); return; }
    target = { x: Math.max(200, Math.min(950, position.x)), y: Math.max(230, Math.min(520, position.y)) };
    onFocus?.(innerWidth <= 760 ? position.x / 1000 : event.clientX / innerWidth, innerWidth <= 760 ? position.y / 600 : event.clientY / innerHeight);
  }
  // Let a finger scroll the page without sending Pudding toward Stoneheart.
  let touchStart = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    else selectScenePoint(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (touchStart?.id === event.pointerId && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8) touchStart = null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (touchStart?.id === event.pointerId && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <= 8) selectScenePoint(event);
    touchStart = null;
  });
  canvas.addEventListener('pointercancel', () => { touchStart = null; });
  function spark(position, color = '#eeb2ce') { effects.push({ ...position, color, age: 0 }); }
  function strike(type) {
    spark({ x: player.x + facing * 35, y: player.y - 65 }, type === 'attack2' ? '#c4b3ef' : '#eeb2ce');
    if (!stoneheart.active) return;
    const delta = npc.x - player.x, inFront = Math.sign(delta) === facing || Math.abs(delta) < 20;
    const range = type === 'attack2' ? 340 : 145;
    if (inFront && distance(player, npc) < range && stoneheart.damage(type === 'attack2' ? 2 : 1)) spark({ x: npc.x, y: npc.y - 65 });
  }
  function render(time) {
    requestAnimationFrame(render); const dt = Math.min((time - last) / 1000 || .016, .05); last = time;
    if (paused || document.hidden || !width) return;
    loadAnimations();
    elapsed += dt;
    let dx = (held.has('d') || held.has('ArrowRight') ? 1 : 0) - (held.has('a') || held.has('ArrowLeft') ? 1 : 0);
    let dy = (held.has('s') || held.has('ArrowDown') ? 1 : 0) - (held.has('w') || held.has('ArrowUp') ? 1 : 0);
    if (!dx && !dy && target) { dx = target.x - player.x; dy = target.y - player.y; if (Math.hypot(dx, dy) < 3) { target = null; dx = 0; dy = 0; } }
    if (!dx && !dy && actor.demoUntil > actor.elapsed && ['walk', 'run'].includes(actor.action)) dx = facing;
    const moving = dx !== 0 || dy !== 0, running = held.has('Shift') || actor.action === 'run' && actor.demoUntil > actor.elapsed;
    const locked = ['stand', 'attack', 'attack2', 'hurt', 'death', 'revive'].includes(actor.action);
    if (moving && !locked && !actor.dead) {
      facing = facingFor(dx, facing); const length = Math.hypot(dx, dy), speed = actor.crouched ? 55 : running ? 235 : 130;
      player.x = Math.max(200, Math.min(950, player.x + dx / length * speed * dt)); player.y = Math.max(230, Math.min(520, player.y + dy / length * speed * dt));
    }
    let frame = actor.update(dt, { moving, running });
    for (const event of actor.drainEvents()) { if (event.type === 'strike') strike(event.action); if (event.type === 'revived') { player.x = 480; player.y = 480; target = null; encounter.reset(); } }
    stoneheart.update(dt);
    for (const event of stoneheart.drainEvents()) if (['defeated', 'reviving', 'revived'].includes(event.type)) encounter.reset();
    const center = { x: player.x, y: player.y - (actor.crouched ? 20 : 60) - frame.height * 45 };
    const state = encounter.update(dt, { player, npc, target: center, alive: !actor.dead && actor.action !== 'revive', npcHP: stoneheart.active ? stoneheart.hp : 0 });
    for (const event of encounter.drainEvents()) { if (event.type === 'hit' && actor.hit()) { spark(event.position); target = null; } }
    frame = actor.frame(moving);
    ctx.clearRect(0, 0, width, height);
    const p = point(player), n = point(npc), scale = Math.min(width < 700 ? .135 : .22, height / 2500), npcScale = scale * 1.12;
    const hud = document.querySelector('.actor-hud'); hud.style.left = `${p.x}px`; hud.style.top = `${p.y + 24}px`;
    const npcHud = document.querySelector('.npc-hud'); npcHud.style.left = `${n.x}px`; npcHud.style.top = `${n.y + 24}px`;
    function shadow(position, size) { ctx.save(); ctx.fillStyle = '#dcafd028'; ctx.beginPath(); ctx.ellipse(position.x, position.y + 4, size, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    shadow(p, 850 * scale * .3); ctx.save(); ctx.globalAlpha = stoneheart.opacity; if (stoneheart.opacity > 0) shadow(n, 850 * npcScale * .3); ctx.restore();
    if (state.phase === 'charge') {
      ctx.save(); ctx.strokeStyle = '#c8b1ee'; ctx.lineWidth = 1.5; ctx.globalAlpha = .6 + .3 * Math.sin(elapsed * 22); ctx.beginPath(); ctx.ellipse(n.x, n.y + 4, 43, 12, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const npcFrame = manifest.groups.npcIdle[Math.floor(elapsed / .42) % manifest.groups.npcIdle.length];
    if (stoneheart.opacity > 0) { ctx.save(); ctx.globalAlpha = stoneheart.opacity; drawFrame(ctx, npcFrame, n.x, n.y, npcScale); ctx.restore(); }
    ctx.save(); if (actor.action === 'hurt') ctx.globalAlpha = .5 + .5 * Math.abs(Math.sin(elapsed * 25)); drawFrame(ctx, frame, p.x, p.y - frame.height * 45 / 600 * height, scale, facing); ctx.restore();
    for (const shard of state.projectiles) {
      const at = point(shard); ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(Math.atan2(shard.vy * height / 600, shard.vx * width / 1000));
      const trail = ctx.createLinearGradient(-60, 0, 0, 0); trail.addColorStop(0, '#b2b1ed00'); trail.addColorStop(1, '#b2b1ed88'); ctx.fillStyle = trail; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.fill(); ctx.shadowColor = '#d4b5f6'; ctx.shadowBlur = 9; ctx.drawImage(crystal, -19, -10, 38, 20); ctx.restore();
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i]; effect.age += dt; const at = point(effect); ctx.save(); ctx.globalAlpha = Math.max(0, 1 - effect.age / .65); ctx.strokeStyle = effect.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(at.x, at.y, 12 + effect.age * 45, 0, Math.PI * 2); ctx.stroke();
      for (let j = 0; j < 8; j++) { const angle = j / 8 * Math.PI * 2, r = 15 + effect.age * 70; ctx.save(); ctx.translate(at.x + Math.cos(angle) * r, at.y + Math.sin(angle) * r); ctx.rotate(angle); ctx.drawImage(crystal, -7, -4, 14, 8); ctx.restore(); } ctx.restore(); if (effect.age > .65) effects.splice(i, 1);
    }
    if (actor.action === 'revive') { ctx.save(); ctx.globalAlpha = Math.sin(frame.progress * Math.PI) * .5; const gradient = ctx.createLinearGradient(p.x - 40, 0, p.x + 40, 0); gradient.addColorStop(0, '#b4eddf00'); gradient.addColorStop(.5, '#b4eddfbb'); gradient.addColorStop(1, '#b4eddf00'); ctx.fillStyle = gradient; ctx.fillRect(p.x - 40, p.y - 240, 80, 245); ctx.restore(); }
    const token = `${frame.group}/${frame.index}/${facing}`; if (token !== frameToken) { previewFrame(frame); frameToken = token; }
    bubble.style.left = `${p.x}px`; bubble.style.top = `${p.y - 850 * scale - 28}px`; bubble.classList.toggle('quiet', elapsed > 8 || actor.action !== 'idle');
    onUpdate?.({ action: frame.action, group: frame.group, frame: frame.index, frameSource: frame.src, hp: actor.hp, dead: actor.dead, reviveIn: actor.reviveIn, npcHP: stoneheart.hp, npcLife: stoneheart.phase, npcOpacity: stoneheart.opacity, npcReviveIn: stoneheart.reviveIn, npcPhase: state.phase, nearby: state.nearby, shots: state.shots, projectiles: state.projectiles.length, facing, position: [player.x, player.y, 0] });
    canvas.dataset.facing = String(facing); canvas.dataset.npcDistance = distance(player, npc).toFixed(1); canvas.dataset.alertRadius = String(ALERT_RADIUS); canvas.dataset.projectiles = String(state.projectiles.length); canvas.dataset.shots = String(state.shots);
  }
  requestAnimationFrame(render); canvas.dataset.ready = 'true';
  return { action, interact, pause(value) { paused = value; held.clear(); if (!value) resize(); }, setLanguage(value) { lang = value; canvas.setAttribute('aria-label', lang === 'zh' ? 'WASD 或方向键移动；J/K 攻击，空格跳跃，C 蹲下，R 复活。靠近石心人会触发晶石射击。' : 'WASD or arrows move; J/K attack, Space jumps, C crouches, R revives. Approaching Stoneheart triggers crystal shots.'); }, setReduced() {}, move(direction, active) { const key = { left: 'a', right: 'd', up: 'w', down: 's' }[direction]; target = null; actor.demoUntil = 0; if (active) held.add(key); else held.delete(key); } };
}
