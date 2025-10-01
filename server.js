const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });
let queue = [];
let games = {};

const EVENT_MODES = [
  {name: "classic"},
  {name: "halloween", start: "10-20", end: "10-31"},
  {name: "newyear", start: "12-30", end: "01-02"},
  {name: "space", start: "07-01", end: "07-10"},
  {name: "rainbow", start: "06-01", end: "06-30"}
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

const POWERUP_TYPES = [
  "speed", "grow", "shrink", "multi", "slow", "invis", "crazy", "reverse"
];

function spawnPowerUp() {
  return {
    x: Math.floor(Math.random() * 700 + 100),
    y: Math.floor(Math.random() * 400 + 100),
    type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
    id: Date.now() + Math.random()
  };
}

function startGame(p1, p2, p1data, p2data) {
  const gameId = Date.now() + Math.random();
  let eventMode = getEventMode();
  let lastPowerUp = Date.now();
  let state = {
    ball: { x: 450, y: 300, vx: 7, vy: 4, invisible: false, crazy: false, reverse: [false, false] },
    balls: [],
    paddles: [300, 300],
    paddleSize: [110, 110],
    scores: [0, 0],
    powerUps: [],
    nicknames: [p1data.nickname, p2data.nickname],
    skins: [p1data.skin, p2data.skin],
    chat: [],
    eventMode,
    effects: []
  };
  games[gameId] = { players: [p1, p2], state };
  p1.gameId = gameId;
  p2.gameId = gameId;
  p1.playerIdx = 0;
  p2.playerIdx = 1;

  [p1, p2].forEach((ws, i) => {
    ws.send(JSON.stringify({ type: "match", playerIdx: i, nicknames: state.nicknames, skins: state.skins, eventMode }));
  });

  games[gameId].interval = setInterval(() => {
    // Power-up spawn
    if (Date.now() - lastPowerUp > Math.random() * 6000 + 7000) {
      state.powerUps.push(spawnPowerUp());
      lastPowerUp = Date.now();
    }

    // Ball and paddle logic
    function updateBall(ball) {
      ball.x += ball.vx;
      ball.y += ball.vy;
      // Wall
      if (ball.y <= 0 || ball.y >= 600 - 18) ball.vy = -ball.vy;
      // Paddles
      for (let i = 0; i < 2; i++) {
        let px = i === 0 ? 36 + 16 : 900 - 36 - 16 - 18;
        if (i === 0 ? ball.x <= px : ball.x + 18 >= px) {
          if (ball.y + 18 > state.paddles[i] && ball.y < state.paddles[i] + state.paddleSize[i]) {
            ball.vx = i === 0 ? Math.abs(ball.vx) * 1.08 : -Math.abs(ball.vx) * 1.08;
            ball.vy += ((ball.y + 9) - (state.paddles[i] + state.paddleSize[i]/2)) * 0.13;
            state.effects.push({ type: "paddle", idx: i, time: Date.now() });
          }
        }
      }
      // Power-up collision
      for (let pu of state.powerUps) {
        if (Math.abs(ball.x + 9 - pu.x) < 22 && Math.abs(ball.y + 9 - pu.y) < 22) {
          switch (pu.type) {
            case "speed": ball.vx *= 1.5; break;
            case "grow": state.paddleSize[ball.vx > 0 ? 1 : 0] = 180; break;
            case "shrink": state.paddleSize[ball.vx > 0 ? 1 : 0] = 60; break;
            case "multi": {
              // Add extra ball
              state.balls.push({ x: ball.x, y: ball.y, vx: ball.vx * -1, vy: ball.vy * 1.2 });
              break;
            }
            case "slow": ball.vx *= 0.6; ball.vy *= 0.8; break;
            case "invis": ball.invisible = true; setTimeout(() => ball.invisible = false, 2000); break;
            case "crazy": ball.crazy = true; setTimeout(() => ball.crazy = false, 1500); break;
            case "reverse": state.reverse = [!state.reverse[0], !state.reverse[1]]; setTimeout(() => state.reverse = [false, false], 4000); break;
          }
          state.effects.push({ type: "powerup", power: pu.type, time: Date.now() });
          state.powerUps = state.powerUps.filter(p => p.id !== pu.id);
        }
      }
      // Crazy ball effect
      if (ball.crazy) {
        ball.vx += (Math.random()-0.5)*2;
        ball.vy += (Math.random()-0.5)*2;
      }
      // Score
      if (ball.x + 18 < 0) { state.scores[1]++; ball.x = 450; ball.y = 300; ball.vx = 7; ball.vy = 4; }
      if (ball.x > 900) { state.scores[0]++; ball.x = 450; ball.y = 300; ball.vx = -7; ball.vy = 4; }
    }
    updateBall(state.ball);
    state.balls.forEach(updateBall);

    // Balls cleanup
    state.balls = state.balls.filter(b => b.x > 0 && b.x < 900);

    // Relay state
    for (const ws of games[gameId].players) {
      ws.send(JSON.stringify({ type: "game_state", state }));
    }
    state.effects = [];
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
        let color = data.color || "#fff";
        g.state.chat.push({ sender: ws.playerIdx, text: msgtext, color, time: Date.now() });
        for (const p of g.players) {
          p.send(JSON.stringify({ type: "chat", sender: ws.playerIdx, text: msgtext, color }));
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