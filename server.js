// AeroFlux Pro — serveur local + multijoueur LAN. Zéro dépendance : `node server.js`
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const FLIGHTS = path.join(DATA, 'flights.json');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const players = new Map(); // id -> state
const chat = [];

function body(req) {
  return new Promise((res) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { res(JSON.parse(d || '{}')); } catch { res({}); } }); });
}
function json(res, obj, code = 200) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readFlights() { try { return JSON.parse(fs.readFileSync(FLIGHTS, 'utf8')); } catch { return []; } }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/api/mp' && req.method === 'POST') {
    const b = await body(req);
    const now = Date.now();
    if (b.id) players.set(b.id, { ...b, t: now });
    if (b.msg) { chat.push({ from: b.name, msg: String(b.msg).slice(0, 120), t: now }); if (chat.length > 30) chat.shift(); }
    for (const [k, v] of players) if (now - v.t > 5000) players.delete(k);
    return json(res, { players: [...players.values()].filter((x) => x.id !== b.id), chat: chat.filter((c) => c.t > (b.since || 0)), now });
  }
  if (p === '/api/flights') {
    if (req.method === 'POST') { const b = await body(req); const all = readFlights(); all.push({ ...b, at: new Date().toISOString() }); fs.writeFileSync(FLIGHTS, JSON.stringify(all.slice(-500), null, 1)); return json(res, { ok: true }); }
    return json(res, readFlights());
  }
  const f = path.normalize(path.join(PUB, p === '/' ? 'index.html' : p));
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ✈  AeroFlux Pro lancé`);
  console.log(`  Local : http://localhost:${PORT}`);
  for (const ni of Object.values(os.networkInterfaces()).flat()) if (ni && ni.family === 'IPv4' && !ni.internal) console.log(`  LAN   : http://${ni.address}:${PORT}   (à partager aux autres joueurs)`);
});
