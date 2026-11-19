# Escape the Backrooms — Online Co-op (1–4 players)

One Node service serves the game and relays players over WebSocket.

## Run locally
    npm install
    npm start          # http://localhost:3000
Open it in two browser tabs, click "Join / create room" in each (same code).

## Deploy on GitHub + Render
1. Create a GitHub repo and upload every file in this folder (not `node_modules`).
2. On render.com: New → Web Service → connect the repo. Render reads `render.yaml`
   (or set: Build `npm install`, Start `node server.js`, Free plan).
3. When it's live, open your `https://<name>.onrender.com` link. Share it plus a room code.

Notes: the free plan sleeps after ~15 min idle, so the first visit can take up to a minute.
`npm test` runs the server/client networking test.

## Voice chat
When you join a room the game asks whether to turn on your microphone (your browser then shows its own
Allow/Block prompt). If it's blocked, the game shows how to fix it and a Try again button. "Listen only" lets you
hear others without a mic. Press V to mute/unmute.

Voice is relayed through the game server (no WebRTC/NAT problems), so it works on Render for everyone.
Players hear each other louder when close, quieter when far (silent past ~30 units or on another level).
Monsters hear your voice: talking is about as loud as walking, shouting about as loud as sprinting.
Needs the https page (Render provides it).
