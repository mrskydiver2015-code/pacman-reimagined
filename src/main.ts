import "./style.css";
import { Game, MAP, W, H, position, type Dir } from "./engine";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header class="topbar"><a class="wordmark" href="./" aria-label="After Hours home"><span class="brand-icon">◕</span> AFTER HOURS<span class="edition">ARCADE COLLECTION / 001</span></a><div class="top-right"><span class="live-dot"></span> INSERT A LITTLE NOSTALGIA <button id="sound" class="icon-button" aria-label="Enable sound" aria-pressed="false">♪ <span>SOUND OFF</span></button></div></header>
<main><section class="intro"><div><div class="eyebrow"><span></span> THE CLASSICS, RECHARGED</div><h1>Same chase.<br><em>New energy.</em></h1><p>A familiar maze. A different kind of midnight.<br>Chase the dots. Dodge the ghosts. Own the night.</p></div><div class="level-badge"><span>01</span><div>THE ORIGINAL MAZE<small>REIMAGINED IN NEON</small></div></div></section>
<section class="arcade" aria-label="Pac-Man arcade"><aside class="left-panel"><div class="section-label">YOUR RUN <span>↗</span></div><div class="score-block"><span>SCORE</span><strong id="score">000000</strong></div><div class="best-block"><span>PERSONAL BEST</span><strong id="best">000000</strong></div><div class="rule"></div><div class="stat-line"><span>LEVEL</span><b>01 <small>/ THE BEGINNING</small></b></div><div class="stat-line"><span>LIVES</span><div id="lives" aria-label="3 lives">◕ ◕ ◕</div></div><div class="progress-title"><span>MAZE CLEARED</span><b id="percent">0%</b></div><div class="progress-track"><div id="progress"></div></div><div class="run-note"><span class="live-dot"></span><span id="status">READY WHEN YOU ARE</span></div><div class="mini-card"><span>THE NIGHT IS YOUNG.</span><p>One more pellet.<br>One more personal best.</p><div class="mini-maze">┏━━┓ ┏━━━━┓<br>┃ ┏┛ ┗━┓ ┃<br>┗━┛ ◕ · · ┃</div></div></aside>
<div class="cabinet"><div class="cabinet-header"><span><i></i> PAC-MAN <small>REIMAGINED</small></span><button id="pause" aria-label="Pause game">Ⅱ <span>PAUSE</span></button></div><div class="screen"><canvas id="game" aria-label="Pac-Man maze. Use arrow keys or WASD to move." tabindex="0"></canvas><div class="overlay" id="overlay"><span id="overlay-kicker">LEVEL 01 · AFTER DARK</span><h2 id="overlay-title">Ready to<br><em>make a run?</em></h2><p id="overlay-copy">The maze is yours. Make every dot count.</p><button id="play" class="play-button">LET’S PLAY <span>→</span></button><small id="overlay-hint">PRESS ENTER TO START</small></div></div><div class="cabinet-footer"><span><i class="live-dot"></i> <b id="mode">STANDING BY</b></span><span>HIGH SCORES. LOW LIGHTS.</span></div></div>
<aside class="right-panel"><div class="section-label">THE PLAYBOOK <span>↙</span></div><div class="instruction"><div class="keys"><kbd>↑</kbd><div><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div><h3>Find your flow.</h3><p>Arrow keys or <b>W A S D</b> to move.<br>Queue your next turn early.</p></div><div class="legend"><div><i class="pellet-icon"></i><span>Small bites.<small>10 PTS / PELLET</small></span></div><div><i class="power-icon"></i><span>Big energy.<small>50 PTS / ENERGIZER</small></span></div><div><i class="ghost-icon"></i><span>Turn the tables.<small>EAT BLUE GHOSTS FOR BONUS</small></span></div></div><div class="rule"></div><div class="tip"><span>✳ A LITTLE INSIDE KNOWLEDGE</span><p>They each have a plan.<br>Keep them guessing.</p></div><div class="shortcuts"><span><kbd>P</kbd> Pause</span><span><kbd>M</kbd> Sound</span></div><button class="restart" id="restart">↻ &nbsp; RESTART RUN</button></aside></section>
<div class="mobile-controls" aria-label="Touch controls"><button data-dir="2" aria-label="Move left">←</button><div><button data-dir="3" aria-label="Move up">↑</button><button data-dir="1" aria-label="Move down">↓</button></div><button data-dir="0" aria-label="Move right">→</button><p>SWIPE THE MAZE<br>OR TAP TO TURN</p></div>
<footer><span>BUILT FOR THE LOVE OF THE GAME.</span><span class="footer-center">NO COINS. JUST GOOD TIMES. <i>✳</i></span><span>A CLASSIC NEVER CLOCKS OUT. ↗</span></footer></main>`;
const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const canvas = $("#game") as HTMLCanvasElement,
  ctx = canvas.getContext("2d")!;
const T = 24,
  PAD = 20,
  CW = W * T + PAD * 2,
  CH = H * T + PAD * 2;
let audio: AudioContext | undefined,
  sound = false,
  best = 0;
try {
  best = Number(localStorage.getItem("after-hours-best")) || 0;
} catch {}
function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  delay = 0,
) {
  if (!sound || !audio) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audio.currentTime + delay);
  o.frequency.exponentialRampToValueAtTime(
    freq * 0.55,
    audio.currentTime + delay + duration,
  );
  g.gain.setValueAtTime(0.045, audio.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(
    0.001,
    audio.currentTime + delay + duration,
  );
  o.connect(g);
  g.connect(audio.destination);
  o.start(audio.currentTime + delay);
  o.stop(audio.currentTime + delay + duration);
}
function unlock() {
  if (!audio) audio = new AudioContext();
  void audio.resume();
}
function toggleSound() {
  unlock();
  sound = !sound;
  $("#sound").innerHTML =
    `${sound ? "♫" : "♪"} <span>SOUND ${sound ? "ON" : "OFF"}</span>`;
  $("#sound").setAttribute("aria-label", sound ? "Mute sound" : "Enable sound");
  $("#sound").setAttribute("aria-pressed", String(sound));
  if (sound) tone(660, 0.15);
}
const game = new Game(),
  total = game.pellets.size;
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
let particles: Particle[] = [],
  labels: { x: number; y: number; text: string; life: number }[] = [];
let shake = 0;
game.onEvent = (kind, x, y, value) => {
  const power = kind === "power";
  if (kind === "pellet" || power || kind === "ghost") {
    for (let i = 0; i < (power ? 24 : kind === "ghost" ? 18 : 4); i++) {
      const a = Math.random() * Math.PI * 2,
        s = power ? 65 : 30;
      particles.push({
        x: (x + 0.5) * T,
        y: (y + 0.5) * T,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: power ? 0.8 : 0.35,
        color: kind === "ghost" ? "#83e4dc" : "#f8dc87",
      });
    }
    tone(
      power ? 880 : kind === "ghost" ? 1046 : game.pellets.size % 2 ? 420 : 540,
      power ? 0.35 : 0.07,
    );
    if (value)
      labels.push({
        x: (x + 0.5) * T,
        y: (y + 0.5) * T,
        text: `+${value}`,
        life: 1.2,
      });
  }
  if (kind === "death") {
    shake = 0.4;
    tone(150, 0.65, "sawtooth");
  }
  if (kind === "win") {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone(f, 0.25, "triangle", i * 0.12),
    );
  }
};
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);
function start() {
  unlock();
  if (game.phase === "won" || game.phase === "over") {
    game.reset();
    particles = [];
  }
  if (game.phase === "ready" || game.phase === "paused") game.toggle();
  canvas.focus({ preventScroll: true });
}
$("#play").onclick = start;
$("#pause").onclick = () => game.toggle();
$("#sound").onclick = toggleSound;
$("#restart").onclick = () => {
  game.reset();
  particles = [];
  labels = [];
  canvas.focus({ preventScroll: true });
};
const keyDirs: Record<string, Dir> = {
  ArrowRight: 0,
  d: 0,
  ArrowDown: 1,
  s: 1,
  ArrowLeft: 2,
  a: 2,
  ArrowUp: 3,
  w: 3,
};
window.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in keyDirs) {
    e.preventDefault();
    game.turn(keyDirs[k]);
  } else if (
    k === "Enter" &&
    !(document.activeElement instanceof HTMLButtonElement)
  ) {
    e.preventDefault();
    start();
  } else if (
    (k === "p" || k === " ") &&
    !e.repeat &&
    !(document.activeElement instanceof HTMLButtonElement && k === " ")
  ) {
    e.preventDefault();
    game.toggle();
  } else if (k === "m" && !e.repeat) toggleSound();
});
let touch: [number, number] | null = null;
canvas.addEventListener("pointerdown", (e) => {
  touch = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!touch) return;
  const dx = e.clientX - touch[0],
    dy = e.clientY - touch[1];
  if (Math.hypot(dx, dy) > 12) {
    game.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
    touch = [e.clientX, e.clientY];
  }
});
canvas.addEventListener("pointerup", () => (touch = null));
canvas.addEventListener("pointercancel", () => (touch = null));
document.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach(
  (b) =>
    (b.onpointerdown = (e) => {
      e.preventDefault();
      game.turn(Number(b.dataset.dir) as Dir);
    }),
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.phase === "playing") game.toggle();
});
window.addEventListener("blur", () => {
  if (game.phase === "playing") game.toggle();
});
function circle(x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function ghost(
  x: number,
  y: number,
  color: string,
  dir: Dir,
  eaten: boolean,
  fright: boolean,
  t: number,
) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 5 + x) * 1.1);
  if (!eaten) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = fright ? 10 : 7;
    ctx.beginPath();
    ctx.arc(0, -1, 9, Math.PI, 0);
    ctx.lineTo(9, 9);
    for (let i = 3; i >= -3; i--) ctx.lineTo(i * 3, 7 + (i % 2 === 0 ? 2 : 0));
    ctx.lineTo(-9, -1);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (fright && !eaten) {
    circle(-3, -1, 1.4, "#fff");
    circle(3, -1, 1.4, "#fff");
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    for (let i = 0; i < 6; i++) ctx.lineTo(-5 + i * 2, 4 + (i % 2) * 2);
    ctx.stroke();
  } else {
    const offsets = [
      [2, 0],
      [0, 2],
      [-2, 0],
      [0, -2],
    ][dir];
    for (const ex of [-4, 4]) {
      ctx.fillStyle = "#f5faf9";
      ctx.beginPath();
      ctx.ellipse(ex, -2, 3.5, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ex + offsets[0], -2 + offsets[1], 1.8, "#152c3b");
    }
  }
  ctx.restore();
}
function draw(t: number, dt: number) {
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = "#080f15";
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.translate(PAD + (shake ? Math.sin(t * 90) * shake * 6 : 0), PAD);
  shake = Math.max(0, shake - dt);
  // Only trace exposed wall faces: connected blocks become a continuous architectural maze.
  ctx.fillStyle = "#0d2029";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (MAP[y][x] === "#") ctx.fillRect(x * T, y * T, T, T);
  ctx.strokeStyle = "#347f94";
  ctx.lineWidth = 1.6;
  ctx.shadowColor = "#299ebb";
  ctx.shadowBlur = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (MAP[y][x] === "#") {
        const l = x * T,
          r = l + T,
          u = y * T,
          b = u + T;
        if (y > 0 && MAP[y - 1][x] !== "#") {
          ctx.moveTo(l + 2, u + 2);
          ctx.lineTo(r - 2, u + 2);
        }
        if (y < H - 1 && MAP[y + 1][x] !== "#") {
          ctx.moveTo(l + 2, b - 2);
          ctx.lineTo(r - 2, b - 2);
        }
        if (x > 0 && MAP[y][x - 1] !== "#") {
          ctx.moveTo(l + 2, u + 2);
          ctx.lineTo(l + 2, b - 2);
        }
        if (x < W - 1 && MAP[y][x + 1] !== "#") {
          ctx.moveTo(r - 2, u + 2);
          ctx.lineTo(r - 2, b - 2);
        }
      }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#eda9c9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10 * T + 2, 9 * T + T / 2);
  ctx.lineTo(11 * T - 2, 9 * T + T / 2);
  ctx.stroke();
  for (const [key, type] of game.pellets) {
    const [x, y] = key.split(",").map(Number);
    if (type === "o") {
      ctx.shadowColor = "#f7dfa0";
      ctx.shadowBlur = 14;
      circle(
        (x + 0.5) * T,
        (y + 0.5) * T,
        5 + Math.sin(t * 4) * 0.7,
        "#ffe6a9",
      );
      ctx.shadowBlur = 0;
    } else circle((x + 0.5) * T, (y + 0.5) * T, 2.1, "#c8bca2");
  }
  const p = position(game.player),
    px = (p.x + 0.5) * T,
    py = (p.y + 0.5) * T;
  if (game.phase !== "dead" || game.deathTimer > 0.15) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((game.player.dir * Math.PI) / 2);
    const mouth =
      game.phase === "dead"
        ? Math.min(Math.PI, (1.4 - game.deathTimer) * 2.5)
        : 0.12 + Math.abs(Math.sin(t * 11)) * 0.38;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#f3cc57";
    ctx.fillStyle = "#f9d56b";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 9.6, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const g of game.ghosts) {
    const p = position(g);
    const frightened = game.fright > 0 && !g.eaten;
    const color = frightened
      ? game.fright < 2 && Math.floor(t * 7) % 2
        ? "#d9e7e9"
        : "#567ad8"
      : g.color;
    ghost(
      (p.x + 0.5) * T,
      (p.y + 0.5) * T,
      color,
      g.dir,
      g.eaten,
      frightened,
      t,
    );
  }
  const animate = game.phase !== "paused";
  for (const p of particles) {
    if (animate) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    ctx.globalAlpha = Math.max(0, p.life * 2);
    circle(p.x, p.y, 1.5, p.color);
  }
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => p.life > 0);
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  for (const l of labels) {
    if (animate) {
      l.life -= dt;
      l.y -= dt * 16;
    }
    ctx.fillStyle = "#f9df94";
    ctx.globalAlpha = Math.min(1, Math.max(0, l.life));
    ctx.fillText(l.text, l.x, l.y);
  }
  labels = labels.filter((l) => l.life > 0);
  ctx.globalAlpha = 1;
  ctx.restore();
}
let previousPhase = "",
  last = 0,
  accumulator = 0;
function ui() {
  if (game.score > best) {
    best = game.score;
    try {
      localStorage.setItem("after-hours-best", String(best));
    } catch {}
  }
  $("#score").textContent = String(game.score).padStart(6, "0");
  $("#best").textContent = String(best).padStart(6, "0");
  $("#lives").textContent =
    "◕ ".repeat(game.lives) + "· ".repeat(3 - game.lives);
  $("#lives").setAttribute("aria-label", `${game.lives} lives`);
  const percent = Math.round((1 - game.pellets.size / total) * 100);
  $("#percent").textContent = `${percent}%`;
  $("#progress").style.width = `${percent}%`;
  $("#status").textContent =
    game.phase === "playing"
      ? game.fright
        ? "THE TABLES HAVE TURNED"
        : "MAKE EVERY DOT COUNT"
      : game.phase === "dead"
        ? "TAKE A BREATH."
        : "READY WHEN YOU ARE";
  $("#mode").textContent =
    game.phase === "playing"
      ? game.fright
        ? `POWER UP · ${Math.ceil(game.fright)}s`
        : game.mode === "chase"
          ? "THE CHASE IS ON"
          : "GHOSTS ON PATROL"
      : game.phase === "paused"
        ? "ON A BREAK"
        : "STANDING BY";
  $("#pause").setAttribute(
    "aria-label",
    game.phase === "paused" ? "Resume game" : "Pause game",
  );
  $("#pause").innerHTML =
    game.phase === "paused" ? "▷ <span>RESUME</span>" : "Ⅱ <span>PAUSE</span>";
  if (previousPhase === game.phase) return;
  previousPhase = game.phase;
  const show = ["ready", "paused", "won", "over"].includes(game.phase);
  $("#overlay").classList.toggle("hidden", !show);
  const content =
    game.phase === "paused"
      ? [
          "TIME OUT",
          "Catch your<br><em>breath.</em>",
          "Your run will be right here.",
          "KEEP GOING",
          "PRESS P TO RESUME",
        ]
      : game.phase === "won"
        ? [
            "MAZE COMPLETE",
            "Night.<br><em>Conquered.</em>",
            `${game.score.toLocaleString()} points. Every last dot. Beautifully done.`,
            "PLAY AGAIN",
            "A FRESH MAZE, A NEW PERSONAL BEST",
          ]
        : game.phase === "over"
          ? [
              "END OF THE RUN",
              "One more<br><em>after hours?</em>",
              `${game.score.toLocaleString()} points. The maze is calling you back.`,
              "TRY AGAIN",
              "PRESS ENTER TO RESTART",
            ]
          : [
              "LEVEL 01 · AFTER DARK",
              game.lives < 3
                ? "Back for<br><em>another bite?</em>"
                : "Ready to<br><em>make a run?</em>",
              "The maze is yours. Make every dot count.",
              "LET’S PLAY",
              "PRESS ENTER TO START",
            ];
  $("#overlay-kicker").textContent = content[0];
  $("#overlay-title").innerHTML = content[1];
  $("#overlay-copy").textContent = content[2];
  $("#play").innerHTML = `${content[3]} <span>→</span>`;
  $("#overlay-hint").textContent = content[4];
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000 || 0, 0.05);
  last = now;
  accumulator += dt;
  while (accumulator >= 1 / 120) {
    game.update(1 / 120);
    accumulator -= 1 / 120;
  }
  draw(now / 1000, dt);
  ui();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
