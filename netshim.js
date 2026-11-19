// Gives the game the same `claude.use('room')` API it uses on claude.ai, backed by our WebSocket server.
(function () {
  if (window.claude) return;
  const API = {
    join(name) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
        let me = '', done = 0, mp = {}; const peers = new Map(), ls = {};
        const fail = m => { if (!done) { done = 1; clearTimeout(tm); reject(new Error(m)); try { ws.close(); } catch (e) {} } };
        const tm = setTimeout(() => fail('Server did not answer (it may be waking up) — try again in a minute.'), 45000);
        const snd = o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
        const base = { by: null, sameTab: false, kind: 'viewer', guest: false };
        const room = {
          on(topic, fn) { (ls[topic] = ls[topic] || []).push(fn); return () => { ls[topic] = (ls[topic] || []).filter(x => x !== fn); }; },
          emit(topic, data) { snd({ t: 'ev', topic, data }); return Promise.resolve(); },
          presence(patch) { for (const k in patch) { if (patch[k] === null) delete mp[k]; else mp[k] = patch[k]; } snd({ t: 'pres', patch }); return Promise.resolve(); },
          peers() { return [{ ...base, peer: me, isMe: true, sameTab: true, presence: mp, updatedAt: Date.now() }, ...[...peers].map(([k, v]) => ({ ...base, peer: k, isMe: false, presence: v, updatedAt: Date.now() }))]; },
          onPeers() { return () => {}; },
          leave() { try { ws.close(); } catch (e) {} return Promise.resolve(); }
        };
        ws.onopen = () => snd({ t: 'join', room: name });
        ws.onerror = () => fail('Could not reach the game server.');
        ws.onclose = () => { peers.clear(); fail('Connection closed.'); };
        ws.onmessage = e => {
          let m; try { m = JSON.parse(e.data); } catch (x) { return; }
          if (m.t === 'welcome') { me = m.me; m.peers.forEach(p => peers.set(p.peer, p.presence)); done = 1; clearTimeout(tm); resolve(room); }
          else if (m.t === 'full') fail('That room is full (4 players max).');
          else if (m.t === 'pres') peers.set(m.peer, m.presence);
          else if (m.t === 'left') peers.delete(m.peer);
          else if (m.t === 'ev') (ls[m.topic] || []).slice().forEach(f => f({ ...base, peer: m.peer, isMe: m.peer === me, sameTab: m.peer === me, topic: m.topic, data: m.data }));
        };
      });
    }
  };
  window.claude = { use: async n => (n === 'room' ? API : null) };
})();
