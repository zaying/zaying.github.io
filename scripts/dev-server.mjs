import http from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 3000);
const clients = new Set();
const legacyRoutes = new Map();
for (const name of await readdir(path.join(root, 'redirects'))) {
  const source = await readFile(path.join(root, 'redirects', name), 'utf8');
  const target = source.match(/^redirect_to:\s*(\S+)/m)?.[1];
  const permalink = source.match(/^permalink:\s*(\S+)/m)?.[1];
  if (target && permalink) { legacyRoutes.set(permalink, target); for (const alias of source.matchAll(/^  - (\S+)/gm)) legacyRoutes.set(alias[1], target); }
}
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.pdf':'application/pdf' };
const liveReload = `<script>const previewEvents=new EventSource('/__reload');previewEvents.onmessage=()=>location.reload();</script>`;
const server = http.createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400); response.end('Invalid URL'); return; }
  if (pathname === '/__reload') {
    response.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', Connection:'keep-alive' });
    response.write(': connected\n\n'); clients.add(response); request.on('close', () => clients.delete(response)); return;
  }
  const legacyTarget = legacyRoutes.get(pathname) || legacyRoutes.get(`${pathname}/`);
  if (legacyTarget) { response.writeHead(302, { Location: legacyTarget }); response.end(); return; }
  const parts = pathname.split('/');
  if (parts.some((part) => part.startsWith('.') || part.startsWith('_')) || /^\/(scripts|redirects|local|talkmap)\//.test(pathname) || /\.(md|ya?ml|toml|mjs)$/i.test(pathname)) { response.writeHead(404); response.end('Not found'); return; }
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relative = path.relative(root, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403); response.end('Forbidden'); return; }
  if (relative.split(/[\\/]/).some((part) => part.startsWith('.') || part.startsWith('_'))) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const entry = await stat(filename);
    if (!entry.isFile()) throw new Error('Not a file');
    let data = await readFile(filename);
    if (path.extname(filename) === '.html') data = Buffer.from(data.toString('utf8').replace('</body>', `${liveReload}</body>`));
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(data);
  } catch { response.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }); response.end(await readFile(path.join(root, '404.html'))); }
});

async function fingerprint(directory) {
  const entries = await readdir(directory, { withFileTypes:true });
  const stamps = await Promise.all(entries.filter((entry) => !entry.name.startsWith('.') && !['node_modules','_site','vendor','local'].includes(entry.name)).map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return fingerprint(filename);
    const info = await stat(filename); return `${filename}:${info.mtimeMs}:${info.size}`;
  }));
  return stamps.join('|');
}
let previous = await fingerprint(root); let checking = false;
const watch = setInterval(async () => {
  if (checking) return; checking = true;
  try { const current = await fingerprint(root); if (current !== previous) { previous = current; for (const client of clients) client.write('data: reload\n\n'); } } catch {} finally { checking = false; }
}, 700);
const heartbeat = setInterval(() => { for (const client of clients) client.write(': keep-alive\n\n'); }, 15000);
server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Try: npm run dev -- --port 3001` : error.message); clearInterval(watch); clearInterval(heartbeat); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`\nZaying's universe is ready: http://localhost:${port}\nSave a file to refresh automatically. Ctrl+C to stop.\nLegacy addresses return to the new homepage panels.\n`));
function stop() { clearInterval(watch); clearInterval(heartbeat); for (const client of clients) client.end(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
