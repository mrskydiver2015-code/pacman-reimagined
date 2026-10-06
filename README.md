# After Hours — Pac-Man Reimagined

A complete single-level arcade game, built with TypeScript, Canvas 2D, and Vite. All graphics and audio are generated locally: no fonts, images, sound downloads, API keys, or backend services are required.

## Run

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).


```sh
npm ci
npm run dev
```

Use arrow keys or WASD to move. Turns are buffered until the next available intersection. On mobile, swipe the maze or use the directional buttons. Enter starts a run, P or Space pauses, and M toggles sound. Audio starts muted; enable it with the sound button. Switching away automatically pauses play.

Collect every pellet to win Level 1. Pellets award 10 points; energizers award 50 and frighten ghosts for seven seconds. Eating ghosts awards 200, 400, 800, then 1,600 points. You have three lives. Personal best is saved in local storage when available. Restart starts a fresh run; completing the level offers a replay.

## Verify and deploy

```sh
npm run lint
npm test
npm run build
npm run preview
```

`npm test` exercises maze reachability, wall collision and turn queuing, tunnel interpolation, pellet/energizer scoring, pause, life loss and respawn, frightened collisions, victory/reset, ghost personalities, and house release.

For Vercel, import the repository, select **Vite**, use `npm run build`, and set the output directory to **dist**. No environment variables or rewrite rules are needed. The production output is a static site.

## Design and implementation

- `src/engine.ts`: rendering-independent game simulation, fixed-grid collision, movement interpolation, collectibles, and state transitions.
- `src/main.ts`: 120 Hz fixed-step loop, responsive high-DPI Canvas renderer, particles, ghost sprites, Web Audio synthesis, keyboard/swipe controls, and interface.
- `src/style.css`: responsive arcade layout and reduced-motion UI transitions.
- `src/engine.test.ts`: automated simulation tests.

The maze is an architectural homage, not an exact arcade ROM reproduction. Blinky targets the player, Pinky aims four tiles ahead, Inky targets a point relative to Blinky, and Clyde retreats when close. Ghosts alternate seven-second scatter and twenty-second chase periods; frightened ghosts choose random legal routes, and eaten ghosts route back to the house. Shortest-path routing keeps the distinct targeting strategies navigable.

The cabinet stays inside `100dvh` (with a `100vh` fallback), with scrolling and browser touch gestures disabled. Desktop uses three columns; portrait phones reserve 12% for the HUD, 53% for the complete cabinet, and 35% for controls, inside safe-area padding. Short landscape screens place the D-pad alongside the maze. The canvas scales to both available dimensions and renders at the display pixel density. The connected D-pad scales to 160–200px where space permits. A captured pointer supports uninterrupted thumb, pen, or mouse glides; its neutral center (radius 18% of the pad diameter) clears the highlight without changing the buffered turn. Releasing or cancelling the pointer clears the hold. Direction wings provide pressed feedback plus vibration where supported; Safari uses visual feedback.

Browser regression tests cover 15 viewport sizes from 320×480 to 1920×1080, including short landscape phones, plus touch input, cancellation, rotation, and high-DPI resizing:

```sh
npx playwright install chromium
npm run test:e2e
# Or use an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Validated in headless Chromium. Native iOS Safari / safe-area behavior should also be checked on a device; WebKit installation was blocked by the verification environment's network policy. There are no later levels or online leaderboards.
