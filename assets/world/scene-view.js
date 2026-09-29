const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class SceneView {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1.035; this.focusX = .5; this.focusY = .5; this.pointerX = 0; this.pointerY = 0; this.focused = false; this.reduced = false; }
  point(x, y) { this.pointerX = clamp(x, 0, 1) * 2 - 1; this.pointerY = clamp(y, 0, 1) * 2 - 1; }
  focus(x, y) { if (this.reduced) return; this.focusX = clamp(x, 0, 1); this.focusY = clamp(y, 0, 1); this.focused = true; }
  reset() { this.focused = false; this.focusX = this.focusY = .5; this.pointerX = this.pointerY = 0; }
  setReduced(value) { this.reduced = value; if (value) { this.reset(); this.x = this.y = 0; this.zoom = 1.035; } }
  update(dt, { width, height, mobile = false, time = 0 }) {
    if (this.reduced) return { x: 0, y: 0, zoom: 1.035 };
    const zoom = this.focused ? mobile ? 1.10 : 1.18 : 1.035;
    const depth = mobile ? 5 : 15;
    const x = (this.focused ? (.5 - this.focusX) * width * (zoom - 1) * .8 : 0) - this.pointerX * depth + Math.sin(time * .11) * 2;
    const y = (this.focused ? (.5 - this.focusY) * height * (zoom - 1) * .8 : 0) - this.pointerY * depth * .65 + Math.sin(time * .14) * 1.5;
    const ease = 1 - Math.exp(-Math.max(0, dt) * 3.8);
    this.x += (x - this.x) * ease; this.y += (y - this.y) * ease; this.zoom += (zoom - this.zoom) * ease;
    return { x: this.x, y: this.y, zoom: this.zoom };
  }
}

export function createSceneView({ element, sceneElement, planetElement, canvas, reduced = false }) {
  const view = new SceneView(); view.setReduced(reduced);
  let paused = true, last = 0, elapsed = 0;
  const paint = (state) => {
    for (const layer of [element, sceneElement, planetElement].filter(Boolean)) {
      layer.style.setProperty('--view-x', `${state.x.toFixed(2)}px`);
      layer.style.setProperty('--view-y', `${state.y.toFixed(2)}px`);
      layer.style.setProperty('--view-zoom', state.zoom.toFixed(4));
    }
    element.dataset.zoom = state.zoom.toFixed(3); element.dataset.focused = String(view.focused);
  };
  window.addEventListener('pointermove', (event) => {
    if (paused || view.reduced || event.pointerType !== 'mouse') return;
    view.point(event.clientX / innerWidth, event.clientY / innerHeight);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => view.point(.5, .5));
  canvas.addEventListener('dblclick', () => view.reset());
  function render(time) {
    requestAnimationFrame(render);
    const dt = Math.min((time - last) / 1000 || .016, .05); last = time;
    if (paused || document.hidden || view.reduced) return;
    elapsed += dt;
    const mobile = matchMedia('(max-width:760px)').matches;
    paint(view.update(dt, { width: mobile ? canvas.clientWidth : innerWidth, height: mobile ? canvas.clientHeight : innerHeight, mobile, time: elapsed }));
  }
  paint({ x: 0, y: 0, zoom: view.zoom }); requestAnimationFrame(render);
  return { focus: (x, y) => view.focus(x, y), reset: () => view.reset(), pause: (value) => { paused = value; }, setReduced(value) { view.setReduced(value); if (value) paint({ x: 0, y: 0, zoom: 1.035 }); } };
}
