export const MAP = [
  "#####################",
  "#o........#........o#",
  "#.###.###.#.###.###.#",
  "#.###.###.#.###.###.#",
  "#...................#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "#####.### # ###.#####",
  "    #.#       #.#    ",
  "#####.# ##=## #.#####",
  "     .  #   #  .     ",
  "#####.# ##### #.#####",
  "    #.#       #.#    ",
  "#####.# ##### #.#####",
  "#.........#.........#",
  "#.###.###.#.###.###.#",
  "#o..#..... .....#..o#",
  "###.#.#.#####.#.#.###",
  "#.....#...#...#.....#",
  "#.#######.#.#######.#",
  "#...................#",
  "#####################",
];
export const W = 21,
  H = 22;
export type Dir = 0 | 1 | 2 | 3;
export const V = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export type Actor = {
  x: number;
  y: number;
  dir: Dir;
  fromX: number;
  fromY: number;
  progress: number;
  moving: boolean;
};
export type Ghost = Actor & {
  name: string;
  color: string;
  home: [number, number];
  eaten: boolean;
  release: number;
};
export type Phase = "ready" | "playing" | "paused" | "dead" | "won" | "over";
const actor = (x: number, y: number, dir: Dir): Actor => ({
  x,
  y,
  dir,
  fromX: x,
  fromY: y,
  progress: 0,
  moving: false,
});
export function passable(x: number, y: number, ghost = false) {
  return (
    y >= 0 &&
    y < H &&
    (x < 0 || x >= W
      ? y === 10
      : MAP[y][x] !== "#" && (ghost || MAP[y][x] !== "="))
  );
}
export function neighbor(x: number, y: number, d: Dir) {
  return [(x + V[d][0] + W) % W, y + V[d][1]] as [number, number];
}
export function position(a: Actor) {
  let dx = a.x - a.fromX;
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  return {
    x: a.moving ? a.fromX + dx * a.progress : a.x,
    y: a.moving ? a.fromY + (a.y - a.fromY) * a.progress : a.y,
  };
}
export class Game {
  player = actor(10, 16, 2);
  ghosts: Ghost[] = [];
  pellets = new Map<string, string>();
  score = 0;
  lives = 3;
  phase: Phase = "ready";
  queued: Dir = 2;
  time = 0;
  fright = 0;
  combo = 0;
  deathTimer = 0;
  mode = "scatter";
  onEvent: (kind: string, x: number, y: number, value?: number) => void =
    () => {};
  constructor() {
    this.reset();
  }
  reset() {
    this.score = 0;
    this.lives = 3;
    this.pellets.clear();
    MAP.forEach((r, y) =>
      [...r].forEach((c, x) => {
        if (c === "." || c === "o") this.pellets.set(`${x},${y}`, c);
      }),
    );
    this.spawn();
    this.phase = "ready";
  }
  spawn() {
    this.player = actor(10, 16, 2);
    this.queued = 2;
    this.fright = 0;
    this.time = 0;
    this.mode = "scatter";
    this.ghosts = [
      ["Blinky", "#f07869", 10, 8, 0, [19, 1]],
      ["Pinky", "#f0a8cd", 9, 10, 2, [1, 1]],
      ["Inky", "#78d9d3", 10, 10, 5, [19, 20]],
      ["Clyde", "#efb56b", 11, 10, 8, [1, 20]],
    ].map(([name, color, x, y, release, home]) => ({
      ...actor(x as number, y as number, 3),
      name: name as string,
      color: color as string,
      home: home as [number, number],
      release: release as number,
      eaten: false,
    }));
  }
  turn(d: Dir) {
    this.queued = d;
  }
  toggle() {
    if (this.phase === "playing") this.phase = "paused";
    else if (this.phase === "ready" || this.phase === "paused")
      this.phase = "playing";
  }
  move(
    a: Actor,
    dt: number,
    speed: number,
    choose: () => Dir | null,
    arrive: () => void,
  ) {
    let remaining = dt * speed;
    while (remaining > 0) {
      if (!a.moving) {
        const d = choose();
        if (d === null) break;
        const [nx, ny] = neighbor(a.x, a.y, d);
        if (!passable(nx, ny, a !== this.player)) break;
        a.dir = d;
        a.fromX = a.x;
        a.fromY = a.y;
        a.x = nx;
        a.y = ny;
        a.progress = 0;
        a.moving = true;
      }
      const step = Math.min(remaining, 1 - a.progress);
      a.progress += step;
      remaining -= step;
      if (a.progress >= 1 - 1e-9) {
        a.moving = false;
        a.progress = 0;
        arrive();
        if (this.phase !== "playing") break;
      }
    }
  }
  consume() {
    const p = this.player,
      key = `${p.x},${p.y}`,
      c = this.pellets.get(key);
    if (!c) return;
    this.pellets.delete(key);
    this.score += c === "o" ? 50 : 10;
    this.onEvent(c === "o" ? "power" : "pellet", p.x, p.y);
    if (c === "o") {
      this.fright = 7;
      this.combo = 0;
    }
    if (!this.pellets.size) {
      this.phase = "won";
      this.onEvent("win", p.x, p.y);
    }
  }
  chooseGhost(g: Ghost): Dir | null {
    const opts = ([0, 1, 2, 3] as Dir[]).filter((d) => {
      const [x, y] = neighbor(g.x, g.y, d);
      return (
        passable(x, y, true) && !(MAP[y]?.[x] === "=" && !g.eaten && g.y < 9)
      );
    });
    const forward = opts.filter((d) => d !== (g.dir + 2) % 4);
    const choices = forward.length ? forward : opts;
    if (!choices.length) return null;
    if (this.fright > 0 && !g.eaten)
      return choices[Math.floor(Math.random() * choices.length)];
    let target: [number, number] = g.home;
    if (g.eaten) target = [10, 10];
    else if ((g.y === 10 && g.x >= 9 && g.x <= 11) || g.y === 9)
      target = [10, 8];
    else if (this.mode === "chase") {
      const p = this.player,
        [dx, dy] = V[p.dir];
      if (g.name === "Blinky") target = [p.x, p.y];
      if (g.name === "Pinky") target = [p.x + dx * 4, p.y + dy * 4];
      if (g.name === "Inky")
        target = [
          2 * (p.x + dx * 2) - this.ghosts[0].x,
          2 * (p.y + dy * 2) - this.ghosts[0].y,
        ];
      if (g.name === "Clyde")
        target = Math.hypot(g.x - p.x, g.y - p.y) > 8 ? [p.x, p.y] : g.home;
    }
    // Shortest-path routing preserves personalities while avoiding dead ends near the house.
    const distance = new Map<string, number>();
    const queue: [[number, number], number][] = [];
    let best: [number, number] = [1, 1],
      bd = Infinity;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (passable(x, y, true)) {
          const d = (x - target[0]) ** 2 + (y - target[1]) ** 2;
          if (d < bd) {
            bd = d;
            best = [x, y];
          }
        }
    queue.push([best, 0]);
    distance.set(best.join(","), 0);
    for (let i = 0; i < queue.length; i++) {
      const [[x, y], n] = queue[i];
      for (let d = 0; d < 4; d++) {
        const [nx, ny] = neighbor(x, y, d as Dir),
          k = `${nx},${ny}`;
        if (passable(nx, ny, true) && !distance.has(k)) {
          distance.set(k, n + 1);
          queue.push([[nx, ny], n + 1]);
        }
      }
    }
    return choices.sort(
      (a, b) =>
        (distance.get(neighbor(g.x, g.y, a).join(",")) ?? 999) -
        (distance.get(neighbor(g.x, g.y, b).join(",")) ?? 999),
    )[0];
  }
  update(dt: number) {
    if (this.phase === "dead") {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives <= 0) this.phase = "over";
        else {
          this.spawn();
          this.phase = "ready";
        }
      }
      return;
    }
    if (this.phase !== "playing") return;
    this.time += dt;
    this.fright = Math.max(0, this.fright - dt);
    this.mode = this.time % 27 < 7 ? "scatter" : "chase";
    this.move(
      this.player,
      dt,
      6.4,
      () => {
        const p = this.player;
        const can = (d: Dir) => passable(...neighbor(p.x, p.y, d));
        return can(this.queued) ? this.queued : can(p.dir) ? p.dir : null;
      },
      () => this.consume(),
    );
    if (this.phase !== "playing") return;
    for (const g of this.ghosts) {
      if (this.time < g.release) continue;
      this.move(
        g,
        dt,
        g.eaten ? 10 : this.fright ? 3.6 : 4.8,
        () => this.chooseGhost(g),
        () => {
          if (g.eaten && g.x === 10 && g.y === 10) {
            g.eaten = false;
            g.release = this.time + 1;
          }
        },
      );
      const a = position(this.player),
        b = position(g);
      const dx = Math.abs(a.x - b.x);
      if (Math.hypot(Math.min(dx, W - dx), a.y - b.y) < 0.68 && !g.eaten) {
        if (this.fright) {
          g.eaten = true;
          const value = 200 * 2 ** Math.min(this.combo++, 3);
          this.score += value;
          this.onEvent("ghost", b.x, b.y, value);
        } else {
          this.lives--;
          this.phase = "dead";
          this.deathTimer = 1.4;
          this.onEvent("death", a.x, a.y);
          break;
        }
      }
    }
  }
}
