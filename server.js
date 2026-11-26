// Servidor do WAR: serve public/war.html, retransmite lobby/partida e guarda a pontuação (scores.json).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'public', 'war.html');
const DATA = path.join(process.pkg ? path.dirname(process.execPath) : (process.env.DATA_DIR || __dirname), 'scores.json');

// ---- pontuação persistente ----
let DB = Object.create(null);
try { Object.assign(DB, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) {}
let sv = 0;
const save = () => { clearTimeout(sv); sv = setTimeout(() => fs.writeFile(DATA, JSON.stringify(DB), () => {}), 500); };
const rank = () => Object.entries(DB).map(([n, d]) => ({ n, p: d.p, w: d.w, g: d.g })).sort((a, b) => b.p - a.p).slice(0, 10);
const clean = s => String(s || '').replace(/[<>&"']/g, '').trim().slice(0, 14);

const srv = http.createServer((q, s) => {
  if (q.url === '/' || q.url.startsWith('/war.html') || q.url.startsWith('/?')) {
    fs.readFile(FILE, (e, d) => {
      if (e) { s.writeHead(500); return s.end('public/war.html nao encontrado'); }
      s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(d);
    });
  } else { s.writeHead(404); s.end('404'); }
});

const wss = new WebSocketServer({ server: srv }), cl = new Map();
let n = 0, timer = 0;
const send = (c, o) => c.ws.readyState === 1 && c.ws.send(o);
const ev = (topic, data) => JSON.stringify({ t: 'ev', topic, data, peer: 'srv' });
const bcastPeers = () => {
  if (timer) return;
  timer = setTimeout(() => {
    timer = 0;
    const m = JSON.stringify({ t: 'peers', peers: [...cl].map(([id, c]) => ({ peer: id, presence: c.pr })) });
    cl.forEach(c => send(c, m));
  }, 30);
};
const bcastRank = () => { const o = ev('_rank', rank()); cl.forEach(c => send(c, o)); };

wss.on('connection', ws => {
  const id = 'p' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  const c = { ws, pr: {}, nick: null, lr: 0 };
  cl.set(id, c);
  ws.send(JSON.stringify({ t: 'hello', id }));
  bcastPeers();
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m) return;
    if (m.t === 'p' && m.patch && typeof m.patch === 'object') {
      for (const k in m.patch) {
        if (['__proto__', 'constructor', 'prototype', 'score'].includes(k)) continue;
        if (c.nick && k === 'nick') continue;               // nick logado não muda
        if (m.patch[k] === null) delete c.pr[k]; else c.pr[k] = m.patch[k];
      }
      if (c.nick) { c.pr.nick = c.nick; c.pr.score = DB[c.nick].p; }
      if (JSON.stringify(c.pr).length > 4096) c.pr = {};
      bcastPeers();
    } else if (m.t === 'e' && typeof m.topic === 'string') {
      const d = m.data || {};
      if (m.topic === '_login') {                           // nick + token secreto do navegador
        const nk = clean(d.nick), tok = String(d.tok || '').slice(0, 80);
        if (!nk || !tok || ['__proto__', 'constructor', 'prototype'].includes(nk)) return;
        const u = DB[nk];
        const busy = [...cl].some(([i, o]) => i !== id && o.nick === nk);
        if ((u && u.tok !== tok) || busy) return send(c, ev('_deny', {}));
        if (!u) DB[nk] = { tok, p: 0, w: 0, g: 0 };
        c.nick = nk; c.pr.nick = nk; c.pr.score = DB[nk].p; save();
        send(c, ev('_you', { p: DB[nk].p, w: DB[nk].w, g: DB[nk].g }));
        send(c, ev('_rank', rank())); bcastPeers(); return;
      }
      if (m.topic === '_res') {                             // resultado de partida (enviado pelo anfitrião)
        const ps = [...new Set((Array.isArray(d.players) ? d.players : []).map(clean))].slice(0, 6), win = clean(d.winner);
        const conn = new Set([...cl.values()].map(x => x.nick).filter(Boolean));
        if (!c.nick || !ps.includes(c.nick) || !ps.includes(win) || Date.now() - c.lr < 60000) return;
        c.lr = Date.now();
        ps.forEach(p => { if (!conn.has(p) || !DB[p]) return; DB[p].g++; if (p === win) { DB[p].w++; DB[p].p += 10; } else DB[p].p += 2; });
        cl.forEach(x => { if (x.nick && DB[x.nick]) x.pr.score = DB[x.nick].p; });
        save(); bcastPeers(); bcastRank(); return;
      }
      if (m.topic[0] === '_') return;
      const o = JSON.stringify({ t: 'ev', topic: m.topic, data: m.data, peer: id });
      const to = d.to;
      if (to) { const t = cl.get(to); if (t) send(t, o); }  // mensagem dirigida
      else cl.forEach(c2 => send(c2, o));                    // para todos (inclusive quem enviou)
    }
  });
  ws.on('close', () => { cl.delete(id); bcastPeers(); });
});

srv.listen(PORT, '0.0.0.0', () => {
  console.log('WAR rodando. Abra em qualquer dispositivo da rede:');
  Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal)
    .forEach(i => console.log('  http://' + i.address + ':' + PORT));
  console.log('  http://localhost:' + PORT + '   (neste computador)\nPontuação salva em: ' + DATA);
  if (process.pkg || process.env.OPEN) {
    const u = 'http://localhost:' + PORT;
    exec(process.platform === 'win32' ? 'start "" ' + u : process.platform === 'darwin' ? 'open ' + u : 'xdg-open ' + u);
  }
});
