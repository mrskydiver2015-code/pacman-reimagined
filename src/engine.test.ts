import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, MAP, W, H, passable, neighbor, position } from "./engine";

test("maze is rectangular and every collectible is reachable from spawn", () => {
  assert.equal(MAP.length, H);
  for (const row of MAP) assert.equal(row.length, W);
  const seen = new Set(["10,16"]),
    queue: [[number, number]] = [[10, 16]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const d of [0, 1, 2, 3] as const) {
      const n = neighbor(x, y, d),
        key = n.join(",");
      if (passable(...n) && !seen.has(key)) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  for (const key of new Game().pellets.keys())
    assert.ok(seen.has(key), `Unreachable pellet ${key}`);
  assert.equal(passable(10, 9), false);
  assert.equal(passable(10, 9, true), true);
});
test("player stops at walls and keeps queued turn until an intersection", () => {
  const game = new Game();
  game.ghosts = [];
  game.toggle();
  game.turn(3);
  game.update(0.15625);
  assert.equal(game.player.x, 9);
  assert.equal(game.player.y, 16);
  assert.equal(game.queued, 3);
  game.update(0.15625);
  assert.equal(game.player.x, 9);
  assert.equal(game.player.y, 15);
  assert.equal(game.player.dir, 3);
  game.update(0.3125);
  assert.equal(game.player.y, 14);
  assert.equal(game.player.moving, false);
});
test("pellet consumption counts once and energizer starts frightened timer", () => {
  const g = new Game();
  g.phase = "playing";
  g.player.x = 1;
  g.player.y = 1;
  g.consume();
  assert.equal(g.score, 50);
  assert.equal(g.fright, 7);
  g.consume();
  assert.equal(g.score, 50);
  g.player.x = 2;
  g.consume();
  assert.equal(g.score, 60);
});
test("tunnel interpolation takes the short route and wraps", () => {
  const g = new Game();
  g.ghosts = [];
  g.phase = "playing";
  Object.assign(g.player, { x: 0, y: 10, fromX: 0, fromY: 10, dir: 2 });
  g.turn(2);
  g.update(0.078125);
  assert.equal(g.player.x, 20);
  assert.equal(position(g.player).x, -0.5);
  g.update(0.078125);
  assert.equal(position(g.player).x, 20);
});
test("pause freezes actors and frightened time", () => {
  const g = new Game();
  g.toggle();
  g.update(0.05);
  g.fright = 3;
  g.toggle();
  const state = JSON.stringify(g.player);
  g.update(1);
  assert.equal(JSON.stringify(g.player), state);
  assert.equal(g.fright, 3);
});
test("collision loses one life; respawn preserves score and pellets", () => {
  const g = new Game();
  g.phase = "playing";
  g.score = 90;
  const n = g.pellets.size;
  Object.assign(g.ghosts[0], { x: 10, y: 16, fromX: 10, fromY: 16 });
  g.update(0.001);
  assert.equal(g.phase, "dead");
  assert.equal(g.lives, 2);
  g.update(1.5);
  assert.equal(g.phase, "ready");
  assert.equal(g.score, 90);
  assert.equal(g.pellets.size, n);
});
test("frightened ghost is eaten and awards escalating scores", () => {
  const g = new Game();
  g.phase = "playing";
  g.fright = 7;
  g.ghosts = g.ghosts.slice(0, 2);
  for (const ghost of g.ghosts)
    Object.assign(ghost, { x: 10, y: 16, fromX: 10, fromY: 16, release: 0 });
  g.update(0.001);
  assert.equal(g.score, 600);
  assert.ok(g.ghosts.every((x) => x.eaten));
  assert.equal(g.lives, 3);
});
test("last pellet wins and reset restores a complete fresh run", () => {
  const g = new Game();
  g.phase = "playing";
  g.pellets = new Map([["10,16", "."]]);
  g.consume();
  assert.equal(g.phase, "won");
  g.reset();
  assert.equal(g.phase, "ready");
  assert.equal(g.score, 0);
  assert.equal(g.lives, 3);
  assert.ok(g.pellets.size > 150);
});
test("ghost personalities pick distinct pursuit targets", () => {
  const g = new Game();
  g.mode = "chase";
  g.player.x = 1;
  g.player.y = 4;
  g.player.dir = 0;
  for (const ghost of g.ghosts) Object.assign(ghost, { x: 5, y: 4, dir: 3 });
  assert.equal(g.chooseGhost(g.ghosts[0]), 2);
  assert.notEqual(g.chooseGhost(g.ghosts[1]), 2);
});
test("all released ghosts escape the house", () => {
  const g = new Game();
  g.phase = "playing";
  g.player.x = 0;
  g.player.y = 8;
  g.queued = 3;
  for (let i = 0; i < 1800; i++) g.update(1 / 120);
  for (const ghost of g.ghosts)
    assert.ok(!(ghost.y === 10 && ghost.x >= 9 && ghost.x <= 11), ghost.name);
});
