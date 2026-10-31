import { expect, test } from '@playwright/test';
import { createLocalBaseline } from './baseline-metrics.mjs';

/**
 * Manual, opt-in benchmark; metrics are printed locally, never uploaded by app code.
 * Browser emulation is NOT validation on actual Android/iOS hardware.
 */
test('collects a local shell/map interaction baseline without user data', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[aria-label="MarkMap — Planejamento Inteligente"]:visible').first()).toBeVisible();
  const shellReadyMs = await page.evaluate(() => performance.now());

  await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 45_000 });
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const mapReadyMs = await page.evaluate(() => performance.now());

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.5;

  const framesPromise = page.evaluate(() => new Promise((resolve, reject) => {
    if (document.visibilityState !== 'visible') {
      reject(new Error('Performance sampling requires a visible page.'));
      return;
    }
    const start = performance.now();
    const samples = [];
    function onFrame(now) {
      if (document.visibilityState !== 'visible') {
        reject(new Error('Page became hidden during performance sampling.'));
        return;
      }
      samples.push(now);
      if (now - start >= 2_500) resolve(samples);
      else requestAnimationFrame(onFrame);
    }
    requestAnimationFrame(onFrame);
  }));
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(x + 50 + i * 5, y + 30 + i * 3, { steps: 2 });
  }
  await page.mouse.up();
  const frames = await framesPromise;

  const environment = await page.evaluate(() => {
    const memory = performance.memory;
    const nav = navigator;
    return {
      usedHeapBytes: memory?.usedJSHeapSize ?? null,
      hints: {
        cores: navigator.hardwareConcurrency,
        memoryGb: nav.deviceMemory,
        devicePixelRatio: window.devicePixelRatio,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    };
  });

  const baseline = createLocalBaseline({
    shellReadyMs,
    mapReadyMs,
    frames,
    usedHeapBytes: environment.usedHeapBytes,
    hints: environment.hints,
    runtime: 'browser-emulation',
  });
  // No project ID, coordinates, device identification or automatic upload.
  console.info('MARKMAP_LOCAL_PERF_BASELINE ' + JSON.stringify({ browserProfile: test.info().project.name, ...baseline }));
  expect(baseline.frames).toBeGreaterThan(0);
});
