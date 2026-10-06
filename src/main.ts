import "./style.css";
import { Game, MAP, W, H, position, type Dir } from "./engine";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<main class="arcade" aria-label="Pac-Man arcade">
  <aside class="left-panel" aria-label="Your run">
    <a class="wordmark" href="./" aria-label="After Hours home"><span class="brand-icon">◕</span><span>AFTER<br>HOURS</span></a>
    <div class="score-block"><span>SCORE</span><strong id="score">000000</strong></div>
    <div class="best-block"><span>BEST</span><strong id="best">000000</strong></div>
    <div class="stat-line level"><span>LEVEL</span><b>01</b></div>
    <div class="stat-line lives"><span>LIVES</span><div id="lives" aria-label="3 lives">◕ ◕ ◕</div></div>
    <div class="progress"><div class="progress-title"><span>MAZE CLEARED</span><b id="percent">0%</b></div><div class="progress-track"><div id="progress"></div></div></div>
    <div class="run-note"><span class="live-dot"></span><span id="status">READY WHEN YOU ARE</span></div>
  </aside>
  <section class="game-zone" aria-label="Game screen">
    <div class="cabinet">
      <div class="cabinet-header"><span><i class="live-dot"></i> PAC-MAN <small>REIMAGINED</small></span><button id="pause" aria-label="Pause game">Ⅱ <span>PAUSE</span></button></div>
      <div class="screen"><canvas id="game" aria-label="Pac-Man maze. Use arrow keys, WASD, or swipe to move." tabindex="0"></canvas><div class="overlay" id="overlay"><span id="overlay-kicker">LEVEL 01 · AFTER DARK</span><h2 id="overlay-title">Ready to<br><em>make a run?</em></h2><p id="overlay-copy">The maze is yours. Make every dot count.</p><button id="play" class="play-button">LET’S PLAY <span>→</span></button><small id="overlay-hint">PRESS ENTER TO START</small></div></div>
      <div class="cabinet-footer"><span class="live-dot"></span><b id="mode">STANDING BY</b></div>
    </div>
  </section>
  <aside class="right-panel" aria-label="The playbook">
    <div class="intro"><span class="eyebrow">PAC-MAN REIMAGINED</span><h1>Same chase.<br><em>New energy.</em></h1></div>
    <div class="instruction"><div class="keys" aria-hidden="true"><kbd>↑</kbd><div><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div><h2>Find your flow.</h2><p>Arrow keys or <b>W A S D</b> to move.<br>Queue your next turn early.</p><p>Dots: 10 pts · Energizers: 50 pts<br>Eat blue ghosts for a bonus.</p></div>
    <div class="shortcuts"><span><kbd>P</kbd> Pause</span><span><kbd>M</kbd> Sound</span></div>
  </aside>
  <section class="control-zone" aria-label="Game controls">
    <div class="mobile-controls" role="group" aria-label="Directional pad">
      <button data-dir="3" aria-label="Move up">↑</button><button data-dir="2" aria-label="Move left">←</button><button data-dir="0" aria-label="Move right">→</button><button data-dir="1" aria-label="Move down">↓</button>
    </div>
  </section>
  <div class="actions"><button id="sound" aria-label="Enable sound" aria-pressed="false">♪ <span>SOUND OFF</span></button><button id="restart" aria-label="Restart run">↻ <span>RESTART RUN</span></button></div>
</main>`;
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
// Fit the entire cabinet, including its chrome, into its allocated grid cell.
function resize() {
  const zone = $(".game-zone");
  const chrome = $(".cabinet-header").offsetHeight + $(".cabinet-footer").offsetHeight + 2;
  const width = Math.max(1, Math.min(zone.clientWidth - 2, (zone.clientHeight - chrome) * CW / CH));
  $(".cabinet").style.width = `${width + 2}px`;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(width * CH / CW * dpr);
  ctx.setTransform(canvas.width / CW, 0, 0, canvas.height / CH, 0, 0);
}
new ResizeObserver(resize).observe($(".game-zone"));
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);
resize();
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
let touch: { id: number; x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  if (touch || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  if (Math.hypot(dx, dy) > 12) {
    game.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);
    touch.x = e.clientX;
    touch.y = e.clientY;
  }
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
  canvas.addEventListener(event, (e) => {
    if (touch?.id === e.pointerId) touch = null;
  });
}
const dpad = $(".mobile-controls");
const directionButtons = Array.from(dpad.querySelectorAll<HTMLButtonElement>("[data-dir]"));
let padContact: { kind: "touch" | "pointer"; id: number } | null = null;
let padDirection: Dir | null = null;
function releasePad() {
  padContact = null;
  padDirection = null;
  directionButtons.forEach((button) => button.classList.remove("pressed"));
}
function steerPad(clientX: number, clientY: number) {
  const bounds = dpad.getBoundingClientRect();
  // Normalize each axis so the four sectors match a stretched cross as well.
  const x = (clientX - bounds.left) / bounds.width - 0.5;
  const y = (clientY - bounds.top) / bounds.height - 0.5;
  // The exact center retains the current direction; a fresh center press goes up.
  const direction: Dir = x === 0 && y === 0
    ? padDirection ?? 3
    : Math.abs(x) > Math.abs(y) ? (x > 0 ? 0 : 2) : y > 0 ? 1 : 3;
  if (direction === padDirection) return;
  padDirection = direction;
  directionButtons.forEach((button) => {
    button.classList.toggle("pressed", Number(button.dataset.dir) === direction);
  });
  game.turn(direction);
  navigator.vibrate?.(12);
}
// Listen on the whole pad, including its center and corners. Touch events stay
// targeted at their starting element even when the thumb slides to another wing.
dpad.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (padContact) return;
  const contact = e.changedTouches[0];
  if (!contact) return;
  padContact = { kind: "touch", id: contact.identifier };
  steerPad(contact.clientX, contact.clientY);
}, { passive: false });
dpad.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (padContact?.kind !== "touch") return;
  const contact = Array.from(e.touches).find((item) => item.identifier === padContact?.id);
  if (contact) steerPad(contact.clientX, contact.clientY);
}, { passive: false });
for (const event of ["touchend", "touchcancel"] as const) {
  dpad.addEventListener(event, (e) => {
    if (padContact?.kind === "touch" &&
      Array.from(e.changedTouches).some((item) => item.identifier === padContact?.id)) releasePad();
  });
}
dpad.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && "ontouchstart" in window) return;
  if (padContact || e.button !== 0) return;
  e.preventDefault();
  padContact = { kind: "pointer", id: e.pointerId };
  dpad.setPointerCapture(e.pointerId);
  steerPad(e.clientX, e.clientY);
});
dpad.addEventListener("pointermove", (e) => {
  if (padContact?.kind === "pointer" && padContact.id === e.pointerId) {
    steerPad(e.clientX, e.clientY);
  }
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
  dpad.addEventListener(event, (e) => {
    if (padContact?.kind === "pointer" && padContact.id === e.pointerId) releasePad();
  });
}
directionButtons.forEach((button) => {
  // Preserve native keyboard and assistive-technology activation.
  button.addEventListener("click", (e) => {
    if (e.detail === 0) game.turn(Number(button.dataset.dir) as Dir);
  });
});
dpad.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", releasePad);
window.addEventListener("resize", releasePad);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releasePad();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
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
