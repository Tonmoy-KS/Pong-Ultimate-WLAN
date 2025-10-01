// ==== AVATAR/SKIN/PROFILE SETUP ====
const AVATAR_PATHS = {
    default: "avatars/default.png",
    cat: "avatars/cat.png",
    dog: "avatars/dog.png",
    alien: "avatars/alien.png",
    robot: "avatars/robot.png",
    custom: ""
};

const profilePanel = document.getElementById('profilePanel');
const avatarImg = document.getElementById('avatarImg');
const avatarUpload = document.getElementById('avatarUpload');
const avatarSelect = document.getElementById('avatarSelect');
const nicknameInput = document.getElementById('nickname');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profileStats = document.getElementById('profileStats');
const hudAvatar = document.getElementById('hudAvatar');
const hudNickname = document.getElementById('hudNickname');
const skinSelect = document.getElementById('skinSelect');
const eventSelect = document.getElementById('eventSelect');
const aiDiff = document.getElementById('aiDiff');
const assistModeElem = document.getElementById('assistMode');
const findMatchBtn = document.getElementById('findMatchBtn');
const aiPlayBtn = document.getElementById('aiPlayBtn');
const profileBtn = document.getElementById('profileBtn');
const settingsBtn = document.getElementById('settingsBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const tournamentBtn = document.getElementById('tournamentBtn');
const hudStatus = document.getElementById('hudStatus');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const powerupFreq = document.getElementById('powerupFreq');
const powerupFreqLabel = document.getElementById('powerupFreqLabel');
const ballSpeed = document.getElementById('ballSpeed');
const ballSpeedLabel = document.getElementById('ballSpeedLabel');
const paddleSizeElem = document.getElementById('paddleSize');
const paddleSizeLabel = document.getElementById('paddleSizeLabel');
const ruleMultiBall = document.getElementById('ruleMultiBall');
const leaderboardPanel = document.getElementById('leaderboardPanel');
const achievementPanel = document.getElementById('achievementPanel');
const tournamentPanel = document.getElementById('tournamentPanel');
const saveReplayBtn = document.getElementById('saveReplayBtn');
const gameArea = document.getElementById('gameArea');
const playerAvatar = document.getElementById('playerAvatar');
const opponentAvatar = document.getElementById('opponentAvatar');
const playerNicknameElem = document.getElementById('playerNickname');
const opponentNicknameElem = document.getElementById('opponentNickname');
const playerScoreElem = document.getElementById('playerScore');
const opponentScoreElem = document.getElementById('opponentScore');
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatColor = document.getElementById('chatColor');
const overlay = document.getElementById('overlay');
const gameOverText = document.getElementById('gameOverText');
const restartBtn = document.getElementById('restartBtn');

let ws, playerIdx, paddleY = 300, opponentY = 300, ball = {x:450,y:300}, balls = [], scores=[0,0];
let nicknames = ["Player","AI"];
let skins = ["default", "default"];
let avatars = ["default", "default"];
let powerUps = [];
let eventMode = "classic";
let hapticEnabled = !!window.navigator.vibrate;
let aiMode = false;
let aiPaddleY = 300;
let paddleSize = [110, 110];
let reverseControl = false;
let achievements = [];
let replayFrames = [];
let leaderboard = [];
let stats = {
    games: 0, wins: 0, losses: 0, winrate: 0, powerups: 0, goals: 0, saves: 0, tournaments: 0, longestWinStreak: 0, currentWinStreak: 0
};
let tournamentBracket = [];

// ====== PROFILE AND AVATAR ======
function updateProfilePanel() {
    avatarImg.src = avatars[0] === "custom" && localStorage.getItem('customAvatar')
        ? localStorage.getItem('customAvatar')
        : AVATAR_PATHS[avatars[0]] || AVATAR_PATHS.default;
    nicknameInput.value = nicknames[0];
    avatarSelect.value = avatars[0];
    skinSelect.value = skins[0];
    profileStats.innerHTML = `<b>Lifetime Stats</b><br>
        Games: ${stats.games}<br>
        Wins: ${stats.wins}<br>
        Losses: ${stats.losses}<br>
        Win Rate: ${(stats.winrate*100).toFixed(1)}%<br>
        Power-Ups Used: ${stats.powerups}<br>
        Goals: ${stats.goals}<br>
        Saves: ${stats.saves}<br>
        Tournaments: ${stats.tournaments}<br>
        Longest Win Streak: ${stats.longestWinStreak}`;
    hudAvatar.src = avatarImg.src;
    hudNickname.textContent = nicknames[0];
}
function saveProfile() {
    nicknames[0] = nicknameInput.value || "Player";
    avatars[0] = avatarSelect.value;
    skins[0] = skinSelect.value;
    localStorage.setItem("pongProfile", JSON.stringify({ nickname: nicknames[0], avatar: avatars[0], skin: skins[0], stats }));
    updateProfilePanel();
}
function loadProfile() {
    let p = localStorage.getItem("pongProfile");
    if (p) {
        p = JSON.parse(p);
        nicknames[0] = p.nickname || "Player";
        avatars[0] = p.avatar || "default";
        skins[0] = p.skin || "default";
        stats = p.stats || stats;
    }
    updateProfilePanel();
}
saveProfileBtn.onclick = saveProfile;
profileBtn.onclick = () => { profilePanel.style.display = "block"; updateProfilePanel(); };
avatarSelect.onchange = updateProfilePanel;
skinSelect.onchange = updateProfilePanel;
closeSettingsBtn.onclick = () => { settingsPanel.style.display = 'none'; };
avatarUpload.onchange = function(e) {
    if (!e.target.files[0]) return;
    let reader = new FileReader();
    reader.onload = function(evt) {
        localStorage.setItem('customAvatar', evt.target.result);
        avatars[0] = "custom";
        updateProfilePanel();
    };
    reader.readAsDataURL(e.target.files[0]);
};
loadProfile();

// ====== SETTINGS ======
powerupFreq.oninput = () => { powerupFreqLabel.textContent = ["Very Low","Low","Normal","High","Very High","Extreme"][powerupFreq.value-1]||powerupFreq.value; }
ballSpeed.oninput = () => { ballSpeedLabel.textContent = ballSpeed.value; }
paddleSizeElem.oninput = () => { paddleSizeLabel.textContent = paddleSizeElem.value; }

// ====== ACHIEVEMENTS ======
function unlockAchievement(name) {
    if (!achievements.includes(name)) {
        achievements.push(name);
        achievementPanel.innerHTML += `<div class="achievement">${name}</div>`;
        achievementPanel.style.display = "block";
        setTimeout(() => achievementPanel.style.display = "none", 3500);
    }
}

// ====== REPLAY SYSTEM ======
function saveReplay() {
    localStorage.setItem('pongReplay', JSON.stringify(replayFrames));
    alert("Replay saved!");
}
if (saveReplayBtn) saveReplayBtn.onclick = saveReplay;

// ====== PARTICLE/TRAIL SYSTEM ======
let trailParticles = [];
function spawnTrail(x, y, color) {
    trailParticles.push({x, y, color, time: Date.now()});
}
function drawTrails() {
    for (let p of trailParticles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1-(Date.now()-p.time)/600);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2*Math.PI); ctx.fill();
        ctx.restore();
    }
    trailParticles = trailParticles.filter(p => Date.now()-p.time < 600);
}
function drawBall(ball) {
    spawnTrail(ball.x + 9, ball.y + 9, "#fd0");
    ctx.save();
    if (ball.crazy) ctx.translate(Math.random()*6-3, Math.random()*6-3);
    ctx.fillStyle = "#fd0";
    ctx.globalAlpha = ball.invisible ? 0.07 : 1.0;
    ctx.beginPath();
    ctx.arc(ball.x + 9, ball.y + 9, 9, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.restore();
}

// ====== CONTROLS ======
document.addEventListener('keydown', function(evt) {
    if (evt.key === 'w' || evt.key === 'ArrowUp') paddleY -= 24;
    if (evt.key === 's' || evt.key === 'ArrowDown') paddleY += 24;
    paddleY = Math.max(0, Math.min(canvas.height - paddleSizeElem.value, paddleY));
});
canvas.addEventListener('touchmove', function(evt) {
    let rect = canvas.getBoundingClientRect();
    let touchY = evt.touches[0].clientY - rect.top;
    paddleY = Math.max(0, Math.min(canvas.height - paddleSizeElem.value, touchY - paddleSizeElem.value/2));
});

// ====== AI PERSONALITIES ======
const AI_PERSONALITIES = {
    easy: { error: 80, react: 0.7, tactic: "normal" },
    medium: { error: 32, react: 0.85, tactic: "normal" },
    hard: { error: 8, react: 0.93, tactic: "aggressive" },
    worldclass: { error: 2, react: 1.0, tactic: "predictive" },
    adaptive: { error: 20, react: 0.9, tactic: "adaptive" },
    custom: { error: 22, react: 0.85, tactic: "normal" }
};
let aiHistory = [];
function aiLoop() {
    let aiDiffVal = aiDiff.value;
    let aiProfile = AI_PERSONALITIES[aiDiffVal] || AI_PERSONALITIES.easy;
    if (aiProfile.tactic === "adaptive" && aiHistory.length > 10) {
        let recentMisses = aiHistory.slice(-10).filter(h => h.missed).length;
        aiProfile.error = Math.max(2, Math.min(80, 22 + recentMisses*4));
    }
    let ballToTrack = ball;
    if (balls.length && aiProfile.tactic !== "easy") {
        ballToTrack = balls.reduce((prev, curr) => Math.abs(curr.x-900)<Math.abs(prev.x-900)?curr:prev, ball);
    }
    let predictedY = ballToTrack.y;
    if (aiProfile.tactic === "predictive") {
        let steps = (canvas.width - ballToTrack.x) / (ballToTrack.vx||1);
        predictedY += steps * ballToTrack.vy;
        predictedY = Math.max(0, Math.min(canvas.height-paddleSizeElem.value, predictedY));
    }
    let targetY = aiProfile.react * (predictedY + 9 - paddleSizeElem.value/2) + (Math.random()-0.5)*aiProfile.error;
    let speed = 4 + (aiProfile.react*4) + Math.abs(ballToTrack.vx)/4;
    if (aiPaddleY < targetY - 6) aiPaddleY += speed;
    else if (aiPaddleY > targetY + 6) aiPaddleY -= speed;
    opponentY = Math.max(0, Math.min(canvas.height - paddleSizeElem.value, aiPaddleY));
    if (assistModeElem.checked) paddleY = ball.y + 9 - paddleSizeElem.value/2;
}

// ====== ACHIEVEMENTS ======
function unlockAchievementIfNeeded() {
    if (scores[0] >= 10) unlockAchievement("First Win!");
    if (scores[0] >= 100) unlockAchievement("Pong Master!");
    if (ball.crazy) unlockAchievement("Crazy Ball!");
    if (paddleSizeElem.value >= 180) unlockAchievement("Big Paddle!");
}

// ====== REPLAY FRAME SAVE ======
function saveReplayFrame() {
    replayFrames.push({
        ball: {...ball},
        balls: balls.map(b=>({...b})),
        paddleY,
        opponentY,
        scores: [...scores],
        powerUps: powerUps.map(p=>({...p})),
        settings: {
            ballSpeed: ballSpeed.value,
            paddleSize: paddleSizeElem.value,
            powerupFreq: powerupFreq.value,
            ruleMultiBall: ruleMultiBall.checked
        },
        time: Date.now()
    });
}

// ====== GAME DRAWING ======
function drawEverything() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawTrails();
    drawBall(ball);
    balls.forEach(drawBall);

    // Power-ups
    for (let pu of powerUps) {
        ctx.save();
        ctx.fillStyle = "#fd0";
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, 12, 0, 2 * Math.PI);
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.font = "10px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(pu.type, pu.x - 16, pu.y + 22);
        ctx.restore();
    }
    // Net
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([10, 18]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.restore();
    // Paddles
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(36, paddleY, 16, paddleSizeElem.value);
    ctx.fillRect(canvas.width - 36 - 16, opponentY, 16, paddleSizeElem.value);
    ctx.restore();
}

// ====== GAME LOOP ======
function gameLoop() {
    drawEverything();
    unlockAchievementIfNeeded();
    saveReplayFrame();
    requestAnimationFrame(gameLoop);
}

// ====== AI PLAY ======
aiPlayBtn.onclick = () => {
    ball = { x: 450, y: 300, vx: parseInt(ballSpeed.value), vy: parseInt(ballSpeed.value) };
    balls = ruleMultiBall.checked ? [{ x: 450, y: 300, vx: -parseInt(ballSpeed.value), vy: parseInt(ballSpeed.value) }] : [];
    powerUps = [];
    paddleSize = [parseInt(paddleSizeElem.value), parseInt(paddleSizeElem.value)];
    scores = [0,0];
    aiPaddleY = 300;
    nicknames = [nicknameInput.value||"Player","AI"];
    avatars = [avatarSelect.value,"robot"];
    skins = [skinSelect.value,skinSelect.value];
    eventMode = eventSelect.value === "auto" ? "classic" : eventSelect.value;
    playerAvatar.src = avatars[0] === "custom" && localStorage.getItem('customAvatar')
        ? localStorage.getItem('customAvatar')
        : AVATAR_PATHS[avatars[0]] || AVATAR_PATHS.default;
    opponentAvatar.src = AVATAR_PATHS[avatars[1]] || AVATAR_PATHS.default;
    playerNicknameElem.textContent = nicknames[0];
    opponentNicknameElem.textContent = nicknames[1];
    canvas.className = "skin-" + skins[0];
    hud.style.display = "none";
    gameArea.style.display = "block";
    achievements = [];
    gameLoop();
    setInterval(() => aiLoop(), 1000/60);
    setInterval(() => { if (Math.random() < powerupFreq.value/10) powerUps.push(localSpawnPowerUp()); }, 1200);
};

function localSpawnPowerUp() {
    const types = ["speed","grow","shrink","multi","slow","invis","crazy","reverse"];
    return { x: Math.floor(Math.random() * 700 + 100), y: Math.floor(Math.random() * 400 + 100), type: types[Math.floor(Math.random() * types.length)], id: Date.now()+Math.random() };
}

// ====== LEADERBOARD ======
function updateLeaderboard() {
    let l = JSON.parse(localStorage.getItem('pongLeaderboard')||"[]");
    let found = false;
    for (let entry of l) {
        if (entry.nickname === nicknames[0]) { entry.stats = {...stats}; found = true; }
    }
    if (!found) l.push({nickname:nicknames[0],stats:{...stats},avatar:avatars[0]});
    l.sort((a,b)=>b.stats.wins-a.stats.wins);
    localStorage.setItem('pongLeaderboard',JSON.stringify(l));
    leaderboardPanel.innerHTML = `<h2>Leaderboard</h2>` + l.map((entry,i)=>`
        <div class="leaderboard-entry">
            <img src="${entry.avatar==='custom'&&localStorage.getItem('customAvatar')?localStorage.getItem('customAvatar'):AVATAR_PATHS[entry.avatar]||AVATAR_PATHS.default}" width="30" height="30" style="vertical-align:middle;">
            #${i+1} ${entry.nickname} - ${entry.stats.wins} Wins, ${entry.stats.games} Games, ${(entry.stats.winrate*100).toFixed(1)}% WR
        </div>
    `).join('');
}
leaderboardBtn.onclick = updateLeaderboard;

// ====== TOURNAMENT ======
tournamentBtn.onclick = () => {
    // Generate a simple tournament bracket from leaderboard top 8
    let l = JSON.parse(localStorage.getItem('pongLeaderboard')||"[]");
    let bracket = [];
    for (let i=0;i<Math.min(8, l.length);i+=2) {
        bracket.push({
            p1: l[i]?.nickname||"N/A",
            p2: l[i+1]?.nickname||"N/A",
            winner: (l[i]?.stats?.wins||0) >= (l[i+1]?.stats?.wins||0) ? l[i]?.nickname : l[i+1]?.nickname
        });
    }
    tournamentPanel.innerHTML = "<h2>Tournament Bracket</h2><div class='tournament-bracket'>"+bracket.map((m,i)=>
        `<div class="tournament-match">${m.p1} <b>vs</b> ${m.p2} &mdash; <b>${m.winner?'Winner: '+m.winner:'In progress'}</b></div>`
    ).join('')+"</div>";
    tournamentPanel.style.display = "block";
    setTimeout(()=>{ tournamentPanel.style.display = "none"; },7000);
};

// ====== CHAT SYSTEM ======
chatInput.addEventListener('keydown', function(evt) {
    if (evt.key === 'Enter' && chatInput.value.trim()) {
        let text = chatInput.value.trim();
        addChatMessage(0, text, chatColor.value);
        chatInput.value = '';
    }
});
function addChatMessage(sender, text, color) {
    let name = sender === 0 ? nicknames[0] : nicknames[1];
    let msgElem = document.createElement('div');
    msgElem.innerHTML = `<span style="color:${color};font-weight:600;">${name}:</span> ${text}`;
    chatMessages.appendChild(msgElem);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ====== GAME OVER / RESTART ======
restartBtn.onclick = () => location.reload();