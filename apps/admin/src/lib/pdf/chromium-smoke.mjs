import { chromium } from "playwright";

const url = process.env.GEONEXO_SMOKE_URL ?? "https://127.0.0.1:5188/imports";
const pdfPath = process.env.GEONEXO_PDF_PATH ?? "D:/MATEUS/Documentos/GitHub/GeoNexo/geopdf de araguaina.pdf";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const requests = [];
page.on("request", (request) => requests.push(request.url()));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase("GeoNexoLocalFirstDB");
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
}));
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator('input[type="file"]').setInputFiles(pdfPath);
const card = page.locator("article").filter({ hasText: "Pré-visualização PDF" }).first();
await card.waitFor({ state: "visible", timeout: 30_000 });
await page.waitForFunction(() => [...document.querySelectorAll("article p")].some((node) => node.textContent?.includes("Não posicionado:") && !node.textContent.includes("aguardando")), undefined, { timeout: 60_000 });
const status = await card.locator("p").nth(1).textContent();
const canvasCount = await card.locator("canvas").count();
await page.reload({ waitUntil: "domcontentloaded" });
const reloaded = page.locator("article").filter({ hasText: "Pré-visualização PDF" }).first();
await reloaded.waitFor({ state: "visible", timeout: 30_000 });
await page.waitForFunction(() => [...document.querySelectorAll("article p")].some((node) => node.textContent?.includes("Não posicionado:") && !node.textContent.includes("aguardando")), undefined, { timeout: 60_000 });
const reloadStatus = await reloaded.locator("p").nth(1).textContent();
const remoteRequests = requests.filter((requestUrl) => /^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(requestUrl));
// eslint-disable-next-line no-console
console.log(JSON.stringify({ status, reloadStatus, canvasCount, remoteRequests, requestCount: requests.length }));
if (!status?.includes("Não posicionado") || !reloadStatus?.includes("Não posicionado") || canvasCount < 1 || remoteRequests.length > 0) process.exitCode = 1;
await browser.close();
