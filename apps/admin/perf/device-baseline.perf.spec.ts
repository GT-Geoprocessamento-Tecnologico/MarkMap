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
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height * 0.5;

  // Measure only the actual drag gesture, not 2.5s of mostly idle rAF frames.
  // Capture is bounded, fails on page hiding and removes all event listeners.
  // A JSHandle is returned only after the event listeners are installed.
  // A pending page.evaluate() promise could race with Playwright mouse events.
  const sampler = await page.evaluateHandle(() => {
    const target = document.querySelector('.maplibregl-canvas');
    if (!target || document.visibilityState !== 'visible') {
      throw new Error('A visible map canvas is required for frame sampling.');
    }
    const promise = new Promise<number[]>((resolve, reject) => {
      const samples: number[] = [];
      let started = false;
      let finished = false;
      let rafId: number | undefined;

      const cleanup = () => {
        target.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        document.removeEventListener('visibilitychange', onVisibility);
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      };
      const fail = (reason: string) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error(reason));
      };
      function frame(now: number) {
        if (!started || finished) return;
        samples.push(now);
        rafId = requestAnimationFrame(frame);
      }
      const onDown = () => {
        if (started || finished) return;
        started = true;
        rafId = requestAnimationFrame(frame);
      };
      const onUp = () => {
        if (!started || finished) return;
        finished = true;
        cleanup();
        if (samples.length < 2 || samples[samples.length - 1] - samples[0] < 1_000) {
          reject(new Error('Map drag was too short for a meaningful frame sample.'));
        } else resolve(samples);
      };
      const onVisibility = () => {
        if (document.visibilityState !== 'visible') fail('Page hidden during drag benchmark.');
      };

      target.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      document.addEventListener('visibilitychange', onVisibility);
      const timeoutId = window.setTimeout(() => fail('Timed out waiting for a map drag sample.'), 20_000);
    });
    return { promise };
  });
  const framesPromise = sampler.evaluate((recording) => recording.promise);
  await page.mouse.move(x, y);
  await page.mouse.down();
  const travelX = Math.min(box!.width / 4, 120);
  const travelY = Math.min(box!.height / 5, 60);
  for (let i = 1; i <= 50; i++) {
    await page.mouse.move(x + travelX * i / 50, y + travelY * i / 50);
    // Intentional pacing: keep the map actively dragging for a comparable window.
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  const frames = await framesPromise;
  await sampler.dispose();

  const environment = await page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
    const nav = navigator as Navigator & { deviceMemory?: number };
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
  process.stdout.write('MARKMAP_LOCAL_PERF_BASELINE ' + JSON.stringify({ browserProfile: test.info().project.name, ...baseline }) + '\n');
  expect(baseline.frames).toBeGreaterThan(0);
});
