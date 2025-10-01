const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });
let queue = [];
let games = {};

const EVENT_MODES = [
  {name: "classic"},
  {name: "halloween", start: "10-20", end: "10-31"},
  {name: "newyear", start: "12-30", end: "01-02"}
];

function getEventMode() {
  let now = new Date();
  let month = ("0" + (now.getMonth() + 1)).slice(-2);
  let day = ("0" + now.getDate()).slice(-2);
  let current = `${month}-${day}`;
  for (let e of EVENT_MODES) {
    if (!e.start || !e.end) continue;
    if ((current >= e.start && current <= e.end) ||
        (e.start > e.end && (current >= e.start || current <= e.end))) {
      return e.name;
    }
  }
  return "classic";
}

function spawnPowerUp() {
  // Randomly spawn every 8-15 seconds
  return {
    x: Math.floor(Math.random() * 700 + 100),
    y: Math.floor(Math.random() * 400 + 100),
    type: ["speed", "grow", "shrink", "multi"][Math.floor(Math.random() * 4)],
    id: Date.now() + Math.random()
  };
}

function startGame(p1, p2, p1data, p2data) {
  const gameId = Date.now() + Math.random();
  let eventMode = getEventMode();
  let powerUps = [];
  let lastPowerUp = Date.now();
  let state = {
    ball: { x: 450, y: 300, vx: 7, vy: 4 },
    paddles: [300, 300],
    scores: [0, 0],
    powerUps: [],
    nicknames: [p1data.nickname, p2data.nickname],
    skins: [p1data.skin, p2data.skin],
    chat: [],
    eventMode
  };
  games[gameId] = { players: [p1, p2], state };
  p1.gameId = gameId;
  p2.gameId = gameId;
  p1.playerIdx = 0;
  p2.playerIdx = 1;

  // Notify match
  [p1, p2].forEach((ws, i) => {
    ws.send(JSON.stringify({ type: "match", playerIdx: i, nicknames: state.nicknames, skins: state.skins, eventMode }));
  });

  // Main game loop
  games[gameId].interval = setInterval(() => {
    // Power-up spawn
    if (Date.now() - lastPowerUp > Math.random() * 7000 + 8000) {
      state.powerUps.push(spawnPowerUp());
      lastPowerUp = Date.now();
    }
    // Move ball and handle collisions (similar as before, with power-up checks)
    let ball = state.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;
    // Wall
    if (ball.y <= 0 || ball.y >= 600 - 18) ball.vy = -ball.vy;
    // Paddles
    for (let i = 0; i < 2; i++) {
      let px = i === 0 ? 36 + 16 : 900 - 36 - 16 - 18;
      if (i === 0 ? ball.x <= px : ball.x + 18 >= px) {
        if (ball.y + 18 > state.paddles[i] && ball.y < state.paddles[i] + 110) {
          ball.vx = i === 0 ? Math.abs(ball.vx) * 1.08 : -Math.abs(ball.vx) * 1.08;
          ball.vy += ((ball.y + 9) - (state.paddles[i] + 55)) * 0.13;
          // Send event for haptic
          state.haptic = { player: i, time: Date.now() };
        }
      }
    }
    // Power-up collision
    for (let pu of state.powerUps) {
      if (Math.abs(ball.x + 9 - pu.x) < 22 && Math.abs(ball.y + 9 - pu.y) < 22) {
        if (pu.type === "speed") ball.vx *= 1.5;
        if (pu.type === "grow") state.paddles = state.paddles.map((y, i) => i === ball.vx > 0 ? y : y - 20);
        if (pu.type === "shrink") state.paddles = state.paddles.map((y, i) => i === ball.vx < 0 ? y : y + 20);
        // Remove power-up
        state.powerUps = state.powerUps.filter(p => p.id !== pu.id);
        state.lastPowerUpHit = { type: pu.type, time: Date.now() };
      }
    }
    // Score
    if (ball.x + 18 < 0) { state.scores[1]++; ball.x = 450; ball.y = 300; ball.vx = 7; ball.vy = 4; }
    if (ball.x > 900) { state.scores[0]++; ball.x = 450; ball.y = 300; ball.vx = -7; ball.vy = 4; }
    // Relay state
    for (const ws of games[gameId].players) {
      ws.send(JSON.stringify({ type: "game_state", state }));
    }
    state.haptic = null;
    state.lastPowerUpHit = null;
  }, 1000 / 60);
}

server.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.type === "find_match") {
      ws.nickname = data.nickname || "Player";
      ws.skin = data.skin || "default";
      ws.clientData = { nickname: ws.nickname, skin: ws.skin };
      queue.push(ws);
      ws.send(JSON.stringify({ type: "waiting" }));
      if (queue.length >= 2) {
        startGame(queue.shift(), queue.shift(), queue[0].clientData, queue[1].clientData);
      }
    } else if (data.type === "paddle" && ws.gameId) {
      let g = games[ws.gameId];
      if (g) g.state.paddles[ws.playerIdx] = data.y;
    } else if (data.type === "chat" && ws.gameId) {
      let g = games[ws.gameId];
      if (g) {
        let msgtext = data.text.slice(0, 128);
        g.state.chat.push({ sender: ws.playerIdx, text: msgtext, time: Date.now() });
        // Relay chat
        for (const p of g.players) {
          p.send(JSON.stringify({ type: "chat", sender: ws.playerIdx, text: msgtext }));
        }
      }
    }
  });
  ws.on('close', () => {
    queue = queue.filter(c => c !== ws);
    if (ws.gameId && games[ws.gameId]) {
      clearInterval(games[ws.gameId].interval);
      games[ws.gameId].players.forEach(p => {
        if (p !== ws && p.readyState === WebSocket.OPEN) {
          p.send(JSON.stringify({ type: "opponent_left" }));
        }
      });
      delete games[ws.gameId];
    }
  });
});
console.log("WAN matchmaking server running on ws://localhost:8080");
