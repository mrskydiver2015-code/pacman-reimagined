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
    if (width <= 700 || height <= 500) {
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
      original.call(this, direction);
    };
  });
  for (const direction of [0, 1, 2, 3]) {
    const button = page.locator(`[data-dir="${direction}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await expect(button).toHaveClass('pressed');
    await expect(page.locator('body')).toHaveAttribute('data-last-turn', String(direction));
    await button.dispatchEvent('pointercancel', { pointerId: 1 });
    await expect(button).not.toHaveClass('pressed');
  }
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
