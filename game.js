const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const noteEl = document.getElementById("note");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

const W = 420;
const H = 760;
const roadTopWidth = 132;
const roadBottomWidth = 335;
const laneCount = 3;
const maxDpr = 2;

let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;

const notePool = [
  "missing you",
  "ciao bella",
  "ride safe cutie",
  "vespa vibes only",
  "you got this",
  "ti penso",
  "amorino speed",
];

const riderImg = new Image();
riderImg.src = "rider.png";

const game = {
  running: false,
  score: 0,
  best: Number(localStorage.getItem("italy-rider-best") || 0),
  speed: 4.8,
  spawnTimer: 0,
  spawnEvery: 850,
  laneOffset: 0,
  noteTimer: 0,
  player: {
    lane: 1,
    x: W / 2,
    y: H - 168,
    w: 100,
    h: 136,
  },
  vespas: [],
  lastTime: 0,
};

bestEl.textContent = game.best;

function updateCanvasDensity() {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function laneX(lane, y = H - 140) {
  const t = y / H;
  const roadW = roadTopWidth + (roadBottomWidth - roadTopWidth) * t;
  const leftEdge = W / 2 - roadW / 2;
  const laneW = roadW / laneCount;
  return leftEdge + laneW * (lane + 0.5);
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#80ccff");
  grad.addColorStop(0.6, "#c9ecff");
  grad.addColorStop(1, "#ffdca8");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stylized Italy city line and warm buildings.
  ctx.fillStyle = "#df8c51";
  ctx.fillRect(0, 235, W, 56);

  ctx.fillStyle = "#b86137";
  ctx.fillRect(26, 178, 42, 58);
  ctx.fillRect(84, 166, 46, 70);
  ctx.fillRect(146, 190, 30, 46);
  ctx.fillRect(188, 156, 58, 80);
  ctx.fillRect(264, 175, 50, 61);
  ctx.fillRect(326, 164, 62, 72);

  // Dome (Duomo-like)
  ctx.beginPath();
  ctx.arc(216, 156, 28, Math.PI, 0);
  ctx.fill();

  // Leaning tower hint
  ctx.save();
  ctx.translate(330, 160);
  ctx.rotate(-0.08);
  ctx.fillRect(-8, 0, 16, 68);
  ctx.restore();

  // Road
  const roadTopY = 248;
  const roadBottomY = H;
  ctx.fillStyle = "#2b2b35";
  ctx.beginPath();
  ctx.moveTo(W / 2 - roadTopWidth / 2, roadTopY);
  ctx.lineTo(W / 2 + roadTopWidth / 2, roadTopY);
  ctx.lineTo(W / 2 + roadBottomWidth / 2, roadBottomY);
  ctx.lineTo(W / 2 - roadBottomWidth / 2, roadBottomY);
  ctx.closePath();
  ctx.fill();

  // Shoulder colors (Italian flag touch)
  ctx.strokeStyle = "#2ea84e";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W / 2 - roadTopWidth / 2 - 3, roadTopY);
  ctx.lineTo(W / 2 - roadBottomWidth / 2 - 3, roadBottomY);
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(W / 2 - roadTopWidth / 2 + 3, roadTopY);
  ctx.lineTo(W / 2 - roadBottomWidth / 2 + 3, roadBottomY);
  ctx.stroke();

  ctx.strokeStyle = "#d93f3f";
  ctx.beginPath();
  ctx.moveTo(W / 2 + roadTopWidth / 2 + 3, roadTopY);
  ctx.lineTo(W / 2 + roadBottomWidth / 2 + 3, roadBottomY);
  ctx.stroke();

  // Lane dash animation
  ctx.strokeStyle = "#ece7ca";
  ctx.lineWidth = 4;
  for (let lane = 1; lane < laneCount; lane++) {
    for (let y = roadTopY + ((game.laneOffset + lane * 90) % 72) - 120; y < H; y += 72) {
      const y2 = y + 32;
      if (y2 < roadTopY) continue;
      ctx.beginPath();
      ctx.moveTo(laneX(lane - 0.01, y), y);
      ctx.lineTo(laneX(lane - 0.01, y2), y2);
      ctx.stroke();
    }
  }
}

function drawVespa(v) {
  const scale = 0.58 + (v.y / H) * 0.86;
  const w = 56 * scale;
  const h = 34 * scale;
  const x = v.x - w / 2;
  const y = v.y - h / 2;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = v.color;
  ctx.beginPath();
  ctx.roundRect(8 * scale, 6 * scale, 34 * scale, 16 * scale, 8 * scale);
  ctx.fill();

  ctx.fillRect(28 * scale, 2 * scale, 9 * scale, 8 * scale);

  ctx.fillStyle = "#1c1d24";
  ctx.beginPath();
  ctx.arc(10 * scale, 26 * scale, 7 * scale, 0, Math.PI * 2);
  ctx.arc(44 * scale, 26 * scale, 7 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffe18f";
  ctx.beginPath();
  ctx.arc(46 * scale, 10 * scale, 3.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRider() {
  const p = game.player;
  const targetX = laneX(p.lane);
  p.x += (targetX - p.x) * 0.3;

  if (riderImg.complete && riderImg.naturalWidth) {
    ctx.drawImage(riderImg, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
  } else {
    ctx.fillStyle = "#f9734d";
    ctx.beginPath();
    ctx.roundRect(p.x - 28, p.y - 56, 56, 92, 12);
    ctx.fill();
  }
}

function spawnVespa() {
  const lane = Math.floor(Math.random() * laneCount);
  const colors = ["#7fb8ff", "#ff7f8b", "#7adeb3", "#ffd166"];
  game.vespas.push({
    lane,
    x: laneX(lane, 280),
    y: 266,
    speed: game.speed + Math.random() * 1.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  });
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function showNote() {
  const msg = notePool[Math.floor(Math.random() * notePool.length)];
  noteEl.textContent = msg;
  noteEl.classList.add("show");
  setTimeout(() => noteEl.classList.remove("show"), 1400);
}

function update(dtMs) {
  const dt = dtMs / 16.67;
  game.laneOffset += game.speed * dt * 2.7;
  game.score += game.speed * dt * 0.55;
  scoreEl.textContent = Math.floor(game.score);

  game.spawnTimer += dtMs;
  game.noteTimer += dtMs;

  if (game.spawnTimer >= game.spawnEvery) {
    spawnVespa();
    game.spawnTimer = 0;
    game.spawnEvery = Math.max(470, 890 - game.score * 0.75);
  }

  if (game.noteTimer >= 3000) {
    showNote();
    game.noteTimer = 0;
  }

  game.speed = Math.min(11.2, 4.8 + game.score / 160);

  for (let i = game.vespas.length - 1; i >= 0; i--) {
    const v = game.vespas[i];
    v.y += v.speed * dt;
    v.x = laneX(v.lane, v.y);

    const riderBox = {
      x: game.player.x - 30,
      y: game.player.y - 45,
      w: 60,
      h: 90,
    };

    const vespaBox = {
      x: v.x - 22,
      y: v.y - 15,
      w: 44,
      h: 30,
    };

    if (intersects(riderBox, vespaBox)) {
      endGame();
      return;
    }

    if (v.y > H + 90) {
      game.vespas.splice(i, 1);
    }
  }
}

function draw() {
  drawBackground();
  game.vespas.forEach(drawVespa);
  drawRider();
}

function loop(ts) {
  if (!game.running) return;
  const dtMs = Math.min(32, ts - game.lastTime || 16);
  game.lastTime = ts;
  update(dtMs);
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  game.running = true;
  game.score = 0;
  game.speed = 4.8;
  game.spawnTimer = 0;
  game.spawnEvery = 850;
  game.laneOffset = 0;
  game.noteTimer = 0;
  game.player.lane = 1;
  game.player.x = laneX(1);
  game.vespas = [];
  scoreEl.textContent = "0";
  overlay.classList.add("hidden");
  noteEl.classList.remove("show");
  game.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame() {
  game.running = false;
  const result = Math.floor(game.score);
  if (result > game.best) {
    game.best = result;
    localStorage.setItem("italy-rider-best", String(result));
    bestEl.textContent = result;
  }

  overlay.classList.remove("hidden");
  overlay.querySelector("h2").textContent = "Crash!";
  overlay.querySelector("p").innerHTML = `You rode <strong>${result} m</strong>. Tap to try again.`;
  startBtn.textContent = "Ride Again";
}

function moveLane(dir) {
  if (!game.running) return;
  game.player.lane = Math.max(0, Math.min(laneCount - 1, game.player.lane + dir));
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
    e.preventDefault();
    moveLane(-1);
  } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
    e.preventDefault();
    moveLane(1);
  }
});

leftBtn.addEventListener("click", () => moveLane(-1));
rightBtn.addEventListener("click", () => moveLane(1));
startBtn.addEventListener("click", startGame);

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  touchActive = true;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
});

canvas.addEventListener("pointerup", (e) => {
  if (!touchActive || e.pointerType === "mouse" || !game.running) return;
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;
  const swipeThreshold = 24;

  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= swipeThreshold) {
    moveLane(dx > 0 ? 1 : -1);
  } else {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    moveLane(x < rect.width / 2 ? -1 : 1);
  }

  touchActive = false;
  e.preventDefault();
});

canvas.addEventListener("pointercancel", () => {
  touchActive = false;
});

window.addEventListener("resize", () => {
  updateCanvasDensity();
  draw();
});

// First render so the scene is visible before start.
updateCanvasDensity();
draw();
