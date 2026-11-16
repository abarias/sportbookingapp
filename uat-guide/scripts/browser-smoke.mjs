import { access, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const browserCandidates = [
  process.env.UAT_CHROME_PATH,
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);
let browserPath;
for (const candidate of browserCandidates) {
  try { await access(candidate); browserPath = candidate; break; } catch { /* try next */ }
}
if (!browserPath) throw new Error("No Chromium-compatible browser found. Set UAT_CHROME_PATH.");

const browserPort = 9337;
const guidePort = 4197;
const browser = spawn(browserPath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run",
  `--remote-debugging-port=${browserPort}`, `--user-data-dir=/tmp/mmg-uat-browser-smoke-${Date.now()}`, "about:blank"
], { stdio: "ignore" });
const server = spawn(process.execPath, [resolve(root, "scripts/serve.mjs"), root, String(guidePort)], { stdio: "ignore" });

async function waitForJson(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch { /* wait */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
  }
  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolveReady, reject) => {
      this.socket.onopen = resolveReady;
      this.socket.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket.close(); }
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
  return response.result.value;
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await new Promise((resolveWait) => setTimeout(resolveWait, 1800));
}

const errors = [];
try {
  await waitForJson(`http://127.0.0.1:${browserPort}/json/version`);
  const target = await fetch(`http://127.0.0.1:${browserPort}/json/new?http://127.0.0.1:${guidePort}`, { method: "PUT" }).then((response) => response.json());
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await mkdir(resolve(root, "tmp"), { recursive: true });

  async function inspectViewport(name, width, height, mobile) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await navigate(cdp, `http://127.0.0.1:${guidePort}`);
    const metrics = await evaluate(cdp, `(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cases: window.UAT_CASES.length,
      sections: document.querySelectorAll('main > section[id]').length,
      offenders: [...document.querySelectorAll('body *')].map((element) => ({ element, rect: element.getBoundingClientRect() })).filter(({ rect }) => rect.right > window.innerWidth + 1 || rect.left < -1).slice(0, 8).map(({ element, rect }) => ({ tag: element.tagName, className: element.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }))
    }))()`);
    if (metrics.width !== width) errors.push(`${name}: expected viewport ${width}, received ${metrics.width}`);
    if (metrics.scrollWidth > metrics.width) errors.push(`${name}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.width}px; ${JSON.stringify(metrics.offenders)}`);
    if (metrics.cases !== 74) errors.push(`${name}: expected 74 cases, received ${metrics.cases}`);
    if (metrics.sections !== 17) errors.push(`${name}: expected 17 main sections, received ${metrics.sections}`);
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(resolve(root, `tmp/portal-${name}.png`), Buffer.from(screenshot.data, "base64"));
    return metrics;
  }

  const desktop = await inspectViewport("desktop", 1440, 1000, false);
  const mobile = await inspectViewport("mobile", 390, 844, true);

  await evaluate(cdp, `document.querySelector('[data-case-id="CUST-HP-001"] [data-set-status="Pass"]').click()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  const persisted = await evaluate(cdp, `(() => { const key = Object.keys(localStorage).find((item) => item.startsWith('mmg-stellar-uat:')); const data = JSON.parse(localStorage.getItem(key)); return { status: data.results['CUST-HP-001'].status, progress: document.querySelector('#hero-progress').textContent }; })()`);
  if (persisted.status !== "Pass" || persisted.progress === "0%") errors.push(`Persistence write failed: ${JSON.stringify(persisted)}`);
  await navigate(cdp, `http://127.0.0.1:${guidePort}`);
  const reloadedStatus = await evaluate(cdp, `document.querySelector('[data-status-badge="CUST-HP-001"]').textContent`);
  if (reloadedStatus !== "Pass") errors.push(`Persistence reload failed: ${reloadedStatus}`);

  const filterResult = await evaluate(cdp, `(() => { const input = document.querySelector('#case-search'); input.value = 'CUST-HP-001'; input.dispatchEvent(new Event('input', { bubbles: true })); return { summary: document.querySelector('#filter-summary').textContent, visibleRows: [...document.querySelectorAll('[data-trace-case]')].filter((row) => !row.classList.contains('hidden-by-filter')).length }; })()`);
  if (filterResult.visibleRows !== 1 || !filterResult.summary.includes("1 of 74")) errors.push(`Filtering failed: ${JSON.stringify(filterResult)}`);

  const exportShape = await evaluate(cdp, `(() => { const key = Object.keys(localStorage).find((item) => item.startsWith('mmg-stellar-uat:')); const data = JSON.parse(localStorage.getItem(key)); return { version: data.version, resultKeys: Object.keys(data.results), hasRun: typeof data.run === 'object' }; })()`);
  if (exportShape.version !== "2026.08.27" || !exportShape.resultKeys.includes("CUST-HP-001") || !exportShape.hasRun) errors.push(`Export/import data shape invalid: ${JSON.stringify(exportShape)}`);

  await evaluate(cdp, `localStorage.clear()`);
  cdp.close();
  console.log(JSON.stringify({ desktop, mobile, persisted, filterResult, exportShape }, null, 2));
} finally {
  browser.kill("SIGKILL");
  server.kill("SIGTERM");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Browser smoke checks passed.");
