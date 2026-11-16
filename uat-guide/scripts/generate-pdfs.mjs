import { access, mkdir, rm, writeFile } from "node:fs/promises";
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
if (!browserPath) throw new Error("Chrome/Edge was not found. Set UAT_CHROME_PATH to a Chromium-compatible browser executable.");

const guidePort = Number(process.env.UAT_PDF_PORT || 4183);
const output = resolve(root, "output/pdf");
await mkdir(output, { recursive: true });

const server = spawn(process.execPath, [resolve(root, "scripts/serve.mjs"), root, String(guidePort)], { stdio: "ignore" });

async function waitForJson(url) {
  for (let index = 0; index < 60; index += 1) {
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
    this.socket.onclose = () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Browser page closed before PDF generation completed."));
      this.pending.clear();
    };
  }
  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolveReady, reject) => { this.socket.onopen = resolveReady; this.socket.onerror = reject; });
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

const documents = [
  ["customer-uat-guide.pdf", "customer"],
  ["super-admin-uat-guide.pdf", "super-admin"],
  ["receptionist-uat-guide.pdf", "receptionist"],
  ["booking-admin-uat-guide.pdf", "booking-admin"],
  ["social-media-uat-guide.pdf", "social-media"],
  ["complete-uat-guide.pdf", "all"]
];

async function renderDocument(name, mode, index) {
  const browserPort = 10000 + Math.floor(Math.random() * 20000) + index;
  const profile = `/tmp/mmg-uat-pdf-${process.pid}-${index}`;
  const browser = spawn(browserPath, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run",
    `--remote-debugging-port=${browserPort}`, `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: "ignore" });
  let cdp;

  try {
    await waitForJson(`http://127.0.0.1:${browserPort}/json/version`);
    await rm(resolve(output, name), { force: true });
    const target = await fetch(`http://127.0.0.1:${browserPort}/json/new?http://127.0.0.1:${guidePort}/?print=${mode}`, { method: "PUT" }).then((response) => response.json());
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${guidePort}/?print=${mode}` });
    await new Promise((resolveWait) => setTimeout(resolveWait, 1800));
    const result = await cdp.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      transferMode: "ReturnAsBase64"
    });
    await writeFile(resolve(output, name), Buffer.from(result.data, "base64"));
    console.log(`Generated ${name}`);
  } finally {
    cdp?.close();
    browser.kill("SIGKILL");
    // The browser can briefly recreate cache files while it is shutting down.
    await rm(profile, { force: true, recursive: true }).catch(() => {});
  }
}

try {
  for (const [index, [name, mode]] of documents.entries()) {
    await renderDocument(name, mode, index);
  }
  console.log(`Generated ${documents.length} PDFs in ${output}`);
} finally {
  server.kill("SIGTERM");
}
