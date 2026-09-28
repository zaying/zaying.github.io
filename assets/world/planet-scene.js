import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ActorController } from './actor-controller.js';

const FLOOR = 4.35;
const RADIUS = 4.85;
const COLORS = { mint: 0xa9e9dc, pink: 0xf0b4d1, lilac: 0xbca2ed, dark: 0x182637 };

export async function createUniverse({ mount, onOpen, onUpdate, onProgress, language = 'en', reduced = false, introOnly = false }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 180);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', '3D miniature planet: drag to rotate, scroll or pinch to zoom. WASD moves Pudding.');
  mount.dataset.renderer = 'webgl';
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.enablePan = false; controls.minDistance = 7; controls.maxDistance = introOnly ? 55 : 38;
  controls.minPolarAngle = .08; controls.maxPolarAngle = 1.7;
  controls.rotateSpeed = .65; controls.zoomSpeed = .75;
  controls.autoRotate = introOnly && !reduced; controls.autoRotateSpeed = .28;
  controls.keys = {}; // Arrow keys belong to Pudding, not the camera.
  let cameraTween = null, paused = false, lost = false;
  let lang = language, calm = reduced, battle = false;
  let npcHP = 5, npcPhase = 'idle', npcTimer = 0, hitCooldown = 0;
  let npcFlash = 0, last = 0, elapsed = 0, actionFrame = '', demoDirection = 1;
  const held = new Set(), effects = [], interactive = [], labels = [];
  const planet = new THREE.Group(); scene.add(planet);
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  const playerPosition = new THREE.Vector3(-.85, FLOOR, -1.0);
  const npcPosition = new THREE.Vector3(2.8, FLOOR, 1.45);
  let facing = 1;
  let seed = 87; const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };

  scene.add(new THREE.HemisphereLight(0xc5e7fa, 0x271e47, 2.5));
  const sun = new THREE.DirectionalLight(0xf8dacb, 3.3); sun.position.set(-7, 17, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.normalBias = .05; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fb5ff, 3); rim.position.set(8, 2, -8); scene.add(rim);
  const mintLight = new THREE.PointLight(COLORS.mint, 11, 14); mintLight.position.set(0, 7, 0); scene.add(mintLight);

  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x4f5670, roughness: .88, metalness: .12, flatShading: true, vertexColors: true });
  const stoneGeometry = new THREE.IcosahedronGeometry(6.4, 3);
  const positions = stoneGeometry.attributes.position;
  const vertexColors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const displacement = 1 + .025 * Math.sin(x * 2.9 + y * 1.5 + z * 1.7);
    positions.setXYZ(i, x * displacement, Math.min(y * displacement, FLOOR - .22), z * displacement);
    const tint = new THREE.Color().setHSL(.66 + .025 * Math.sin(z), .14, .4 + .055 * Math.sin(y * 1.8 + x));
    vertexColors.push(tint.r, tint.g, tint.b);
  }
  stoneGeometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  stoneGeometry.computeVertexNormals();
  const core = new THREE.Mesh(stoneGeometry, stoneMaterial); core.castShadow = true; core.receiveShadow = true; planet.add(core);

  function mesh(geometry, material, position, parent = planet) {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  const metal = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .35, ...extra });
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });
  const platform = mesh(new THREE.CylinderGeometry(5.05, 4.8, .3, 64), metal(0x354f62), [0, FLOOR - .15, 0]);
  const ring = mesh(new THREE.TorusGeometry(5.02, .055, 8, 100), glow(COLORS.mint), [0, FLOOR, 0]); ring.rotation.x = Math.PI / 2;
  const pathRing = mesh(new THREE.TorusGeometry(3.95, .025, 6, 80), glow(COLORS.lilac, .65), [0, FLOOR + .018, 0]); pathRing.rotation.x = Math.PI / 2;
  const top = mesh(new THREE.CircleGeometry(4.96, 64), metal(0x344451, { roughness: .9 }), [0, FLOOR + .002, 0]); top.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const tile = mesh(new THREE.BoxGeometry(.12, .018, .27), glow(i % 3 ? COLORS.mint : COLORS.pink), [Math.cos(a) * 4.8, FLOOR + .012, Math.sin(a) * 4.8]); tile.rotation.y = -a;
  }
  const atmosphereMaterial = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(0x658ec6) } },
    vertexShader: 'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(color,a*0.32);}',
  });
  mesh(new THREE.SphereGeometry(6.65, 48, 32), atmosphereMaterial, [0, 0, 0]).castShadow = false;

  // A tilted orbital ring and small moons make the diorama read as a planet in space.
  const orbit = new THREE.Group(); orbit.rotation.set(.35, 0, -.2); planet.add(orbit);
  const orbitRing = mesh(new THREE.TorusGeometry(8.3, .023, 5, 150), glow(COLORS.lilac, .28), [0, -.2, 0], orbit); orbitRing.rotation.x = Math.PI / 2;
  const moon = mesh(new THREE.IcosahedronGeometry(.48, 1), metal(0xc0adcb, { flatShading: true }), [8.3, -.2, 0], orbit);
  const moon2 = mesh(new THREE.IcosahedronGeometry(.22, 0), glow(COLORS.pink), [-7.6, -.2, 3.3], orbit);
  const starPositions = [];
  for (let i = 0; i < 520; i++) {
    const theta = random() * Math.PI * 2, phi = Math.acos(2 * random() - 1), r = 28 + random() * 48;
    starPositions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  const starsGeometry = new THREE.BufferGeometry(); starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xcbd8f5, size: .065, transparent: true, opacity: .7, sizeAttenuation: true })); scene.add(stars);

  function tube(points, color, thickness = .035, parent = planet) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, 50, thickness, 6, false), glow(color), [0, 0, 0], parent);
  }
  function destination(id, object, position, labelEN, labelZH, color) {
    object.traverse((node) => { if (node.isMesh) { node.userData.destination = id; interactive.push(node); } });
    const button = document.createElement('button'); button.className = 'scene-destination'; button.dataset.open = id;
    button.style.setProperty('--destination-color', `#${color.toString(16).padStart(6, '0')}`);
    document.querySelector('#scene-labels').append(button);
    labels.push({ button, position: new THREE.Vector3(...position), en: labelEN, zh: labelZH, id });
  }

  // The research lab is a real 3D dome with a door, workbench, monitor, and antenna.
  const lab = new THREE.Group(); lab.position.set(-.45, FLOOR, -1.4); planet.add(lab);
  mesh(new THREE.CylinderGeometry(2.12, 2.2, .25, 48), metal(0xb4c6ce), [0, .14, 0], lab);
  const labRing = mesh(new THREE.TorusGeometry(2.1, .035, 8, 64), glow(COLORS.mint), [0, .31, 0], lab); labRing.rotation.x = Math.PI / 2;
  const glass = mesh(new THREE.SphereGeometry(2.1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xc1e5ee, metalness: .08, roughness: .18, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }), [0, .31, 0], lab); glass.castShadow = false;
  for (let j = 0; j < 3; j++) {
    const angle = j / 3 * Math.PI;
    const points = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI; points.push([Math.cos(t) * Math.cos(angle) * 2.12, .31 + Math.sin(t) * 2.12, Math.cos(t) * Math.sin(angle) * 2.12]); }
    tube(points, j === 0 ? COLORS.mint : 0x728798, .025, lab);
  }
  mesh(new THREE.BoxGeometry(1.1, .13, .45), metal(0xa5b8c4), [-.35, .78, -.72], lab);
  mesh(new THREE.BoxGeometry(.075, .65, .08), metal(0x60717e), [-.75, .42, -.72], lab);
  mesh(new THREE.BoxGeometry(.075, .65, .08), metal(0x60717e), [.06, .42, -.72], lab);
  const monitor = mesh(new THREE.BoxGeometry(.65, .48, .055), metal(0x1b2b3b), [-.35, 1.1, -.78], lab); monitor.rotation.x = -.15;
  mesh(new THREE.PlaneGeometry(.55, .36), glow(0x98ddd8), [-.35, 1.1, -.738], lab);
  tube([[-.58, 1.1, -.705], [-.45, 1.1, -.705], [-.38, 1.22, -.705], [-.29, .99, -.705], [-.2, 1.12, -.705], [-.08, 1.12, -.705]], 0x2d7582, .009, lab);
  mesh(new THREE.CylinderGeometry(.13, .13, .3, 12), glow(COLORS.pink, .75), [.4, .96, -.72], lab);
  const doorGroup = new THREE.Group(); doorGroup.position.set(0, .28, 1.94); lab.add(doorGroup);
  const doorFrame = mesh(new THREE.BoxGeometry(1.04, .12, .12), metal(0x506f82), [0, 1.36, 0], doorGroup);
  const doorPosts = [-.49, .49].map((x) => mesh(new THREE.BoxGeometry(.08, 1.4, .12), metal(0x506f82), [x, .65, 0], doorGroup));
  const doorLeft = mesh(new THREE.BoxGeometry(.43, 1.22, .075), metal(0xa9c8d1, { transparent: true, opacity: .65 }), [-.23, .64, .08], doorGroup);
  const doorRight = mesh(new THREE.BoxGeometry(.43, 1.22, .075), metal(0xa9c8d1, { transparent: true, opacity: .65 }), [.23, .64, .08], doorGroup);
  doorFrame.userData.destination = 'door'; doorLeft.userData.destination = 'door'; doorRight.userData.destination = 'door'; interactive.push(doorFrame, doorLeft, doorRight);
  let doorOpen = true, doorSlide = 1;
  mesh(new THREE.BoxGeometry(.8, .055, .03), glow(COLORS.mint), [0, 1.36, .09], doorGroup);
  const antenna = new THREE.Group(); antenna.position.set(2, .1, -.7); lab.add(antenna);
  mesh(new THREE.CylinderGeometry(.025, .045, 2.7, 8), metal(0x93a9ba), [0, 1.35, 0], antenna);
  const dish = mesh(new THREE.SphereGeometry(.45, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(0xd7b6d1, { side: THREE.DoubleSide }), [0, 2.67, 0], antenna); dish.rotation.z = -.45;
  mesh(new THREE.SphereGeometry(.07, 12, 12), glow(COLORS.pink), [0, 2.92, 0], antenna);
  destination('research', lab, [-.45, FLOOR + 2.5, -1.4], '02 / Curiosity lab', '02 / 好奇心实验室', COLORS.mint);
  // Restore door hit targets after the lab's destination traversal.
  [doorFrame, doorLeft, doorRight, ...doorPosts].forEach((item) => { item.userData.destination = 'door'; });

  const observatory = new THREE.Group(); observatory.position.set(-3.3, FLOOR, 1.4); planet.add(observatory);
  mesh(new THREE.CylinderGeometry(.7, .8, .14, 32), metal(0x5b4967), [0, .07, 0], observatory);
  mesh(new THREE.CylinderGeometry(.055, .085, 1.1, 10), metal(0xc7a6bb), [0, .65, 0], observatory);
  const telescope = mesh(new THREE.CylinderGeometry(.18, .24, .9, 18), metal(0xccadc7), [0, 1.26, 0], observatory); telescope.rotation.z = -.9;
  mesh(new THREE.SphereGeometry(.16, 12, 12), glow(COLORS.pink), [.34, 1.57, 0], observatory);
  destination('about', observatory, [-3.3, FLOOR + 1.9, 1.4], '01 / My story', '01 / 我的故事', COLORS.pink);

  const workshop = new THREE.Group(); workshop.position.set(3, FLOOR, -2.5); planet.add(workshop);
  mesh(new THREE.CylinderGeometry(.68, .8, .14, 8), metal(0x635576), [0, .07, 0], workshop);
  const crystal = mesh(new THREE.OctahedronGeometry(.68), metal(COLORS.lilac, { emissive: COLORS.lilac, emissiveIntensity: .25, roughness: .18, metalness: .3 }), [0, 1.1, 0], workshop);
  const crystalEdges = new THREE.LineSegments(new THREE.EdgesGeometry(crystal.geometry), new THREE.LineBasicMaterial({ color: 0xe7d9fc, transparent: true, opacity: .7 })); crystal.add(crystalEdges);
  const crystalRing = mesh(new THREE.TorusGeometry(.68, .018, 6, 40), glow(COLORS.lilac), [0, .45, 0], workshop); crystalRing.rotation.x = Math.PI / 2;
  destination('creations', workshop, [3, FLOOR + 2.0, -2.5], '03 / Little workshop', '03 / 小小创作间', COLORS.lilac);

  // Small rocks and crystal flowers echo the user's floating-island panorama.
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * Math.PI * 2, r = 4.35 + random() * .3, size = .15 + random() * .2;
    const rock = mesh(new THREE.DodecahedronGeometry(size, 0), metal(i % 3 ? 0x586173 : 0x847398, { flatShading: true }), [Math.cos(a) * r, FLOOR + size * .6, Math.sin(a) * r]); rock.rotation.set(random(), random(), random());
    if (i % 4 === 0) { const flower = mesh(new THREE.OctahedronGeometry(.16), glow(i % 8 ? COLORS.pink : COLORS.mint), [Math.cos(a) * r, FLOOR + .55, Math.sin(a) * r]); flower.scale.y = 1.7; }
  }

  const manifestResponse = await fetch('./assets/world/actors/manifest.json');
  if (!manifestResponse.ok) throw new Error('Actor manifest could not load.');
  const manifest = await manifestResponse.json();
  const actor = new ActorController(manifest.groups);
  const textureCache = new Map();
  async function frameTexture(frame) {
    if (textureCache.has(frame.src)) return textureCache.get(frame.src);
    const promise = (async () => {
      const response = await fetch(frame.src); if (!response.ok) throw new Error(`Missing original frame: ${frame.src}`);
      const bitmap = await createImageBitmap(await response.blob());
      const [x, y, w, h] = frame.crop;
      // Only empty export margins are cropped, using alpha bounds recorded from the source.
      const ratio = Math.min(1, 560 / h, 1152 / w);
      const image = document.createElement('canvas'); image.width = Math.ceil(w * ratio); image.height = Math.ceil(h * ratio);
      image.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, image.width, image.height); bitmap.close();
      const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      return { texture, image, frame };
    })();
    textureCache.set(frame.src, promise); return promise;
  }
  const allFrames = introOnly ? [...manifest.groups.idle, ...manifest.groups.npcIdle] : Object.values(manifest.groups).flat();
  // Limit decode concurrency so the full animation set is comfortable on mobile.
  let loaded = 0, nextFrame = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (nextFrame < allFrames.length) { const frame = allFrames[nextFrame++]; await frameTexture(frame); onProgress?.(++loaded / allFrames.length); }
  }));
  for (const [key, value] of textureCache) textureCache.set(key, await value);

  const player = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: .015, toneMapped: false })); scene.add(player);
  const npc = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: .015, toneMapped: false })); npc.userData.destination = 'npc'; interactive.push(npc); scene.add(npc);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x111629, transparent: true, opacity: .35, depthWrite: false });
  const playerShadow = mesh(new THREE.CircleGeometry(.55, 32), shadowMaterial, [playerPosition.x, FLOOR + .035, playerPosition.z]); playerShadow.rotation.x = -Math.PI / 2;
  const npcShadow = mesh(new THREE.CircleGeometry(.7, 32), shadowMaterial.clone(), [npcPosition.x, FLOOR + .035, npcPosition.z]); npcShadow.rotation.x = -Math.PI / 2;

  function applyFrame(sprite, frame, scale = manifest.pixelScale, direction = 1) {
    const entry = textureCache.get(frame.src); if (!entry || entry.then) return;
    const [, , w, h] = frame.crop;
    const firstMap = !sprite.material.map; sprite.material.map = entry.texture; if (firstMap) sprite.material.needsUpdate = true;
    sprite.center.set(frame.anchor[0] / w, 1 - frame.anchor[1] / h);
    sprite.scale.set(w * scale * direction, h * scale, 1);
  }
  applyFrame(player, actor.frame()); applyFrame(npc, manifest.groups.npcIdle[1], .0031);
  player.position.copy(playerPosition); npc.position.copy(npcPosition);

  const reviveBeam = mesh(new THREE.CylinderGeometry(.75, .75, 4.3, 32, 1, true), new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), [0, 0, 0]); reviveBeam.visible = false;
  const reviveRing = mesh(new THREE.TorusGeometry(.8, .06, 8, 40), glow(COLORS.mint), [0, 0, 0]); reviveRing.rotation.x = Math.PI / 2; reviveRing.visible = false;

  function burst(position, color, size = 1) {
    const object = new THREE.Group(); object.position.copy(position); scene.add(object);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.35 * size, .045, 6, 30), material); object.add(halo);
    for (let i = 0; i < 10; i++) { const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.05 * size), material); const a = i / 10 * Math.PI * 2; spark.position.set(Math.cos(a) * .55 * size, Math.sin(a) * .55 * size, 0); object.add(spark); }
    effects.push({ object, material, elapsed: 0, life: .65 });
  }

  function view(name, instant = false) {
    const mobile = mount.clientWidth < 550;
    const presets = {
      orbit: { position: new THREE.Vector3(mobile ? introOnly ? 24 : 17 : 13, mobile ? introOnly ? 22 : 14 : 12, mobile ? introOnly ? 34 : 23 : 19), target: new THREE.Vector3(0, .75, 0) },
      land: { position: new THREE.Vector3(7.4, 9.6, 12.2), target: new THREE.Vector3(0, FLOOR + .75, -.15) },
    };
    const target = presets[name] || presets.orbit;
    if (instant || calm) { camera.position.copy(target.position); controls.target.copy(target.target); controls.update(); cameraTween = null; }
    else cameraTween = { from: camera.position.clone(), targetFrom: controls.target.clone(), to: target.position, targetTo: target.target, elapsed: 0 };
    mount.dataset.view = name; canvas.focus({ preventScroll: true });
  }
  function rotate(amount) {
    cameraTween = null; const relative = camera.position.clone().sub(controls.target); relative.applyAxisAngle(new THREE.Vector3(0, 1, 0), amount); camera.position.copy(controls.target).add(relative); controls.update();
  }
  function zoom(factor) { cameraTween = null; const offset = camera.position.clone().sub(controls.target); const length = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance); offset.setLength(length); camera.position.copy(controls.target).add(offset); controls.update(); }
  function challenge() {
    if (battle && npcHP > 0) { battle = false; npcPhase = 'idle'; npc.position.copy(npcPosition); return; }
    if (actor.dead) actor.trigger('revive');
    battle = true; npcHP = 5; npcPhase = 'idle'; npcTimer = 1;
    npcPosition.set(2.55, FLOOR, 1.75); playerPosition.set(.5, FLOOR, 1.85); view('land');
  }
  function action(name, demo = false) {
    const success = actor.trigger(name, { demo });
    if (success) { if (demo) view('land'); canvas.focus({ preventScroll: true }); }
    return success;
  }
  function interact() {
    let nearest = null, distance = 3.4;
    for (const label of labels) { const d = Math.hypot(label.position.x - playerPosition.x, label.position.z - playerPosition.z); if (d < distance) { nearest = label; distance = d; } }
    if (nearest) onOpen(nearest.id);
  }
  function keyboard(event, down) {
    if (introOnly) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!down) { held.delete(key); return; }
    if (paused || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const movement = ['w', 'a', 's', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift'];
    if (movement.includes(key)) { event.preventDefault(); held.add(key); actor.demoUntil = 0; }
    if (event.repeat) return;
    const keys = { ' ': 'jump', c: 'crouch', j: 'attack', k: 'attack2', h: 'hurt', x: 'death', r: 'revive' };
    if (keys[key] && !event.target.closest('button,a')) { event.preventDefault(); action(keys[key]); }
    if (key === 'e') interact();
    if (key === 'Home') { event.preventDefault(); view('orbit'); }
  }
  window.addEventListener('keydown', (event) => keyboard(event, true));
  window.addEventListener('keyup', (event) => keyboard(event, false));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('visibilitychange', () => held.clear());
  let dragStart = null, multiTouch = false;
  canvas.addEventListener('pointerdown', (event) => { canvas.focus({ preventScroll: true }); if (dragStart) multiTouch = true; else { dragStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; multiTouch = false; } });
  canvas.addEventListener('pointerup', (event) => {
    if (introOnly) { dragStart = null; return; }
    if (!dragStart || multiTouch || Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 6) { dragStart = null; return; }
    dragStart = null;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(interactive, false);
    if (intersections.length) {
      const id = intersections[0].object.userData.destination;
      if (id === 'door') doorOpen = !doorOpen;
      else if (id === 'npc') onOpen('npc');
      else onOpen(id);
    }
  });
  canvas.addEventListener('pointercancel', () => { dragStart = null; });
  controls.addEventListener('start', () => { cameraTween = null; });
  controls.addEventListener('change', () => {
    mount.dataset.camera = camera.position.toArray().map((v) => v.toFixed(2)).join(',');
    mount.dataset.zoom = camera.position.distanceTo(controls.target).toFixed(2);
  });
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; document.querySelector('#scene-error').hidden = false; });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  let portraitMode = null;
  function resize() {
    const width = mount.clientWidth, height = mount.clientHeight; if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    const portrait = width < 550;
    if (introOnly && portraitMode !== null && portrait !== portraitMode) view('orbit', true);
    portraitMode = portrait;
  }
  const observer = new ResizeObserver(resize); observer.observe(mount); resize(); view('orbit', true);

  const preview = document.querySelector('#actor-preview'); const previewContext = preview.getContext('2d');
  function updatePreview(frame) {
    const entry = textureCache.get(frame.src); if (!entry || entry.then) return;
    previewContext.clearRect(0, 0, preview.width, preview.height);
    const image = entry.image; const ratio = Math.min((preview.width - 36) / image.width, (preview.height - 35) / image.height);
    previewContext.drawImage(image, (preview.width - image.width * ratio) / 2, (preview.height - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
    document.querySelector('#frame-name').textContent = `${frame.group} / ${String(frame.index + 1).padStart(2, '0')} · ${frame.source.split('\\').pop()}`;
  }

  function clampToPlanet(position) { const length = Math.hypot(position.x, position.z); if (length > RADIUS - .25) { position.x *= (RADIUS - .25) / length; position.z *= (RADIUS - .25) / length; } }
  function strike(type) {
    const range = type === 'attack2' ? 6 : 2.6;
    const distance = playerPosition.distanceTo(npcPosition);
    const point = playerPosition.clone(); point.y += 1;
    burst(point, type === 'attack2' ? COLORS.lilac : COLORS.pink, type === 'attack2' ? 1.7 : 1);
    if (battle && npcHP > 0 && distance < range) {
      npcHP = Math.max(0, npcHP - (type === 'attack2' ? 2 : 1)); npcFlash = .4;
      burst(npcPosition.clone().add(new THREE.Vector3(0, 1, 0)), COLORS.pink, 1.2);
      const away = npcPosition.clone().sub(playerPosition).normalize().multiplyScalar(.45); npcPosition.add(away); clampToPlanet(npcPosition);
      if (!npcHP) { npcPhase = 'defeated'; battle = false; }
    }
  }
  function updateNPC(dt, frame) {
    npcFlash = Math.max(0, npcFlash - dt); hitCooldown = Math.max(0, hitCooldown - dt);
    if (!battle || actor.dead || npcHP === 0) return;
    const delta = playerPosition.clone().sub(npcPosition); delta.y = 0; const distance = delta.length();
    if (npcPhase === 'idle') {
      npcTimer -= dt;
      if (distance > 1.55) npcPosition.addScaledVector(delta.normalize(), dt * .8);
      else if (npcTimer <= 0) { npcPhase = 'charge'; npcTimer = .65; }
    } else if (npcPhase === 'charge') {
      npcTimer -= dt;
      if (npcTimer <= 0) {
        burst(npcPosition.clone().add(new THREE.Vector3(0, 1, 0)), 0xf69abb, 1.5);
        const dodging = frame.height > .55 || actor.action === 'crouch';
        if (distance < 2.15 && !dodging && !hitCooldown) { actor.hit(); hitCooldown = 1.6; burst(playerPosition.clone().add(new THREE.Vector3(0, .9, 0)), COLORS.pink); }
        npcPhase = 'idle'; npcTimer = 1.4;
      }
    }
    clampToPlanet(npcPosition);
  }
  function updateLabels() {
    const rect = canvas.getBoundingClientRect(); const outer = document.querySelector('#world').getBoundingClientRect();
    const toolbar = document.querySelector('.camera-tools').getBoundingClientRect();
    for (const label of labels) {
      const projected = label.position.clone().project(camera);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95;
      label.button.hidden = !visible;
      const x = rect.left + (projected.x + 1) * .5 * rect.width;
      let y = rect.top + (1 - projected.y) * .5 * rect.height;
      const halfWidth = label.button.offsetWidth / 2, height = label.button.offsetHeight;
      if (x + halfWidth > toolbar.left - 8 && x - halfWidth < toolbar.right + 8 && y > toolbar.top - 8 && y - height < toolbar.bottom + 8) y = toolbar.bottom + height + 10;
      label.button.style.left = `${x - outer.left}px`;
      label.button.style.top = `${y - outer.top}px`;
    }
  }
  function render(time) {
    requestAnimationFrame(render);
    if (introOnly && paused) { last = time; return; }
    if (lost || document.hidden) { last = time; return; }
    const dt = Math.min((time - last) / 1000 || .016, .05); last = time;
    if (cameraTween) {
      cameraTween.elapsed += dt; const t = Math.min(cameraTween.elapsed / .9, 1), smooth = t * t * (3 - 2 * t);
      camera.position.lerpVectors(cameraTween.from, cameraTween.to, smooth); controls.target.lerpVectors(cameraTween.targetFrom, cameraTween.targetTo, smooth);
      if (t >= 1) cameraTween = null;
    }
    controls.update();
    if (!paused) {
      elapsed += dt;
      let dx = (held.has('d') || held.has('ArrowRight') ? 1 : 0) - (held.has('a') || held.has('ArrowLeft') ? 1 : 0);
      let dz = (held.has('s') || held.has('ArrowDown') ? 1 : 0) - (held.has('w') || held.has('ArrowUp') ? 1 : 0);
      let moving = dx !== 0 || dz !== 0;
      if (!moving && actor.demoUntil > actor.elapsed && ['walk', 'run'].includes(actor.action)) { dx = demoDirection; moving = true; if (Math.abs(playerPosition.x) > 3.2) demoDirection *= -1; }
      const running = held.has('Shift') || actor.action === 'run' && actor.demoUntil > actor.elapsed;
      const locked = ['stand', 'attack', 'attack2', 'hurt', 'death', 'revive'].includes(actor.action);
      if (moving && !locked && !actor.dead) {
        const forward = camera.position.clone().sub(controls.target); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(forward.z, 0, -forward.x);
        const motion = right.multiplyScalar(dx).addScaledVector(forward, dz).normalize();
        const speed = actor.action === 'crouch' ? .7 : running ? 3.6 : 1.65;
        playerPosition.addScaledVector(motion, dt * speed); clampToPlanet(playerPosition);
        if (dx) facing = dx < 0 ? -1 : 1;
      }
      const frame = actor.update(dt, { moving, running });
      for (const event of actor.drainEvents()) { if (event.type === 'strike') strike(event.action); if (event.type === 'revived') { hitCooldown = 2; playerPosition.set(-.85, FLOOR, -1.0); } }
      updateNPC(dt, frame);
      const insideLab = Math.hypot(playerPosition.x + .45, playerPosition.z + 1.4) < 2.02;
      const floorOffset = insideLab ? .32 : .04;
      applyFrame(player, frame, .00235, facing); player.position.copy(playerPosition); player.position.y += frame.height + floorOffset + .06;
      playerShadow.position.set(playerPosition.x, FLOOR + floorOffset + .035, playerPosition.z); playerShadow.material.opacity = .35 / (1 + frame.height);
      player.material.opacity = actor.action === 'hurt' ? .65 + .35 * Math.abs(Math.sin(elapsed * 30)) : 1;
      const npcFrame = manifest.groups.npcIdle[Math.floor(elapsed / .42) % manifest.groups.npcIdle.length];
      applyFrame(npc, npcFrame, .0031);
      npc.position.copy(npcPosition); npc.position.y += .08;
      npc.material.color.set(npcFlash || npcPhase === 'charge' ? 0xffa9c4 : 0xffffff);
      npc.material.opacity = npcHP === 0 ? .33 : 1;
      npc.material.rotation = npcHP === 0 ? -.6 : npcPhase === 'charge' ? Math.sin(elapsed * 20) * .035 : 0;
      npcShadow.position.set(npcPosition.x, FLOOR + .035, npcPosition.z);
      if (!calm) { crystal.rotation.y += dt * .28; crystal.position.y = 1.1 + Math.sin(elapsed * 1.5) * .12; moon.position.set(Math.cos(elapsed * .035) * 8.3, -.2, Math.sin(elapsed * .035) * 8.3); stars.rotation.y += dt * .002; }
      doorSlide = THREE.MathUtils.damp(doorSlide, doorOpen ? 1 : 0, 5, dt); doorLeft.position.x = -.23 - doorSlide * .44; doorRight.position.x = .23 + doorSlide * .44;
      const reviving = actor.action === 'revive'; reviveBeam.visible = reviving; reviveRing.visible = reviving;
      if (reviving) { reviveBeam.position.copy(playerPosition).add(new THREE.Vector3(0, 2, 0)); reviveBeam.material.opacity = .2 * Math.sin(frame.progress * Math.PI); reviveRing.position.copy(playerPosition).add(new THREE.Vector3(0, .08 + frame.progress * 2.8, 0)); reviveRing.scale.setScalar(.7 + Math.sin(frame.progress * Math.PI) * .6); }
      for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i]; effect.elapsed += dt; effect.object.quaternion.copy(camera.quaternion); effect.object.scale.setScalar(1 + effect.elapsed * 2); effect.material.opacity = Math.max(0, 1 - effect.elapsed / effect.life);
        if (effect.elapsed >= effect.life) { effect.object.traverse((node) => { if (node.geometry) node.geometry.dispose(); }); scene.remove(effect.object); effect.material.dispose(); effects.splice(i, 1); }
      }
      const token = `${frame.action}/${frame.group}/${frame.index}`;
      if (!introOnly && token !== actionFrame) { updatePreview(frame); actionFrame = token; }
      onUpdate?.({ action: frame.action, group: frame.group, frame: frame.index, hp: actor.hp, dead: actor.dead, battle, npcHP, npcPhase, position: playerPosition.toArray(), frameSource: frame.src });
    }
    if (!introOnly) updateLabels(); renderer.render(scene, camera);
  }
  function setLanguage(next) {
    lang = next;
    labels.forEach((label) => { label.button.textContent = next === 'zh' ? label.zh : label.en; });
    canvas.setAttribute('aria-label', next === 'zh' ? '3D 小宇宙入口：拖动旋转，滚轮或双指缩放。' : '3D cosmos entrance: drag to rotate, scroll or pinch to zoom.');
  }
  setLanguage(lang); requestAnimationFrame(render);
  return {
    action, view, rotate, zoom, challenge, interact,
    move(direction, active) { const key = { left: 'a', right: 'd', up: 'w', down: 's' }[direction]; if (active) { held.add(key); actor.demoUntil = 0; } else held.delete(key); },
    pause(value) { paused = value; controls.enabled = !value; held.clear(); },
    setReduced(value) { calm = value; controls.autoRotate = introOnly && !value; if (value) cameraTween = null; },
    setLanguage,
  };
}
