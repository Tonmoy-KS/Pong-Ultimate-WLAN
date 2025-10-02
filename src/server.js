const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'pong-server-data.json');
const server = new WebSocket.Server({ port: PORT });

let queue = [];
let games = {};
let profiles = {}; // key: id, value: {nickname, avatar, skin, stats}
let leaderboard = [];
let tournaments = {};

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

// --- Persistent Data Management ---
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const obj = JSON.parse(raw);
      profiles = obj.profiles || {};
      leaderboard = obj.leaderboard || [];
      tournaments = obj.tournaments || {};
    } catch (e) {
      console.error("Failed to load persistent data:", e);
    }
  }
}
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({profiles, leaderboard, tournaments}, null, 2));
  } catch (e) {
    console.error("Failed to save persistent data:", e);
  }
}
loadData();

// --- Power-up spawning ---
function spawnPowerUp() {
  return {
    x: Math.floor(Math.random() * 700 + 100),
    y: Math.floor(Math.random() * 400 + 100),
    type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
    id: Date.now() + Math.random()
  };
}

// --- Player Profile Update ---
function updateProfile(id, data) {
  if (!profiles[id]) profiles[id] = {};
  profiles[id] = { ...profiles[id], ...data };
  saveData();
}

// --- Leaderboard Update ---
function updateLeaderboard(profile) {
  const idx = leaderboard.findIndex(p => p.id === profile.id);
  if (idx !== -1) leaderboard[idx] = profile;
  else leaderboard.push(profile);
  leaderboard.sort((a, b) => (b.stats?.wins || 0) - (a.stats?.wins || 0));
  leaderboard = leaderboard.slice(0, 50); // Top 50
  saveData();
}

// --- Tournament Mode ---
function createTournament(tid, players) {
  tournaments[tid] = {
    id: tid,
    event: getEventMode(),
    rounds: [],
    champion: "",
    players: players.map(p => p.id),
    bracket: []
  };
  // Generate bracket (single elimination)
  let shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < shuffled.length; i += 2) {
    tournaments[tid].bracket.push({
      p1: shuffled[i] ? shuffled[i].id : null,
      p2: shuffled[i + 1] ? shuffled[i + 1].id : null,
      winner: null,
      gameId: null
    });
  }
  saveData();
  return tournaments[tid];
}

// --- Game Logic ---
function startGame(p1, p2, p1data, p2data, tournamentId, bracketIdx) {
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
    avatars: [p1data.avatar, p2data.avatar],
    skins: [p1data.skin, p2data.skin],
    chat: [],
    eventMode,
    effects: [],
    tournamentId: tournamentId || null,
    bracketIdx: bracketIdx != null ? bracketIdx : null
  };
  games[gameId] = { players: [p1, p2], state };
  p1.gameId = gameId;
  p2.gameId = gameId;
  p1.playerIdx = 0;
  p2.playerIdx = 1;

  [p1, p2].forEach((ws, i) => {
    ws.send(JSON.stringify({
      type: "match",
      playerIdx: i,
      nicknames: state.nicknames,
      avatars: state.avatars,
      skins: state.skins,
      eventMode,
      tournamentId: state.tournamentId,
      bracketIdx: state.bracketIdx
    }));
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
      if (ball.x + 18 < 0) {
        state.scores[1]++;
        ball.x = 450; ball.y = 300; ball.vx = 7; ball.vy = 4;
      }
      if (ball.x > 900) {
        state.scores[0]++;
        ball.x = 450; ball.y = 300; ball.vx = -7; ball.vy = 4;
      }
    }
    updateBall(state.ball);
    state.balls.forEach(updateBall);

    // Balls cleanup
    state.balls = state.balls.filter(b => b.x > 0 && b.x < 900);

    // Check for win
    let winScore = 10;
    let winnerIdx = null;
    if (state.scores[0] >= winScore) winnerIdx = 0;
    if (state.scores[1] >= winScore) winnerIdx = 1;
    if (winnerIdx != null) {
      // Update stats & leaderboard
      [p1, p2].forEach((ws, i) => {
        if (profiles[ws.id]) {
          profiles[ws.id].stats = profiles[ws.id].stats || {games:0, wins:0, losses:0};
          profiles[ws.id].stats.games++;
          if (i === winnerIdx) {
            profiles[ws.id].stats.wins++;
          } else {
            profiles[ws.id].stats.losses++;
          }
          updateLeaderboard({
            id: ws.id,
            nickname: profiles[ws.id].nickname,
            avatar: profiles[ws.id].avatar,
            skin: profiles[ws.id].skin,
            stats: profiles[ws.id].stats
          });
        }
      });
      saveData();

      // If tournament match, update bracket
      if (state.tournamentId && state.bracketIdx != null && tournaments[state.tournamentId]) {
        let bracketMatch = tournaments[state.tournamentId].bracket[state.bracketIdx];
        bracketMatch.winner = [p1, p2][winnerIdx].id;
        bracketMatch.gameId = gameId;
        // Check tournament champion
        let winners = tournaments[state.tournamentId].bracket.map(m => m.winner).filter(Boolean);
        if (winners.length === tournaments[state.tournamentId].bracket.length) {
          tournaments[state.tournamentId].champion = winners[0]; // For single round
          saveData();
        }
      }

      // Notify and cleanup
      [p1, p2].forEach(ws => {
        ws.send(JSON.stringify({type: 'gameover', winnerIdx, scores: state.scores}));
        ws.close();
      });
      clearInterval(games[gameId].interval);
      delete games[gameId];
    }

    // Relay state
    for (const ws of games[gameId]?.players || []) {
      ws.send(JSON.stringify({ type: "game_state", state }));
    }
    state.effects = [];
  }, 1000 / 60);
}

// --- Connection Handling ---
server.on('connection', ws => {
  ws.id = `user${Math.floor(Math.random()*100000000)}-${Date.now()}`;
  ws.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.type === "find_match") {
      ws.nickname = data.nickname || "Player";
      ws.avatar = data.avatar || "default";
      ws.skin = data.skin || "default";
      ws.clientData = { id: ws.id, nickname: ws.nickname, avatar: ws.avatar, skin: ws.skin };
      updateProfile(ws.id, ws.clientData);
      queue.push(ws);
      ws.send(JSON.stringify({ type: "waiting" }));
      if (queue.length >= 2) {
        const ws1 = queue.shift(), ws2 = queue.shift();
        startGame(ws1, ws2, ws1.clientData, ws2.clientData);
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
    // Profile update
    else if (data.type === "profile") {
      updateProfile(ws.id, data.profile);
      ws.send(JSON.stringify({ type: "profile_saved", profile: profiles[ws.id] }));
    }
    // Leaderboard request
    else if (data.type === "get_leaderboard") {
      ws.send(JSON.stringify({ type: "leaderboard", leaderboard }));
    }
    // Tournament creation
    else if (data.type === "create_tournament") {
      const tid = `t${Date.now()}-${Math.floor(Math.random()*1000000)}`;
      const players = (data.players || []).map(pid => profiles[pid]).filter(Boolean);
      const tournament = createTournament(tid, players);
      ws.send(JSON.stringify({ type: "tournament_created", tournament }));
    }
    // Tournament bracket request
    else if (data.type === "get_tournament") {
      let t = tournaments[data.tid];
      ws.send(JSON.stringify({ type: "tournament", tournament: t }));
    }
    // Tournament match start
    else if (data.type === "start_tournament_match") {
      let t = tournaments[data.tid];
      if (t && t.bracket[data.idx]) {
        let m = t.bracket[data.idx];
        const ws1 = server.clients.find(cl => cl.id === m.p1), ws2 = server.clients.find(cl => cl.id === m.p2);
        if (ws1 && ws2) startGame(ws1, ws2, profiles[ws1.id], profiles[ws2.id], data.tid, data.idx);
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

console.log(`Pong Ultimate WAN server running on ws://localhost:${PORT}`);
