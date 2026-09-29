const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function intersects(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

// Prefer the space above a character, then the closest clear space beside it.
// A decorative message is omitted when there is no readable place for it.
export function placeFloating({ anchor, size, bounds, obstacles = [], gap = 10, maxDistance = 180 }) {
  const { width, height } = size;
  if (width > bounds.width || height > bounds.height) return null;
  const preferred = { x: anchor.x + anchor.width / 2 - width / 2, y: anchor.y - height - gap };
  const xs = [preferred.x, anchor.x - width - gap, anchor.x + anchor.width + gap];
  const ys = [preferred.y, anchor.y + anchor.height + gap, anchor.y + anchor.height / 2 - height / 2];
  for (const rect of obstacles) {
    xs.push(rect.x - width - gap, rect.x + rect.width + gap);
    ys.push(rect.y - height - gap, rect.y + rect.height + gap);
  }
  let best = null, score = Infinity;
  for (const x of xs) for (const y of ys) {
    const candidate = { x: clamp(x, bounds.x, bounds.x + bounds.width - width), y: clamp(y, bounds.y, bounds.y + bounds.height - height), width, height };
    const distance = Math.hypot(candidate.x - preferred.x, candidate.y - preferred.y);
    if (distance > maxDistance || intersects(candidate, anchor, gap) || obstacles.some((rect) => intersects(candidate, rect, gap))) continue;
    if (distance < score) { score = distance; best = candidate; }
  }
  return best;
}
