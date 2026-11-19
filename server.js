// Serves the game (index.html, netshim.js) and relays up to 4 players per room over WebSocket (/ws).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000, PUB = __dirname;
const FILES = new Set(['/index.html', '/netshim.js']); // only these are ever served
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/healthz') return res.end('ok');
  if (p === '/') p = '/index.html';
  if (!FILES.has(p)) { res.writeHead(404); return res.end('not found'); }
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
const rooms = new Map(); // name -> Map(peerId -> {ws, presence})
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const rid = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

wss.on('connection', ws => {
  const id = rid(); let name = null, room = null;
  ws.alive = true; ws.win = 0; ws.cnt = 0; ws.on('pong', () => (ws.alive = true));
  const others = () => [...room].filter(([k]) => k !== id).map(([, v]) => v.ws);

  ws.on('message', (raw, isBinary) => {
    if (isBinary) { // voice chunk: forward to the others in the room, prefixed with the sender id (8 bytes)
      if (!room || raw.length > 8192) return;
      const t = Date.now(); if (t - ws.win > 1000) { ws.win = t; ws.cnt = 0; } if (++ws.cnt > 80) return;
      const pkt = Buffer.concat([Buffer.from(id, 'latin1'), raw]);
      others().forEach(w => { if (w.readyState === 1) w.send(pkt, { binary: true }); });
      return;
    }
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'join' && !room) {
      const n = String(m.room || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      if (!n) return;
      let r = rooms.get(n); if (!r) rooms.set(n, (r = new Map()));
      if (r.size >= 4) return send(ws, { t: 'full' });
      name = n; room = r; room.set(id, { ws, presence: {} });
      send(ws, { t: 'welcome', me: id, peers: [...r].filter(([k]) => k !== id).map(([k, v]) => ({ peer: k, presence: v.presence })) });
    } else if (!room) return;
    else if (m.t === 'pres' && m.patch && typeof m.patch === 'object') {
      const me = room.get(id);
      for (const k of Object.keys(m.patch).slice(0, 40)) {
        if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k)) continue;
        if (m.patch[k] === null) delete me.presence[k]; else me.presence[k] = m.patch[k];
      }
      if (JSON.stringify(me.presence).length > 4096) { me.presence = {}; return; }
      others().forEach(w => send(w, { t: 'pres', peer: id, presence: me.presence }));
    } else if (m.t === 'ev' && /^[a-z][a-z0-9_.-]{0,47}$/.test(m.topic || '')) {
      if (JSON.stringify(m.data ?? null).length > 4096) return;
      [...room.values()].forEach(v => send(v.ws, { t: 'ev', peer: id, topic: m.topic, data: m.data }));
    }
  });

  ws.on('close', () => {
    if (!room) return;
    room.delete(id);
    room.forEach(v => send(v.ws, { t: 'left', peer: id }));
    if (!room.size) rooms.delete(name);
  });
});

setInterval(() => wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); }), 30000);
server.listen(PORT, () => console.log('Backrooms server on :' + PORT));
module.exports = server;
