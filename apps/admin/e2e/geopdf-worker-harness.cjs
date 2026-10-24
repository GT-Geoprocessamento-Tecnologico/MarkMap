/*
 * Experimental GeoPDF worker harness.
 *
 * Usage:
 *   node apps/admin/e2e/geopdf-worker-harness.cjs <fixture-dir> <pdfjs-package-dir> <candidate-deps-dir> [project-pdf-path]
 *
 * PDF.js is intentionally supplied from a disposable directory. This keeps
 * the feasibility experiment out of product bundles and lockfile changes.
 * project-pdf-path is an explicitly authorized local test input; it is read
 * into memory only and is never copied to a workspace fixture or written out.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd()] }));

const fixtureDir = path.resolve(process.argv[2] ?? '');
const pdfjsDir = path.resolve(process.argv[3] ?? '');
const depsDir = path.resolve(process.argv[4] ?? '');
const projectPdfPath = process.argv[5] ? path.resolve(process.argv[5]) : null;
if (!fs.existsSync(fixtureDir) || !fs.existsSync(pdfjsDir) || !fs.existsSync(depsDir)) {
  console.error('Usage: geopdf-worker-harness.cjs <fixture-dir> <pdfjs-package-dir> <candidate-deps-dir> [project-pdf-path]');
  process.exit(2);
}

const fixtureNames = ['test_iso32000.pdf', 'test_ogc_bp.pdf', 'adobe_style_geospatial.pdf'];
const files = new Map(fixtureNames.map((name) => [name, fs.readFileSync(path.join(fixtureDir, name))]));
if (projectPdfPath) {
  const projectStat = fs.statSync(projectPdfPath);
  if (!projectStat.isFile()) throw new Error('project-pdf-path must refer to a file');
  if (projectStat.size > 25 * 1024 * 1024) throw new Error('project-pdf-path exceeds the 25 MiB feasibility input limit');
  const projectBytes = fs.readFileSync(projectPdfPath);
  if (projectBytes.byteLength > 25 * 1024 * 1024) throw new Error('project-pdf-path exceeds the 25 MiB feasibility input limit');
  if (projectBytes.toString('latin1', 0, 5) !== '%PDF-') throw new Error('project-pdf-path does not have a PDF header');
  files.set('project-sample.pdf', projectBytes);
}
const workerPath = path.join(pdfjsDir, 'build', 'pdf.worker.mjs');
const libraryPath = path.join(pdfjsDir, 'build', 'pdf.mjs');
if (!fs.existsSync(workerPath) || !fs.existsSync(libraryPath)) throw new Error('PDF.js build/pdf.mjs and build/pdf.worker.mjs are required');

async function makeActiveFixture() {
  const { PDFDocument, PDFName, PDFString } = require(path.join(depsDir, 'node_modules', 'pdf-lib', 'cjs', 'index.js'));
  const document = await PDFDocument.create();
  const page = document.addPage([200, 200]);
  page.drawText('GeoPDF safety fixture');
  document.addJavaScript('probe', 'globalThis.__GEONEXO_PDF_JS_EXECUTED = true;');
  const action = document.context.obj({ Type: PDFName.of('Action'), S: PDFName.of('URI'), URI: PDFString.of('https://example.invalid/geonexo-uri') });
  const annotation = document.context.obj({ Type: PDFName.of('Annot'), Subtype: PDFName.of('Link'), Rect: document.context.obj([10, 10, 100, 40]), A: action });
  page.node.set(PDFName.of('Annots'), document.context.obj([annotation]));
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function makeEncryptedFixture() {
  return new Promise((resolve, reject) => {
    const PdfKit = require(path.join(depsDir, 'node_modules', 'pdfkit', 'js', 'pdfkit.js'));
    const chunks = [];
    const document = new PdfKit({ userPassword: 'correct-horse', ownerPassword: 'owner-secret' });
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.text('Encrypted GeoPDF safety fixture');
    document.end();
  });
}

async function main() {
  files.set('active-actions.pdf', await makeActiveFixture());
  files.set('encrypted.pdf', await makeEncryptedFixture());
  const externalRequests = [];
  let server;
  await new Promise((resolve) => {
    server = http.createServer((request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'" });
        response.end('<!doctype html><title>GeoPDF worker harness</title>');
        return;
      }
      const fixtureName = request.url?.replace(/^\/fixtures\//, '');
      if (fixtureName && files.has(fixtureName)) {
        const bytes = files.get(fixtureName);
        response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': bytes.length });
        response.end(bytes);
        return;
      }
      if (request.url === '/pdfjs/build/pdf.mjs' || request.url === '/pdfjs/build/pdf.worker.mjs') {
        const target = request.url.endsWith('pdf.mjs') ? libraryPath : workerPath;
        response.writeHead(200, { 'Content-Type': 'text/javascript' });
        fs.createReadStream(target).pipe(response);
        return;
      }
      response.writeHead(404);
      response.end();
    }).listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    let workerStarts = 0;
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('worker', () => { workerStarts += 1; });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) {
        externalRequests.push(url.href);
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await page.goto(base);
    const result = await page.evaluate(async ({ base: origin, libraryUrl, workerUrl, includeProjectPdf }) => {
      const pdfjs = await import(libraryUrl);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const renders = [];
      const names = ['test_iso32000.pdf', 'test_ogc_bp.pdf', 'adobe_style_geospatial.pdf'];
      if (includeProjectPdf) names.push('project-sample.pdf');
      for (const name of names) {
        const bytes = new Uint8Array(await (await fetch(`${origin}/fixtures/${name}`)).arrayBuffer());
        const byteCount = bytes.byteLength;
        const rendererHeapBefore = performance.memory?.usedJSHeapSize ?? null;
        const openStartedAt = performance.now();
        const loading = pdfjs.getDocument({ data: bytes, isEvalSupported: false, disableAutoFetch: true, disableStream: true, disableRange: true, useSystemFonts: false, verbosity: 0 });
        const pdfDocument = await loading.promise;
        const openMs = Math.round((performance.now() - openStartedAt) * 100) / 100;
        if (pdfDocument.numPages > 100) {
          await loading.destroy();
          throw new Error('PDF exceeds the 100-page feasibility limit');
        }
        const pdfPage = await pdfDocument.getPage(1);
        const viewport = pdfPage.getViewport({ scale: name === 'adobe_style_geospatial.pdf' ? 0.25 : 1 });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        if (width * height > 16_000_000) {
          await loading.destroy();
          throw new Error('PDF render exceeds the 16 MP feasibility limit');
        }
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const renderStartedAt = performance.now();
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const rendererHeapAfter = performance.memory?.usedJSHeapSize ?? null;
        const rendererHeapDelta = rendererHeapBefore === null || rendererHeapAfter === null || rendererHeapBefore <= 0 || rendererHeapAfter <= 0 ? null : rendererHeapAfter - rendererHeapBefore;
        const rendererHeapDeltaBytes = rendererHeapDelta === null || rendererHeapDelta === 0 ? null : rendererHeapDelta;
        renders.push({ name, bytes: byteCount, pages: pdfDocument.numPages, width: canvas.width, height: canvas.height, openMs, renderMs: Math.round((performance.now() - renderStartedAt) * 100) / 100, rendererHeapDeltaBytes });
        await loading.destroy();
        canvas.width = 0;
        canvas.height = 0;
      }
      const nearCapBytes = new Uint8Array(await (await fetch(`${origin}/fixtures/adobe_style_geospatial.pdf`)).arrayBuffer());
      const nearCapTask = pdfjs.getDocument({ data: nearCapBytes, isEvalSupported: false, disableAutoFetch: true, disableStream: true, disableRange: true, useSystemFonts: false, verbosity: 0 });
      const nearCapDocument = await nearCapTask.promise;
      const nearCapPage = await nearCapDocument.getPage(1);
      const nearCapScale = Math.sqrt(16_000_000 / (612 * 792)) * 0.999;
      const nearCapViewport = nearCapPage.getViewport({ scale: nearCapScale });
      const nearCapWidth = Math.ceil(nearCapViewport.width);
      const nearCapHeight = Math.ceil(nearCapViewport.height);
      if (nearCapWidth * nearCapHeight > 16_000_000) {
        await nearCapTask.destroy();
        throw new Error('Near-cap test viewport exceeds the 16 MP feasibility limit');
      }
      const nearCapCanvas = globalThis.document.createElement('canvas');
      nearCapCanvas.width = nearCapWidth;
      nearCapCanvas.height = nearCapHeight;
      const nearCapStart = performance.now();
      await nearCapPage.render({ canvasContext: nearCapCanvas.getContext('2d'), viewport: nearCapViewport }).promise;
      const nearCap = { width: nearCapCanvas.width, height: nearCapCanvas.height, pixels: nearCapCanvas.width * nearCapCanvas.height, elapsedMs: +(performance.now() - nearCapStart).toFixed(1) };
      await nearCapTask.destroy();
      nearCapCanvas.width = 0;
      nearCapCanvas.height = 0;
      const corruptTask = pdfjs.getDocument({ data: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), isEvalSupported: false, verbosity: 0 });
      const corrupt = await corruptTask.promise.then(() => ({ rejected: false }), (error) => ({ rejected: true, name: error.name }));
      await corruptTask.destroy().catch(() => {});
      const activeBytes = new Uint8Array(await (await fetch(`${origin}/fixtures/active-actions.pdf`)).arrayBuffer());
      const activeTask = pdfjs.getDocument({ data: activeBytes, isEvalSupported: false, disableAutoFetch: true, verbosity: 0 });
      const activeDocument = await activeTask.promise;
      const javascript = typeof activeDocument.getJavaScript === 'function' ? await activeDocument.getJavaScript() : null;
      const annotations = await (await activeDocument.getPage(1)).getAnnotations();
      const active = { javascriptCount: javascript?.length ?? null, annotationUrls: annotations.map((entry) => entry.url).filter(Boolean), executed: globalThis.__GEONEXO_PDF_JS_EXECUTED === true };
      await activeTask.destroy();
      const encryptedBytes = new Uint8Array(await (await fetch(`${origin}/fixtures/encrypted.pdf`)).arrayBuffer());
      const encryptedTask = pdfjs.getDocument({ data: encryptedBytes, isEvalSupported: false, verbosity: 0 });
      const encrypted = await encryptedTask.promise.then(() => ({ rejected: false }), (error) => ({ rejected: true, name: error.name }));
      await encryptedTask.destroy().catch(() => {});
      const cancelBytes = new Uint8Array(await (await fetch(`${origin}/fixtures/adobe_style_geospatial.pdf`)).arrayBuffer());
      const cancelTask = pdfjs.getDocument({ data: cancelBytes.slice(), isEvalSupported: false, verbosity: 0 });
      const cancelResult = cancelTask.promise.then(() => ({ rejected: false }), (error) => ({ rejected: true, name: error.name }));
      await cancelTask.destroy();
      const cancellation = await cancelResult;
      const renderCancelTask = pdfjs.getDocument({ data: cancelBytes.slice(), isEvalSupported: false, disableAutoFetch: true, verbosity: 0 });
      const renderCancelDocument = await renderCancelTask.promise;
      const renderCancelPage = await renderCancelDocument.getPage(1);
      const renderCancelViewport = renderCancelPage.getViewport({ scale: nearCapScale });
      const renderCancelCanvas = globalThis.document.createElement('canvas');
      renderCancelCanvas.width = Math.ceil(renderCancelViewport.width);
      renderCancelCanvas.height = Math.ceil(renderCancelViewport.height);
      const renderTask = renderCancelPage.render({ canvasContext: renderCancelCanvas.getContext('2d'), viewport: renderCancelViewport });
      renderTask.cancel();
      const renderCancellation = await renderTask.promise.then(() => ({ rejected: false }), (error) => ({ rejected: true, name: error.name }));
      await renderCancelTask.destroy().catch(() => {});
      renderCancelCanvas.width = 0;
      renderCancelCanvas.height = 0;
      return { renders, nearCap, corrupt, active, encrypted, cancellation, renderCancellation };
    }, { base, libraryUrl: `${base}/pdfjs/build/pdf.mjs`, workerUrl: `${base}/pdfjs/build/pdf.worker.mjs`, includeProjectPdf: projectPdfPath !== null });
    await page.waitForTimeout(50);
    const output = { base, result, externalRequests, pageErrors, workerStarts, liveWorkers: page.workers().length };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (externalRequests.length || pageErrors.length || workerStarts === 0 || page.workers().length !== 0 || result.renders.length !== (projectPdfPath ? 4 : 3) || result.nearCap.pixels > 16_000_000 || result.corrupt.name !== 'InvalidPDFException' || result.cancellation.name !== 'Error' || result.renderCancellation.name !== 'RenderingCancelledException' || result.encrypted.name !== 'PasswordException' || result.active.executed || result.active.annotationUrls.length !== 1) process.exitCode = 1;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
