import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const config = await readFile('_config.yml', 'utf8');
const excluded = config.match(/exclude:\s*\n([\s\S]*?)keep_files:/)[1];
for (const name of ['_pages', '_posts', '_publications', '_talks', '_teaching', '_portfolio', 'talkmap']) assert.ok(excluded.includes(`  - ${name}\n`) || excluded.includes(`  - ${name}\r\n`), name);
assert.ok(!config.match(/include:\s*\n([\s\S]*?)exclude:/)[1].includes('_pages'));
const homepage = await readFile('index.html', 'utf8');
assert.ok(!/href=["'](?:\.\/|\/)(?:about|cv|publications|portfolio|talks|teaching)(?:\/|\.html)/.test(homepage));
const routes = new Map();
for (const filename of await readdir('redirects')) {
  const source = await readFile(`redirects/${filename}`, 'utf8');
  const target = source.match(/^redirect_to:\s*(\S+)/m)[1];
  assert.ok(/^\/#(?:world|about|research|creations)$/.test(target));
  assert.ok(/^layout: null$/m.test(source)); assert.ok(/^sitemap: false$/m.test(source));
  const paths = [source.match(/^permalink:\s*(\S+)/m)[1], ...[...source.matchAll(/^  - (\S+)/gm)].map((m) => m[1])];
  for (const route of paths) { assert.ok(!routes.has(route), route); routes.set(route, target); }
}
for (const [route, target] of routes) {
  const response = await fetch(`http://localhost:3000${route}`, { redirect: 'manual' });
  assert.equal(response.status, 302, route); assert.equal(response.headers.get('location'), target, route);
}
const fallback = await fetch('http://localhost:3000/no-such-old-page/');
assert.equal(fallback.status, 404); assert.ok((await fallback.text()).includes("location.replace('/#world')"));
console.log(`Passed: legacy sources excluded, no old-page homepage links, ${routes.size} old addresses redirect to new panels, and custom 404 returns to the new world.`);
