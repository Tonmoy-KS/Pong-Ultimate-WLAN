const hud = document.getElementById('hud');
const hudStatus = document.getElementById('hudStatus');
const nicknameInput = document.getElementById('nickname');
const skinSelect = document.getElementById('skinSelect');
const eventSelect = document.getElementById('eventSelect');
const findMatchBtn = document.getElementById('findMatchBtn');
const aiPlayBtn = document.getElementById('aiPlayBtn');
const serverAddr = document.getElementById('serverAddr');
const gameArea = document.getElementById('gameArea');
const playerScoreElem = document.getElementById('playerScore');
const opponentScoreElem = document.getElementById('opponentScore');
const playerNicknameElem = document.getElementById('playerNickname');
const opponentNicknameElem = document.getElementById('opponentNickname');
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const chatBox = document.getElementById('chatBox');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatColor = document.getElementById('chatColor');
const aiDiff = document.getElementById('aiDiff');
const aiDiffLabel = document.getElementById('aiDiffLabel');
let ws, playerIdx, paddleY = 300, opponentY = 300, ball = {x:450,y:300}, balls = [], scores=[0,0];
let nicknames = ["",""];
let skins = ["default", "default"];
let powerUps = [];
let eventMode = "classic";
let overlay = document.getElementById('overlay');
let gameOverText = document.getElementById('gameOverText');
let restartBtn = document.getElementById('restartBtn');
let hapticEnabled = !!window.navigator.vibrate;
let aiMode = false;
let aiPaddleY = 300;
let paddleSize = [110, 110];
let reverseControl = false;
let aiDifficulty = 1; // 0=Easy, 1=Medium, 2=Hard, 3=World-class

const AI_LABELS = ["Easy", "Medium", "Hard", "World-class"];
aiDiffLabel.textContent = AI_LABELS[aiDifficulty];
aiDiff.addEventListener('input', function() {
    aiDifficulty = parseInt(aiDiff.value);
    aiDiffLabel.textContent = AI_LABELS[aiDifficulty];
});

function applySkin(skin) { canvas.className = "skin-" + skin; }
function renderPowerUps() {
    for (let pu of powerUps) {
        ctx.save();
        let colorMap = {
            speed: "#0cf", grow: "#3f3", shrink: "#f33", multi: "#fc0",
            slow: "#777", invis: "#fff", crazy: "#ff0", reverse: "#fc0"
        };
        ctx.fillStyle = colorMap[pu.type] || "#fff";
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, 12, 0, 2 * Math.PI);
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.font = "10px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText(pu.type, pu.x - 16, pu.y + 22);
        ctx.restore();
    }
}
function renderEventEffects() { /* (same as above) */ }
chatInput.addEventListener('keydown', function(evt) {
    if (evt.key === 'Enter' && chatInput.value.trim()) {
        let text = chatInput.value.trim();
        text = parseEmojis(text);
        if (aiMode) {
            addChatMessage(0, text, chatColor.value);
        } else {
            ws.send(JSON.stringify({ type: "chat", text, color: chatColor.value }));
        }
        chatInput.value = '';
    }
});
function parseEmojis(text) {
    return text.replace(/:pumpkin:/g,"🎃").replace(/:bat:/g,"🦇").replace(/:fire:/g,"🔥").replace(/:star:/g,"⭐").replace(/:ice:/g,"❄️").replace(/:rainbow:/g,"🌈").replace(/:gold:/g,"🏆");
}
function addChatMessage(sender, text, color) {
    let name = sender === playerIdx ? nicknames[playerIdx] : nicknames[1-playerIdx];
    let msgElem = document.createElement('div');
    msgElem.textContent = `${name}: ${text}`;
    msgElem.style.color = color || (sender === playerIdx ? "#0cf" : "#fc0");
    chatMessages.appendChild(msgElem);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function drawEverything() { /* (same as above) */ }
canvas.addEventListener('mousemove', function(evt) {
    let rect = canvas.getBoundingClientRect();
    let mouseY = evt.clientY - rect.top;
    if (reverseControl) mouseY = canvas.height - mouseY;
    paddleY = Math.max(0, Math.min(canvas.height - (paddleSize[playerIdx] || 110), mouseY - (paddleSize[playerIdx]||110)/2));
    if (ws && ws.readyState === ws.OPEN && playerIdx !== null && !aiMode) {
        ws.send(JSON.stringify({ type: "paddle", y: paddleY }));
    }
});
function updateScores() {
    playerScoreElem.textContent = scores[playerIdx];
    opponentScoreElem.textContent = scores[1 - playerIdx];
}
function gameLoop() {
    drawEverything();
    requestAnimationFrame(gameLoop);
}
findMatchBtn.onclick = () => { /* (same as above) */ };
// --- AI/Offline Play ---
aiPlayBtn.onclick = () => {
    aiMode = true;
    playerIdx = 0;
    nicknames = [nicknameInput.value,"AI"];
    skins = [skinSelect.value, skinSelect.value];
    eventMode = eventSelect.value === "auto" ? "classic" : eventSelect.value;
    playerNicknameElem.textContent = nicknames[playerIdx];
    opponentNicknameElem.textContent = nicknames[1-playerIdx];
    applySkin(skins[playerIdx]);
    hud.style.display = "none";
    gameArea.style.display = "block";
    chatBox.style.display = "block";
    scores = [0,0];
    ball = { x: 450, y: 300, vx: 7, vy: 4 };
    balls = [];
    powerUps = [];
    paddleSize = [110,110];
    aiPaddleY = 300;
    gameLoop();
    setInterval(() => aiLoop(), 1000/60);
    setInterval(() => { if (Math.random() < 0.05) powerUps.push(localSpawnPowerUp()); }, 1200);
};
function localSpawnPowerUp() {
    const types = ["speed","grow","shrink","multi","slow","invis","crazy","reverse"];
    return { x: Math.floor(Math.random() * 700 + 100), y: Math.floor(Math.random() * 400 + 100), type: types[Math.floor(Math.random() * types.length)], id: Date.now()+Math.random() };
}
function aiLoop() {
    // AI difficulty logic
    let targetY;
    let ballToTrack = ball;
    if (balls.length && aiDifficulty > 1) {
        ballToTrack = balls.reduce((prev, curr) => Math.abs(curr.x-900)<Math.abs(prev.x-900)?curr:prev, ball);
    }
    switch(aiDifficulty) {
        case 0: // Easy
            targetY = ballToTrack.y + 9 - (paddleSize[1]||110)/2 + (Math.random()-0.5)*70;
            break;
        case 1: // Medium
            targetY = ballToTrack.y + 9 - (paddleSize[1]||110)/2 + (Math.random()-0.5)*30;
            break;
        case 2: // Hard
            targetY = ballToTrack.y + 9 - (paddleSize[1]||110)/2 + (Math.random()-0.5)*10;
            break;
        case 3: // World-class
            targetY = ballToTrack.y + 9 - (paddleSize[1]||110)/2;
            break;
    }
    let speed = 4 + aiDifficulty*2 + Math.abs(ballToTrack.vx)/3;
    if (aiPaddleY < targetY - 6) aiPaddleY += speed;
    else if (aiPaddleY > targetY + 6) aiPaddleY -= speed;
    opponentY = Math.max(0, Math.min(canvas.height - (paddleSize[1]||110), aiPaddleY));
    function updateBall(ballObj) {
        ballObj.x += ballObj.vx; ballObj.y += ballObj.vy;
        if (ballObj.y <= 0 || ballObj.y >= 600 - 18) ballObj.vy = -ballObj.vy;
        if (ballObj.x <= 36 + 16 && ballObj.y + 18 > paddleY && ballObj.y < paddleY + (paddleSize[0]||110)) {
            ballObj.vx = Math.abs(ballObj.vx)*1.08;
            ballObj.vy += ((ballObj.y+9)-(paddleY+(paddleSize[0]||110)/2))*0.13;
            if (hapticEnabled) navigator.vibrate([50,30,50]);
        }
        if (ballObj.x + 18 >= canvas.width - 36 - 16 && ballObj.y + 18 > opponentY && ballObj.y < opponentY + (paddleSize[1]||110)) {
            ballObj.vx = -Math.abs(ballObj.vx)*1.08;
            ballObj.vy += ((ballObj.y+9)-(opponentY+(paddleSize[1]||110)/2))*0.13;
        }
        for (let pu of powerUps) {
            if (Math.abs(ballObj.x + 9 - pu.x) < 22 && Math.abs(ballObj.y + 9 - pu.y) < 22) {
                switch (pu.type) {
                    case "speed": ballObj.vx *= 1.5; break;
                    case "grow": paddleSize[ballObj.vx > 0 ? 1 : 0] = 180; break;
                    case "shrink": paddleSize[ballObj.vx > 0 ? 1 : 0] = 60; break;
                    case "multi": balls.push({ x: ballObj.x, y: ballObj.y, vx: ballObj.vx * -1, vy: ballObj.vy * 1.2 }); break;
                    case "slow": ballObj.vx *= 0.6; ballObj.vy *= 0.8; break;
                    case "invis": ballObj.invisible = true; setTimeout(() => ballObj.invisible=false,2000); break;
                    case "crazy": ballObj.crazy = true; setTimeout(() => ballObj.crazy=false,1500); break;
                    case "reverse": reverseControl = !reverseControl; setTimeout(() => reverseControl=false,4000); break;
                }
                powerUps = powerUps.filter(p => p.id !== pu.id);
                if (hapticEnabled) navigator.vibrate([20,40,20,40]);
            }
        }
        if (ballObj.crazy) { ballObj.vx += (Math.random()-0.5)*2; ballObj.vy += (Math.random()-0.5)*2; }
        if (ballObj.x + 18 < 0) { scores[1]++; ballObj.x = 450; ballObj.y = 300; ballObj.vx = 7; ballObj.vy = 4; }
        if (ballObj.x > 900) { scores[0]++; ballObj.x = 450; ballObj.y = 300; ballObj.vx = -7; ballObj.vy = 4; }
        updateScores();
        if (scores[0] >= 10 || scores[1] >= 10) {
            overlay.classList.remove('hidden');
            gameOverText.textContent = scores[0] > scores[1] ? "You Win!" : "AI Wins!";
        }
    }
    updateBall(ball); balls.forEach(updateBall);
    balls = balls.filter(b => b.x > 0 && b.x < 900);
}
restartBtn.onclick = () => location.reload();
