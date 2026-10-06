import { test, expect } from '@playwright/test';

const sizes = [[320, 480], [320, 568], [375, 667], [390, 664], [390, 844], [430, 932], [768, 1024], [568, 320], [667, 375], [844, 390], [800, 600], [1024, 600], [1280, 720], [1366, 768], [1920, 1080]];

for (const [width, height] of sizes) {
  test(`complete cabinet fits ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#play')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const selectors = ['.cabinet', '#game', '#play', '#score', '#best', '#lives', '#pause', '#sound', '#restart', '[data-dir]'];
      return selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)])
        .filter(el => el.checkVisibility())
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.width < 1 || r.height < 1;
        }).map(el => el.id || el.className);
    })).toEqual([]);
    const dimensions = await page.locator('#game').boundingBox();
    expect(dimensions!.width / dimensions!.height).toBeCloseTo(544 / 568, 2);
    if (width <= 768 || height <= 500) {
      const zone = await page.locator('.control-zone').boundingBox();
      const pad = await page.locator('.mobile-controls').boundingBox();
      expect(pad!.width).toBeGreaterThanOrEqual(159);
      expect(pad!.width).toBeLessThanOrEqual(320);
      const verticalPadding = height <= 500 && width > height ? 0 : 8;
      expect(pad!.width).toBeCloseTo(Math.min(width * .88, 320, zone!.width, zone!.height - verticalPadding), 0);
      expect(pad!.height).toBeCloseTo(pad!.width, 0);
      expect(pad!.x + pad!.width / 2).toBeCloseTo(zone!.x + zone!.width / 2, 0);
      expect(pad!.height).toBeLessThanOrEqual(zone!.height);
      await expect(page.locator('.control-zone button')).toHaveCount(4);
      await expect(page.locator('.control-zone p')).toHaveCount(0);
      for (const id of ['sound', 'restart']) {
        await expect(page.locator(`#${id} span`)).toBeHidden();
        const action = await page.locator(`#${id}`).boundingBox();
        expect(action!.y).toBeLessThan(zone!.y + 1);
      }
      for (const button of await page.locator('[data-dir]').all()) {
        const box = await button.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.mouse.wheel(500, 500);
    await page.evaluate(() => window.scrollTo(500, 500));
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })))
      .toEqual({ x: 0, y: 0, width, height });
    await page.locator('#play').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.locator('#pause').click();
    await expect(page.locator('#overlay-title')).toHaveText('Catch yourbreath.');
    await page.locator('#restart').click();
    await expect(page.locator('#score')).toHaveText('000000');
    expect(errors).toEqual([]);
  });
}

test('touch pad feedback, swipes, cancellation, rotation, and high DPI', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#play').tap();
  // Observe the real engine's turn method without adding test hooks to the app.
  await page.evaluate(async () => {
    const modulePath = '/src/engine.ts';
    const { Game } = await import(modulePath);
    const original = Game.prototype.turn;
    Game.prototype.turn = function (direction: number) {
      document.body.dataset.lastTurn = String(direction);
      document.body.dataset.turnCount = String(Number(document.body.dataset.turnCount || 0) + 1);
      original.call(this, direction);
    };
  });
  const cdp = await context.newCDPSession(page);
  await page.evaluate(() => {
    document.body.dataset.turnCount = '0';
    window.addEventListener('pointerdown', event => {
      document.body.dataset.touchPrevented = String(event.defaultPrevented);
    });
  });
  for (const direction of [0, 1, 2, 3]) {
    const button = page.locator(`[data-dir="${direction}"]`);
    const box = (await button.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await expect(button).toHaveClass('pressed');
    await expect(page.locator('body')).toHaveAttribute('data-touch-prevented', 'true');
    await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
    await expect(page.locator('body')).toHaveAttribute('data-turn-count', String(direction + 1));
    await cdp.send('Input.dispatchTouchEvent', { type: direction % 2 ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    await expect(button).not.toHaveClass('pressed');
    await expect(page.locator('body')).toHaveAttribute('data-turn-count', String(direction + 1));
  }
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.locator('#sound').tap();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sound').tap();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  const canvas = page.locator('#game');
  for (const [dx, dy, direction] of [[40, 0, 0], [0, 40, 1], [-40, 0, 2], [0, -40, 3]]) {
    await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 150, clientY: 180 });
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 150 + dx, clientY: 180 + dy });
    await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
    await canvas.dispatchEvent('pointercancel', { pointerId: 1 });
    await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 250, clientY: 180 });
    await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => canvas.evaluate((el: HTMLCanvasElement) => Math.abs(el.width - el.getBoundingClientRect().width * devicePixelRatio))).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect.poll(async () => canvas.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThan(664);
  await context.close();
});

for (const [width, height] of [[390, 844], [844, 390]]) {
  test(`connected D-pad steers continuously without lifting at ${width}×${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(async () => {
      const modulePath = '/src/engine.ts';
      const { Game } = await import(modulePath);
      const original = Game.prototype.turn;
      Game.prototype.turn = function (direction: number) {
        document.body.dataset.lastTurn = String(direction);
        original.call(this, direction);
      };
      window.addEventListener('pointermove', event => {
        document.body.dataset.movePrevented = String(event.defaultPrevented);
      });
    });
    const pad = page.locator('.mobile-controls');
    await expect(pad).toHaveCSS('gap', '0px');
    await expect(pad.locator('.dpad-center')).toHaveCount(0);
    const box = (await pad.boundingBox())!;
    const point = (x: number, y: number, id = 1) => ({ x: box.x + box.width * x, y: box.y + box.height * y, id });
    const cdp = await context.newCDPSession(page);
    // The neutral hub engages the pointer without buffering an accidental turn.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.5, .5)] });
    await expect(pad.locator('.pressed')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-last-turn');
    // Cross the center and the former gaps, with one uninterrupted contact.
    for (const [x, y, direction] of [[.9, .5, 0], [.5, .9, 1], [.1, .5, 2], [.5, .1, 3], [.95, .7, 0]]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x, y)] });
      await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
      await expect(page.locator('body')).toHaveAttribute('data-move-prevented', 'true');
      await expect(pad.locator('.pressed')).toHaveCount(1);
      await expect(page.locator(`[data-dir="${direction}"]`)).toHaveClass('pressed');
      // Small movements throughout the center clear feedback, preserving the queue.
      for (const [cx, cy] of [[.5, .5], [.6, .5], [.5, .4], [.4, .5], [.5, .6]]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(cx, cy)] });
        await expect(pad.locator('.pressed')).toHaveCount(0);
        await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(x, y)] });
    }
    // Another finger cannot steal the active thumb's direction.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.95, .7), point(.5, .1, 2)] });
    await expect(page.locator('[data-dir="0"]')).toHaveClass('pressed');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(pad.locator('.pressed')).toHaveCount(0);
    // Even the visually empty corners belong to the touch surface.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.05, .3)] });
    await expect(page.locator('[data-dir="2"]')).toHaveClass('pressed');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(pad.locator('.pressed')).toHaveCount(0);
    // The full control zone, including margins outside the cross, is interactive.
    const zone = page.locator('.control-zone');
    await expect(zone).toHaveCSS('touch-action', 'none');
    const zoneBox = (await zone.boundingBox())!;
    const samples = [
      { x: zoneBox.x + 1, y: box.y + box.height / 2, direction: 2 },
      { x: zoneBox.x + zoneBox.width - 1, y: box.y + box.height / 2, direction: 0 },
      { x: box.x + box.width / 2, y: zoneBox.y + 1, direction: 3 },
      { x: box.x + box.width / 2, y: zoneBox.y + zoneBox.height - 1, direction: 1 },
    ];
    for (const sample of samples) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sample.x, y: sample.y, id: 1 }] });
      await expect(page.locator(`[data-dir="${sample.direction}"]`)).toHaveClass('pressed');
      await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(sample.direction));
      // Glide from the outer margin through the neutral hub into the up wing.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(.5, .5)] });
      await expect(pad.locator('.pressed')).toHaveCount(0);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(.5, .1)] });
      await expect(page.locator('[data-dir="3"]')).toHaveClass('pressed');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(pad.locator('.pressed')).toHaveCount(0);
    }
    // Mouse/pen dragging and keyboard activation still work.
    await page.mouse.move(point(.5, .1).x, point(.5, .1).y);
    await page.mouse.down();
    await page.mouse.move(point(.9, .5).x, point(.9, .5).y);
    await expect(page.locator('[data-dir="0"]')).toHaveClass('pressed');
    // Pointer capture continues to steer outside the cross and resets on release.
    await page.mouse.move(point(1.15, .5).x, point(1.15, .5).y);
    await expect(page.locator('[data-dir="0"]')).toHaveClass('pressed');
    await page.mouse.up();
    await expect(pad.locator('.pressed')).toHaveCount(0);
    await page.mouse.move(point(.1, .5).x, point(.1, .5).y);
    await expect(pad.locator('.pressed')).toHaveCount(0);
    await page.locator('[data-dir="1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute('data-last-turn', '1');
    expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
    expect(errors).toEqual([]);
    await context.close();
  });
}
