// Spins up the server and simulates players through the real client shim.
const assert = require('assert'), fs = require('fs');
process.env.PORT = 3999; const server = require('./server');
const shim = fs.readFileSync('./netshim.js', 'utf8');
const mk = () => { const w = { location: { protocol: 'http:', host: 'localhost:3999' } }; new Function('window', 'location', 'WebSocket', shim)(w, w.location, WebSocket); return w.claude.use('room'); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(300);
  const html = await (await fetch('http://localhost:3999/')).text();
  assert(html.includes('netshim.js') && html.includes('Escape the Backrooms'), 'index served');
  const A = await (await mk()).join('abcd'), B = await (await mk()).join('abcd');
  const gotA = [], gotB = []; A.on('lvl', m => gotA.push(m)); B.on('lvl', m => gotB.push(m));
  await A.presence({ on: 1, x: 5, lv: 0, mo: [[1, 2, 0]] }); await wait(100);
  const seen = B.peers().find(p => !p.isMe); assert(seen && seen.presence.x === 5 && seen.presence.mo[0][1] === 2, 'B sees A presence');
  await A.presence({ mo: null }); await wait(100);
  assert(!('mo' in B.peers().find(p => !p.isMe).presence), 'null removes field');
  await A.emit('lvl', { i: 2 }); await wait(100);
  assert(gotA.length === 1 && gotA[0].isMe && gotB.length === 1 && !gotB[0].isMe && gotB[0].data.i === 2, 'event delivery + isMe');
  const C = await (await mk()).join('abcd'), D = await (await mk()).join('abcd');
  await B.presence({on:1});await C.presence({on:1});await D.presence({on:1});await wait(100);
  await assert.rejects((await mk()).join('abcd'), /full/, '5th player rejected');
  await wait(50); const other = await (await mk()).join('other'); assert(other.peers().length === 1, 'rooms isolated');
  await C.leave(); await wait(100); assert(A.peers().length === 3, 'leave removes peer: '+A.peers().length);
  console.log('ALL TESTS PASSED'); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
