# WAR – Conquista Mundial (v2)

## Jogar na rede local (LAN)
Precisa de Node.js 20+.  `npm install`  e depois  `npm start`.
O terminal mostra os endereços (ex.: http://192.168.0.10:3000). Abra no navegador de cada aparelho.
Se não conectar, libere a porta 3000 no firewall. Outra porta: `PORT=8080 npm start`.

## Pontuação (salva)
O servidor guarda `scores.json` ao lado dele. Cada navegador gera um token secreto; o nick fica "dono" desse token
(outra pessoa não consegue usar o mesmo nick). Vitória = +10 pontos, participação = +2. O ranking geral aparece no lobby.
Quem confirma o resultado é o servidor (o anfitrião informa o fim da partida). Apague `scores.json` para zerar.

## Executável (sem instalar Node)
- **Pelo GitHub (recomendado):** envie esta pasta para um repositório. Em *Actions → Executáveis → Run workflow*
  (ou crie uma tag `v1.0.0`) o GitHub gera `war-lan-win.exe`, macOS e Linux em *Artifacts* / *Releases*.
- **Na sua máquina:** `npm install` e `npm run build:exe` (pasta `dist/`).
Dê dois cliques no executável: ele sobe o servidor, abre o navegador e salva `scores.json` ao lado dele.

## GitHub Pages (hospedagem estática)
O workflow *Pages* publica `public/war.html` como site. Pages só serve arquivos, então lobby e partida em rede
precisam de um servidor em outro lugar (Render, Railway, Fly.io, um PC seu...):
1. Rode `server.js` nesse servidor (ele aceita `PORT`; em disco efêmero a pontuação reseta a cada deploy,
   use disco persistente + `DATA_DIR`).
2. Abra o site do Pages com `?server=meu-servidor.onrender.com` (ou edite `const SERVER=''` em `public/war.html`).
Sem servidor, o site funciona só para jogo local (bots / vários jogadores no mesmo aparelho).
