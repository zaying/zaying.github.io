const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const uiIcon = (name, className = '') => `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
const translations = {
  en: {
    skip: 'Skip to navigation', navAbout: 'About me', navResearch: 'Research', navCreations: 'Creations', navContact: 'Say hello',
    eyebrow: "HELLO, EARTHLING. I'M ZAYING.", title1: 'A little world', title2: 'Outside of time.',
    intro: 'Exploring AI for health, making things by hand,<br>and leaving a little room for wonder.', explore: 'Explore my universe', read: 'Or, get to know me',
    stationAbout: 'My story', stationResearch: 'Curiosity lab', stationCreations: 'Made with love', bubble: "A tiny adventure? Let's go!",
    worldHint: 'Drag to orbit · scroll to zoom · click a destination', note: 'Somewhere between<br>science & a daydream.',
    connection: "YOU'VE LANDED IN ZAYING'S UNIVERSE", controls: 'move · jump', footerContact: "Let's make something good", back: 'Back to the universe',
    nearby: 'Press E to explore', moving: 'Click anywhere to wander · ← → / A D to move · SPACE to jump', reduce: 'Reduce animation', animate: 'Enable animation',
  },
  zh: {
    skip: '跳转到导航', navAbout: '关于我', navResearch: '研究', navCreations: '创作', navContact: '打个招呼',
    eyebrow: '你好，地球来客。我是zaying。', title1: '小小的世界，', title2: '在时间之外。',
    intro: '探索 AI 与健康，亲手创造喜欢的事物，<br>也为奇思妙想留一点空间。', explore: '探索我的小宇宙', read: '或者，先认识一下我',
    stationAbout: '我的故事', stationResearch: '好奇心实验室', stationCreations: '用心创造', bubble: '小小的冒险？一起出发吧！',
    worldHint: '拖动旋转 · 滚轮缩放 · 点击目的地探索', note: '在科学与白日梦之间，<br>漫游一会儿。',
    connection: '你已降落在 ZAYING 的小宇宙', controls: '移动 · 跳跃', footerContact: '一起做点有趣的事', back: '回到小宇宙',
    nearby: '按 E 探索', moving: '点击场景漫游 · ← → / A D 移动 · 空格跳跃', reduce: '减少动画', animate: '开启动画',
  },
};

function readSetting(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function saveSetting(key, value) { try { localStorage.setItem(key, value); } catch {} }
let language = readSetting('zaying-language', 'en');
if (!translations[language]) language = 'en';
let reduced = readSetting('zaying-motion', String(matchMedia('(prefers-reduced-motion: reduce)').matches)) === 'true';
let activePanel = null;
let previousFocus = null;
const panel = $('#panel');
const world = $('#world');
const hint = $('#explore-hint');
let universe = null;
let entranceScene = null;
let sceneView = null;
let screen = 'entrance';
let worldPromise = null;
let entrancePromise = null;
Object.assign(translations.en, {
  loading: 'Assembling your little planet…', sceneError: 'The 3D scene could not load. Your personal information is still available from the navigation above.', retry: 'Try again',
  viewOrbit: 'Orbit', viewLand: 'Land', planetLabel: 'PUDDING PLANET / A LITTLE LAB IN SPACE', challenge: 'Challenge Stoneheart', peace: 'End the duel', npcWaiting: 'Stoneheart · waiting',
  actionsLabel: "PUDDING'S MOVES", inspect: 'Inspect the artwork', inspectorTitle: 'Original frames, in full',
  actionIdle: 'Idle', actionWalk: 'Walk', actionRun: 'Run', actionJump: 'Jump', actionCrouch: 'Crouch', actionStand: 'Stand', actionAttack: 'Attack', actionAttack2: 'Burst', actionHurt: 'Hit', actionDeath: 'Die', actionRevive: 'Revive',
  actionLand: 'Landing', npcDefeated: 'Stoneheart defeated · click to restart', deadHint: 'Pudding is down · reviving in {seconds}s · press R to revive now.', revivingHint: 'Pudding is reviving and returning to safety…', victoryHint: 'Stoneheart is defeated. A little peace returns to the planet.',
  door: 'Open / close lab door', npc: 'Stoneheart', npcCopy: 'The antagonist from my original game artwork. Challenge Stoneheart to try attacks, dodging, damage, death, and revival. J / K attack, C crouches, SPACE dodges, R revives.',
});
Object.assign(translations.zh, {
  loading: '正在组装你的小小星球…', sceneError: '3D 场景暂时无法加载。你仍可从顶部导航查看个人信息。', retry: '重新加载',
  viewOrbit: '环绕星球', viewLand: '着陆', planetLabel: '布丁星球 / 宇宙中的小小实验室', challenge: '挑战石心人', peace: '结束对战', npcWaiting: '石心人 · 等待中',
  actionsLabel: '小鼻嘎的动作', inspect: '放大查看原画', inspectorTitle: '完整原始动作帧',
  actionIdle: '呼吸', actionWalk: '行走', actionRun: '跑', actionJump: '跳', actionCrouch: '蹲', actionStand: '起身', actionAttack: '攻击', actionAttack2: '远程攻击', actionHurt: '被攻击', actionDeath: '死亡', actionRevive: '复活',
  actionLand: '降落', npcDefeated: '石心人已击败 · 点击再战', deadHint: '小鼻嘎倒下了 · {seconds} 秒后自动复活 · 按 R 提前复活。', revivingHint: '小鼻嘎正在复活，返回安全位置…', victoryHint: '石心人被击败，小小星球恢复了平静。',
  door: '开关实验室门', npc: '石心人', npcCopy: '来自我原作的反派 NPC。挑战石心人后可以体验攻击、躲避、受伤、死亡与复活。J / K 攻击，C 蹲下，空格跳跃躲避，R 复活。',
});

const scholar = 'https://scholar.google.com/citations?user=Id8HMRgAAAAJ&hl=zh-CN';
const external = 'target="_blank" rel="noopener noreferrer"';
const content = {
  en: {
    about: `<p class="panel-kicker">01 / THE OBSERVATORY</p><h2 id="panel-title">Hi, I'm Jiaying.</h2>
      <div class="profile-row"><img src="./images/profile.jpg" alt="Wang Jiaying / 王佳影"><p>Wang Jiaying / 王佳影 / Zaying<br>Ph.D. student · Nanjing University<br>Software Institute</p></div>
      <p class="panel-lead">A researcher with a soft spot for little imaginary worlds.</p>
      <div class="panel-copy"><p>I am Wang Jiaying (王佳影), a Ph.D. student at the <a href="https://software.nju.edu.cn/English/index.html" ${external}>Software Institute, Nanjing University</a>, supervised by <a href="https://shishouqian.cn/" ${external}>Shouqian Shi</a>. I am part of the team led by <a href="https://www.shengzhong.info/" ${external}>Dean Sheng Zhong</a>. My research mainly focuses on <strong>AI4Health</strong>.</p><p>Our research group: <a href="https://nju-slab.cn/" ${external}>SLAB · nju-slab.cn</a>.<br>Email: <a href="mailto:wangjiaying@smail.nju.edu.cn">wangjiaying@smail.nju.edu.cn</a>.</p><p>Before that, I studied Cyber Security at King's College London and Network Engineering at the University of Electronic Science and Technology of China. From 2021 to 2023, I worked on EVPN protocol development and testing at Huawei.</p><p>Outside research, I designed the characters and the hand-drawn landscape you see in this universe. Meet 布丁小鼻嘎 — your little companion here.</p></div>
      <div class="tag-row"><span class="tag">AI4Health</span><span class="tag">Cyber Security</span><span class="tag">Handmade worlds</span></div>
      <div class="timeline"><article><small>NOW · NANJING, CHINA</small><h3>Ph.D. · Nanjing University</h3><p>Software Institute · AI4Health</p></article><article><small>2021 — 2023</small><h3>Protocol development · Huawei</h3><p>EVPN & VxLAN development, YANG modeling, and protocol testing.</p></article><article><small>2021</small><h3>M.Sc. · King's College London</h3><p>Cyber Security, with Distinction. Master's thesis advised by Tasmina Islam.</p></article><article><small>2020</small><h3>B.S. · UESTC</h3><p>Network Engineering.</p></article></div>`,
    research: `<p class="panel-kicker">02 / THE RESEARCH LAB</p><h2 id="panel-title">Curiosity, with a purpose.</h2><p class="panel-lead">Exploring artificial intelligence for health.</p><div class="research-card"><span class="research-symbol">✳</span><h3>AI4Health</h3><p>My research mainly focuses on AI4Health, at the Software Institute, Nanjing University.</p></div><div class="panel-copy"><p>My main research interests are time-series modeling, with a focus on medical EEG, and heart-rate estimation using millimeter-wave radar.</p><p>I also study trustworthy AI decision-making for complex physiological and biological signals when labels, observations, or reference databases are incomplete, including settings such as metagenomics.</p><p>Our research group: <a href="https://nju-slab.cn/" ${external}>SLAB · nju-slab.cn</a>. Explore my publications and citations on Google Scholar.</p></div><div class="tag-row"><span class="tag">Artificial intelligence</span><span class="tag">Health</span><span class="tag">Machine learning</span></div><a class="panel-action" href="${scholar}" ${external}>Visit Google Scholar <span>↗</span></a>`,
    creations: `<p class="panel-kicker">03 / THE LITTLE WORKSHOP</p><h2 id="panel-title">A world, made by hand.</h2><p class="panel-lead">布丁小鼻嘎 · My little pudding universe.</p><div class="creation-art"><img src="./assets/world/panorama.png" alt="Jiaying's original drawing of floating rocky islands and nebulae"><span>ORIGINAL ART / SCENE 01</span></div><div class="panel-copy"><p>The floating islands, nebulae, and pudding character in this homepage come from my own game artwork. The little traveler uses the original idle and walking frames.</p><p>This corner is where my sketches become places you can explore. For now, take a stroll, visit a station, or try a tiny zero-gravity jump.</p></div><div class="tag-row"><span class="tag">Original characters</span><span class="tag">Game art</span><span class="tag">World building</span></div><button class="panel-action" data-return-explore>Take Pudding for a walk <span>↗</span></button>`,
    contact: `<p class="panel-kicker">04 / OPEN A CHANNEL</p><h2 id="panel-title">Hello from my orbit.</h2><p class="panel-lead">Research, ideas, or a friendly hello —<br>I'd love to hear from you.</p><div class="contact-links"><a href="mailto:wangjiaying@smail.nju.edu.cn"><span><small>EMAIL</small>wangjiaying@smail.nju.edu.cn</span><span>↗</span></a><a href="${scholar}" ${external}><span><small>RESEARCH</small>Google Scholar</span><span>↗</span></a><a href="https://github.com/zaying" ${external}><span><small>CODE & CREATIONS</small>github.com/zaying</span><span>↗</span></a></div><p class="panel-copy">Thanks for stopping by this little corner of the universe. ✦</p>`,
    help: `<p class="panel-kicker">EXPLORER'S FIELD GUIDE</p><h2 id="panel-title">A tiny adventure.</h2><p class="panel-lead">You can explore at your own pace.</p><dl class="help-list"><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Move Pudding. A / D work too.</dd><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Drift between the floating islands. W / S work too.</dd><dt><kbd>SPACE</kbd></dt><dd>Try a little zero-gravity jump.</dd><dt><kbd>E</kbd></dt><dd>Open the nearest glowing station.</dd><dt>Click / tap</dt><dd>Visit a station directly, or click the open landscape to travel.</dd><dt><kbd>ESC</kbd></dt><dd>Close a panel and return to the universe.</dd><dt>◌ / 中文</dt><dd>Reduce animation or switch languages in the top right.</dd></dl>`,
  },
  zh: {
    about: `<p class="panel-kicker">01 / 观测站</p><h2 id="panel-title">你好，我是佳影。</h2><div class="profile-row"><img src="./images/profile.jpg" alt="王佳影"><p>王佳影 / Wang Jiaying / Zaying<br>南京大学软件学院博士生<br>研究者，也喜欢亲手创造</p></div><p class="panel-lead">做研究，也给小小的幻想世界留一个角落。</p><div class="panel-copy"><p>我是王佳影，目前在<a href="https://software.nju.edu.cn/" ${external}>南京大学软件学院</a>攻读博士，师从<a href="https://shishouqian.cn/" ${external}>石守谦老师</a>，属于<a href="https://www.shengzhong.info/" ${external}>仲盛院长</a>团队。我的研究主要关注 <strong>AI4Health</strong>。</p><p>课题组主页：<a href="https://nju-slab.cn/" ${external}>nju-slab.cn</a>。<br>邮箱：<a href="mailto:wangjiaying@smail.nju.edu.cn">wangjiaying@smail.nju.edu.cn</a>。</p><p>此前，我在伦敦国王学院学习网络安全，在电子科技大学学习网络工程。2021 至 2023 年，我在华为从事 EVPN 协议开发与测试。</p><p>研究之外，我也设计游戏人物、绘制场景。你现在看到的星空与漂浮岛屿，还有陪你漫游的布丁小鼻嘎，都来自我自己的创作。</p></div><div class="tag-row"><span class="tag">AI4Health</span><span class="tag">网络安全</span><span class="tag">手绘小世界</span></div><div class="timeline"><article><small>现在 · 中国南京</small><h3>博士 · 南京大学</h3><p>软件学院 · AI4Health</p></article><article><small>2021 — 2023</small><h3>协议开发 · 华为</h3><p>EVPN 与 VxLAN 开发、YANG 建模和协议测试。</p></article><article><small>2021</small><h3>硕士 · 伦敦国王学院</h3><p>网络安全，Distinction。硕士论文导师为 Tasmina Islam。</p></article><article><small>2020</small><h3>本科 · 电子科技大学</h3><p>网络工程。</p></article></div>`,
    research: `<p class="panel-kicker">02 / 好奇心实验室</p><h2 id="panel-title">让好奇心，有所回应。</h2><p class="panel-lead">探索人工智能与健康的交汇处。</p><div class="research-card"><span class="research-symbol">✳</span><h3>AI4Health</h3><p>我在南京大学软件学院开展研究，主要关注 AI4Health。</p></div><div class="panel-copy"><p>主要深耕时序模型（关注医疗领域 EEG）、毫米波雷达测心率方向。</p><p>同时拓展研究面向复杂生理／生物信号的不完备标签、不完备观测和不完备参考库（比如宏基因组学）下的可信 AI 决策。</p><p>课题组主页：<a href="https://nju-slab.cn/" ${external}>nju-slab.cn</a>。你也可以在 Google Scholar 查看我的论文与引用。</p></div><div class="tag-row"><span class="tag">人工智能</span><span class="tag">健康</span><span class="tag">机器学习</span></div><a class="panel-action" href="${scholar}" ${external}>查看 Google Scholar <span>↗</span></a>`,
    creations: `<p class="panel-kicker">03 / 小小创作间</p><h2 id="panel-title">亲手画一个世界。</h2><p class="panel-lead">布丁小鼻嘎 · 我的小小布丁宇宙。</p><div class="creation-art"><img src="./assets/world/panorama.png" alt="佳影原创的漂浮岛屿与星云全景画"><span>原创手绘 / 场景 01</span></div><div class="panel-copy"><p>这个主页里的漂浮岛屿、星云和布丁角色，都来自我自己设计的游戏素材。小小旅伴使用了原来的呼吸与行走动作帧。</p><p>在这里，画稿变成了可以漫游的地方。带布丁散散步，拜访一个站点，或者试试轻轻的失重跳跃吧。</p></div><div class="tag-row"><span class="tag">原创角色</span><span class="tag">游戏美术</span><span class="tag">世界搭建</span></div><button class="panel-action" data-return-explore>带布丁散散步 <span>↗</span></button>`,
    contact: `<p class="panel-kicker">04 / 建立通信</p><h2 id="panel-title">来自小宇宙的问候。</h2><p class="panel-lead">交流研究、聊聊创意，<br>或者只是打个招呼，都很欢迎。</p><div class="contact-links"><a href="mailto:wangjiaying@smail.nju.edu.cn"><span><small>邮箱</small>wangjiaying@smail.nju.edu.cn</span><span>↗</span></a><a href="${scholar}" ${external}><span><small>研究</small>Google Scholar</span><span>↗</span></a><a href="https://github.com/zaying" ${external}><span><small>代码与创作</small>github.com/zaying</span><span>↗</span></a></div><p class="panel-copy">谢谢你来到这个小小的宇宙角落。✦</p>`,
    help: `<p class="panel-kicker">小小漫游指南</p><h2 id="panel-title">一起去冒险吧。</h2><p class="panel-lead">按照自己的节奏，慢慢探索。</p><dl class="help-list"><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>移动布丁，也可以使用 A / D。</dd><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>在漂浮岛屿之间漫游，也可以使用 W / S。</dd><dt><kbd>SPACE</kbd></dt><dd>试试轻轻的失重跳跃。</dd><dt><kbd>E</kbd></dt><dd>靠近发光站点时，打开对应内容。</dd><dt>点击 / 轻触</dt><dd>直接访问站点，或点击场景让布丁走过去。</dd><dt><kbd>ESC</kbd></dt><dd>关闭面板，回到小宇宙。</dd><dt>◌ / EN</dt><dd>右上角可以减少动画，或者切换语言。</dd></dl>`,
  },
};

function setLanguage(next) {
  language = next;
  saveSetting('zaying-language', next);
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  $$('[data-i18n]').forEach((element) => { element.innerHTML = translations[next][element.dataset.i18n]; });
  $('#language-toggle').textContent = next === 'en' ? '中文' : 'EN';
  $('#language-toggle').setAttribute('aria-label', next === 'en' ? '切换为中文' : 'Switch to English');
  $('#world').setAttribute('aria-label', next === 'en' ? 'Interactive universe' : '可交互的小宇宙');
  $('#close-panel').setAttribute('aria-label', next === 'en' ? 'Close panel' : '关闭面板');
  $('#motion-toggle').setAttribute('aria-label', translations[next][reduced ? 'animate' : 'reduce']);
  $('#reset-view').setAttribute('aria-label', next === 'zh' ? '恢复背景视角' : 'Reset background view');
  $('#reset-view').title = next === 'zh' ? '恢复视角 · 也可双击空白场景' : 'Reset view · or double-click the landscape';
  const moveLabels = next === 'zh' ? { left: '向左移动', right: '向右移动', up: '向上移动', down: '向下移动' } : { left: 'Move left', right: 'Move right', up: 'Move forward', down: 'Move backward' };
  $$('[data-move]').forEach((button) => button.setAttribute('aria-label', moveLabels[button.dataset.move]));
  $$('[data-touch-action]').forEach((button) => button.setAttribute('aria-label', translations[next][{ jump: 'actionJump', crouch: 'actionCrouch', attack: 'actionAttack', attack2: 'actionAttack2' }[button.dataset.touchAction]]));
  if (activePanel) renderPanel(activePanel);
  universe?.setLanguage(next);
  entranceScene?.setLanguage(next);
}
function setMotion(next) {
  reduced = next;
  document.body.classList.toggle('reduced-motion', next);
  document.body.classList.toggle('motion-enabled', !next);
  $('#motion-toggle').setAttribute('aria-pressed', String(next));
  $('#motion-toggle').setAttribute('aria-label', translations[language][next ? 'animate' : 'reduce']);
  saveSetting('zaying-motion', String(next));
  universe?.setReduced(next);
  entranceScene?.setReduced(next);
  sceneView?.setReduced(next);
}
function renderPanel(name) {
  $('#panel-content').innerHTML = content[language][name].replaceAll('<span>↗</span>', uiIcon('arrow-up-right')).replaceAll('<span class="research-symbol">✳</span>', `<span class="research-symbol">${uiIcon('spark')}</span>`);
  $('#panel-coordinate').textContent = `TRANSMISSION / ${({ about: '01', research: '02', creations: '03', contact: '04', npc: '05', help: '00' })[name]}`;
  panel.scrollTop = 0;
}
function openPanel(name, updateHash = true) {
  if (!content[language][name]) return;
  if (screen === 'entrance') enterWorld(false);
  if (!panel.open) previousFocus = document.activeElement;
  activePanel = name;
  universe?.pause(true);
  sceneView?.pause(true);
  renderPanel(name);
  if (!panel.open) panel.showModal();
  $('#close-panel').focus({ preventScroll: true });
  if (updateHash) history.pushState(null, '', `#${name}`);
}
function closePanel(updateHash = true) {
  if (panel.open) panel.close();
  activePanel = null;
  universe?.pause(false);
  sceneView?.pause(screen !== 'world');
  if (updateHash) history.replaceState(null, '', `${location.pathname}${location.search}#world`);
  previousFocus?.focus({ preventScroll: true });
}
document.addEventListener('click', (event) => {
  const station = event.target.closest('[data-open]');
  if (station) openPanel(station.dataset.open);
  if (event.target.closest('[data-return-explore]')) { closePanel(); startExplore(); }
});
$('#language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en'));
$('#motion-toggle').addEventListener('click', () => setMotion(!reduced));
$('#reset-view').addEventListener('click', () => sceneView?.reset());
$('#close-panel').addEventListener('click', () => closePanel());
$('#back-world').addEventListener('click', () => closePanel());
$('#help-button').addEventListener('click', () => openPanel('help'));
panel.addEventListener('cancel', (event) => { event.preventDefault(); closePanel(); });
panel.addEventListener('click', (event) => { const box = panel.getBoundingClientRect(); if (event.target === panel && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) closePanel(); });


Object.assign(translations.en, { worldHintMobile: 'Tap the scene to walk · hold arrows to move', entryExplore: 'Explore my world', entrySubtitle: 'Discover my research & little creations', entryHint: 'Drag to orbit · pinch or scroll to zoom', explore: 'Explore my research', worldHint: 'Click a glowing station · WASD to wander · J / K to attack', controls: 'move · jump · explore', npcWaiting: 'Stoneheart · keep your distance', npcNearby: 'Stoneheart · crystal shards incoming', npcCharging: 'Stoneheart · charging crystals', npcFading: 'Stoneheart · fading away', npcDefeated: 'Stoneheart · returning in {seconds}s', npcReviving: 'Stoneheart · returning', victoryHint: 'Stoneheart is taking a little break.', sceneError: 'The 3D entrance could not load. You can still enter the illustrated world below.' });
Object.assign(translations.zh, { worldHintMobile: '轻触场景漫游 · 按住方向键移动', entryExplore: '探索我的小世界', entrySubtitle: '看看我的研究与小小创作', entryHint: '拖动旋转 · 双指或滚轮缩放', explore: '探索我的研究', worldHint: '点击发光站点 · WASD 漫游 · J / K 攻击', controls: '移动 · 跳跃 · 探索', npcWaiting: '石心人 · 请保持距离', npcNearby: '石心人 · 晶石碎片来袭', npcCharging: '石心人 · 晶石蓄力中', npcFading: '石心人 · 渐渐消散', npcDefeated: '石心人 · {seconds} 秒后复活', npcReviving: '石心人 · 晶石重聚中', victoryHint: '石心人暂时休息，星云安静了一会儿。', sceneError: '3D 入口暂时无法加载，仍可点击下方按钮进入原画小世界。' });
content.en.npc = `<p class="panel-kicker">05 / THE ANTAGONIST</p><h2 id="panel-title">Meet Stoneheart.</h2><p class="panel-lead">A crystal guard in the nebula.</p><div class="panel-copy"><p>Approach Stoneheart and it automatically winds up, then fires a fan of crystal shards. Only a shard that hits Pudding causes damage. Jump, crouch, or step aside to dodge; retreating stops new attacks.</p><p>J / K attack, C toggles crouching and standing, SPACE jumps. Pudding automatically starts reviving 5 seconds after death; press R to revive sooner. Stoneheart fades away when defeated, stays invisible for 5 seconds, then reappears with full health. It resumes guarding once fully visible.</p></div>`;
content.zh.npc = `<p class="panel-kicker">05 / 反派登场</p><h2 id="panel-title">石心人来了。</h2><p class="panel-lead">守在星云里的晶石反派。</p><div class="panel-copy"><p>靠近石心人时，它会自动蓄力并射出一簇晶石碎片。只有碎片命中小鼻嘎才会扣血、播放被攻击动作。跳跃、蹲下或移动躲避，退远后它会停止发射。</p><p>J / K 攻击，C 切换蹲下和起身，空格跳跃。小鼻嘎死亡 5 秒后自动开始复活，也可以按 R 提前复活。石心人被击败后逐渐变淡、完全消失，等待 5 秒后渐显并恢复满血；完全出现后才恢复警戒。</p></div>`;
content.en.help = `<p class="panel-kicker">EXPLORER'S FIELD GUIDE</p><h2 id="panel-title">A tiny adventure.</h2><dl class="help-list"><dt>The entrance</dt><dd>Rotate and zoom the 3D cosmos. Explore my world enters this illustrated research world. The zaying logo returns to the entrance.</dd><dt><kbd>WASD</kbd> / arrows</dt><dd>Move Pudding. Left movement mirrors the original right-facing artwork.</dd><dt><kbd>SHIFT</kbd></dt><dd>Hold while moving to run.</dd><dt><kbd>SPACE</kbd> / <kbd>C</kbd></dt><dd>Jump and land / toggle crouching, including crouch walking.</dd><dt><kbd>J</kbd> / <kbd>K</kbd></dt><dd>Close attack / ranged attack in the direction Pudding faces.</dd><dt>Stoneheart</dt><dd>Approaching triggers crystal shots automatically. Hit and death animations are triggered by shard collisions.</dd><dt><kbd>R</kbd></dt><dd>Revival starts automatically 5 seconds after death, or press R to start sooner. Reversed death frames and a teleport beam return Pudding to safety with full health.</dd><dt><kbd>E</kbd> / click</dt><dd>Visit the nearest glowing station, or click a station directly. Click the landscape to walk there.</dd></dl>`;
content.zh.help = `<p class="panel-kicker">小小漫游指南</p><h2 id="panel-title">一起去冒险吧。</h2><dl class="help-list"><dt>3D 入口</dt><dd>旋转、缩放小宇宙，点击 Explore 进入原画研究界面。点击 zaying 标志回到入口。</dd><dt><kbd>WASD</kbd> / 方向键</dt><dd>移动小鼻嘎，左走使用右走原画的镜像。</dd><dt><kbd>SHIFT</kbd></dt><dd>移动时按住加速跑。</dd><dt><kbd>SPACE</kbd> / <kbd>C</kbd></dt><dd>跳跃并降落 / 切换蹲姿，也可以蹲着走。</dd><dt><kbd>J</kbd> / <kbd>K</kbd></dt><dd>向角色朝向进行近身 / 远程攻击。</dd><dt>石心人</dt><dd>靠近后自动射出晶石，命中才触发被攻击、扣血与死亡。</dd><dt><kbd>R</kbd></dt><dd>死亡 5 秒后自动开始复活，也可按 R 提前开始。死亡帧倒序配合传送光束，恢复满血并回到安全位置。</dd><dt><kbd>E</kbd> / 点击</dt><dd>进入附近发光站点；也可直接点击站点。点击空白场景让小鼻嘎走过去。</dd></dl>`;
content.en.creations = content.en.creations.replace('idle and walking frames', 'idle, walk, run, jump, landing, crouch, attack, hit, and death frames');
content.zh.creations = content.zh.creations.replace('原来的呼吸与行走动作帧', '原来的呼吸、行走、跑、跳、降落、蹲、攻击、被攻击和死亡动作帧');

function enterWorld(updateHash = true) {
  screen = 'world'; document.body.dataset.screen = screen;
  $('#entrance').hidden = true; $('#main').hidden = false; $('.footer').hidden = false; $('#cosmos').hidden = false; $('.top-nav').hidden = false;
  entranceScene?.pause(true); universe?.pause(panel.open); window.scrollTo(0, 0);
  $('#reset-view').hidden = false; sceneView?.pause(panel.open);
  ensureWorld();
  if (updateHash) history.pushState(null, '', '#world');
  $('#explore').focus({ preventScroll: true });
}
function returnToEntrance(updateHash = true) {
  closePanel(false); screen = 'entrance'; document.body.dataset.screen = screen;
  $('#entrance').hidden = false; $('#main').hidden = true; $('.footer').hidden = true; $('#cosmos').hidden = true; $('.top-nav').hidden = true;
  universe?.pause(true); entranceScene?.pause(false); window.scrollTo(0, 0);
  $('#reset-view').hidden = true; sceneView?.reset(); sceneView?.pause(true);
  ensureEntrance();
  if (updateHash) history.pushState(null, '', location.pathname + location.search);
  $('#enter-world').focus({ preventScroll: true });
}
function syncRoute() { const name = location.hash.slice(1); if (content[language][name]) openPanel(name, false); else if (name === 'world') { enterWorld(false); closePanel(false); } else if (!name) returnToEntrance(false); }
window.addEventListener('hashchange', syncRoute); window.addEventListener('popstate', syncRoute);
$('.wordmark').addEventListener('click', (event) => { event.preventDefault(); returnToEntrance(); });
function startExplore() { enterWorld(); if (innerWidth <= 760) world.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center' }); }
$('#enter-world').addEventListener('click', () => enterWorld());
$('#explore').addEventListener('click', () => openPanel('research'));
$$('[data-action]').forEach((button) => button.addEventListener('click', () => universe?.action(button.dataset.action, true)));
$$('[data-touch-action]').forEach((button) => button.addEventListener('click', () => universe?.action(button.dataset.touchAction)));
$$('[data-camera]').forEach((button) => button.addEventListener('click', () => {
  const name = button.dataset.camera;
  if (name === 'left' || name === 'right') entranceScene?.rotate(name === 'left' ? -.35 : .35);
  if (name === 'in' || name === 'out') entranceScene?.zoom(name === 'in' ? .83 : 1.2);
  if (name === 'reset') entranceScene?.view('orbit');
}));
$$('[data-move]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); universe?.move(button.dataset.move, true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => button.addEventListener(name, () => universe?.move(button.dataset.move, false)));
});
$('[data-interact]')?.addEventListener('click', () => universe?.interact());
$('#open-actor-inspector').addEventListener('click', () => { $('#actor-inspector').hidden = !$('#actor-inspector').hidden; });
$('#close-inspector').addEventListener('click', () => { $('#actor-inspector').hidden = true; });
$('#retry-scene').addEventListener('click', () => location.reload());

function updateHUD(state) {
  const key = `action${state.group === 'land' ? 'Land' : state.action[0].toUpperCase() + state.action.slice(1)}`;
  const status = $('#action-status');
  const text = translations[language][key]; if (status.textContent !== text) status.textContent = text;
  status.dataset.action = state.action; status.dataset.group = state.group; status.dataset.frame = String(state.frame);
  status.dataset.reviveIn = String(Math.ceil(state.reviveIn));
  status.dataset.position = state.position.map((value) => value.toFixed(2)).join(','); status.dataset.source = state.frameSource; status.dataset.facing = String(state.facing);
  if ($('#player-health').dataset.hp !== String(state.hp)) $('#player-health').innerHTML = Array.from({ length: 3 }, (_, i) => uiIcon('heart', `health-heart${i < state.hp ? '' : ' empty'}`)).join('');
  $('#player-health').setAttribute('aria-label', language === 'zh' ? `小鼻嘎生命值 ${state.hp} / 3` : `Pudding health ${state.hp} of 3`);
  $('#player-health').dataset.hp = String(state.hp);
  const npcKey = state.npcLife === 'fading' ? 'npcFading' : state.npcLife === 'waiting' ? 'npcDefeated' : state.npcLife === 'reviving' ? 'npcReviving' : state.npcPhase === 'charge' ? 'npcCharging' : state.nearby ? 'npcNearby' : 'npcWaiting';
  const npcText = translations[language][npcKey].replace('{seconds}', Math.ceil(state.npcReviveIn));
  if ($('#npc-health').textContent !== npcText) $('#npc-health').textContent = npcText;
  $('#npc-health').dataset.hp = String(state.npcHP); $('#npc-health').dataset.phase = state.npcPhase; $('.npc-hud').dataset.phase = state.npcPhase;
  $('#npc-health').dataset.life = state.npcLife; $('#npc-health').dataset.opacity = state.npcOpacity.toFixed(2); $('#npc-health').dataset.reviveIn = String(Math.ceil(state.npcReviveIn));
  $$('[data-action]').forEach((button) => { button.setAttribute('aria-pressed', String(button.dataset.action === state.action)); button.disabled = ['stand', 'revive'].includes(state.action) || (state.dead ? button.dataset.action !== 'revive' : button.dataset.action === 'revive'); });
  const hintText = state.action === 'revive' ? translations[language].revivingHint : state.dead ? translations[language].deadHint.replace('{seconds}', Math.ceil(state.reviveIn)) : state.npcHP === 0 ? translations[language].victoryHint : translations[language][innerWidth <= 760 ? 'worldHintMobile' : 'worldHint'];
  if (hint.textContent !== hintText) hint.textContent = hintText;
}

const mobileLayout = matchMedia('(max-width: 760px)');
function syncMovesLayout() { const open = !mobileLayout.matches; $('.action-dock').classList.toggle('moves-open', open); $('#toggle-actions').setAttribute('aria-expanded', String(open)); }
mobileLayout.addEventListener('change', syncMovesLayout); syncMovesLayout();
$('#toggle-actions').addEventListener('click', () => { if (!mobileLayout.matches) return; const open = $('.action-dock').classList.toggle('moves-open'); $('#toggle-actions').setAttribute('aria-expanded', String(open)); });
function ensureWorld() {
  if (worldPromise) return worldPromise;
  const status = $('#world-loading'); status.hidden = false; $('#retry-world').hidden = true;
  $('#world-loading-text').textContent = language === 'zh' ? '正在唤醒小鼻嘎和石心人…' : 'Waking Pudding and Stoneheart…';
  const panorama = $('.mobile-panorama');
  if (!panorama.getAttribute('src')) {
    panorama.addEventListener('error', () => { if (!panorama.src.endsWith('panorama.png')) panorama.src = './assets/world/panorama.png'; });
    panorama.src = panorama.dataset.src;
  }
  import('./scene-view.js?v=fast-20260928').then(({ createSceneView }) => {
    if (!sceneView) sceneView = createSceneView({ element: $('#cosmos'), sceneElement: $('.adventure-stage'), canvas: $('#adventure-canvas'), reduced });
    sceneView.pause(screen !== 'world' || panel.open);
  }).catch(console.error);
  worldPromise = import('./adventure-scene.js?v=fast-20260928').then(({ createAdventure }) => createAdventure({ canvas: $('#adventure-canvas'), language, onOpen: openPanel, onUpdate: updateHUD, onFocus: (x, y) => sceneView?.focus(x, y) })).then((result) => {
    universe = result; universe.setLanguage(language); universe.pause(screen !== 'world' || panel.open); status.hidden = true;
  }).catch((error) => {
    console.error(error); worldPromise = null; $('#retry-world').hidden = false;
    $('#world-loading-text').textContent = language === 'zh' ? '角色素材未加载成功，请点击重试。' : 'Artwork could not load. Tap to retry.';
  });
  return worldPromise;
}
$('#retry-world').addEventListener('click', ensureWorld);
function ensureEntrance() {
  if (entrancePromise) return entrancePromise;
  entrancePromise = import('./planet-scene.js?v=fast-20260928').then(({ createUniverse }) => createUniverse({
  mount: $('#scene-host'), language, reduced, introOnly: true,
  onProgress(progress) { $('#scene-loading span:last-child').textContent = `${translations[language].loading} ${Math.round(progress * 100)}%`; },
})).then((result) => {
  entranceScene = result; entranceScene.setLanguage(language); entranceScene.setReduced(reduced); entranceScene.pause(screen !== 'entrance');
  $('#scene-loading').hidden = true; $('#scene-host').dataset.ready = 'true';
}).catch((error) => { console.error(error); $('#scene-loading').hidden = true; $('#scene-error').hidden = false; $('#scene-host').dataset.ready = 'error'; });
  return entrancePromise;
}
setMotion(reduced); setLanguage(language);
// A direct #world link does not download or initialize the hidden 3D entrance.
if (location.hash) syncRoute(); else returnToEntrance(false);
