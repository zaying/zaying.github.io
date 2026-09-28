// Share decoded, cropped images between the entrance and illustrated world.
const images = new Map();
const pending = new Map();
let manifestPromise;

export function loadManifest() {
  if (!manifestPromise) manifestPromise = fetch('./assets/world/actors/manifest.json?v=fast-20260928')
    .then((response) => { if (!response.ok) throw new Error('Artwork manifest could not load.'); return response.json(); })
    .catch((error) => { manifestPromise = null; throw error; });
  return manifestPromise;
}

export function loadImage(src) {
  // onload works on older mobile browsers that lack Image.decode/createImageBitmap.
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Artwork could not load: ${src}`));
    image.src = src;
  });
}

export function loadFrame(frame) {
  if (images.has(frame.src)) return Promise.resolve(images.get(frame.src));
  if (pending.has(frame.src)) return pending.get(frame.src);
  const promise = (async () => {
    let image;
    if (frame.renderSrc) {
      try { image = await loadImage(frame.renderSrc); } catch { /* Original PNG fallback below. */ }
    }
    if (!image) {
      const original = await loadImage(frame.src), [x, y, w, h] = frame.crop;
      const ratio = Math.min(1, 560 / h, 1152 / w);
      image = document.createElement('canvas'); image.width = Math.ceil(w * ratio); image.height = Math.ceil(h * ratio);
      image.getContext('2d').drawImage(original, x, y, w, h, 0, 0, image.width, image.height);
    }
    images.set(frame.src, image); return image;
  })().finally(() => pending.delete(frame.src));
  pending.set(frame.src, promise); return promise;
}

export function firstFrames(groups) { return [groups.idle[0], groups.npcIdle[0]]; }

export async function loadFrames(frames, onFrame, onError = console.warn) {
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < frames.length) {
      const frame = frames[next++];
      try { onFrame(frame, await loadFrame(frame)); } catch (error) { onError(error); }
    }
  }));
}

// Never let an unavailable later frame erase an already visible character.
export function availableFrame(frame, groups, ready) {
  if (ready.has(frame.src)) return frame;
  const groupName = frame.group || Object.keys(groups).find((name) => groups[name].some((candidate) => candidate.src === frame.src));
  const group = groups[groupName] || [];
  return group.find((candidate) => ready.has(candidate.src))
    || (groupName === 'npcIdle' ? groups.npcIdle[0] : groups.idle[0]);
}
