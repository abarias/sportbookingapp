import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const siteRoot = resolve(root, "dist");
const port = Number(process.env.GUIDE_SMOKE_PORT || 4186);
const server = spawn(process.execPath, [resolve(root, "scripts/serve.mjs"), siteRoot, String(port)], { stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}`); if (response.ok) return; } catch { /* wait */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Timed out waiting for the guide server.");
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    const personaCards = await page.locator(".persona-grid > a").count();
    const scenarios = await page.locator(".scenario").count();
    if (personaCards !== 5) throw new Error(`Expected 5 persona cards; found ${personaCards}.`);
    if (scenarios !== 30) throw new Error(`Expected 30 scenarios; found ${scenarios}.`);
    const downloadLinks = await page.locator('.download-links a[href$=".pdf"]').count();
    if (downloadLinks !== 6) throw new Error(`Expected 6 PDF downloads; found ${downloadLinks}.`);
    const downloadSources = await page.locator('.download-links a[href$=".pdf"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    for (const source of downloadSources) {
      const response = await page.request.get(new URL(source, page.url()).toString());
      if (!response.ok()) throw new Error(`PDF download failed: ${source} (${response.status()}).`);
    }
    const imageSources = await page.locator("img[src]").evaluateAll((images) => [...new Set(images.map((image) => image.getAttribute("src")).filter(Boolean))]);
    const missingImages = [];
    for (const source of imageSources) {
      const response = await page.request.get(new URL(source, page.url()).toString());
      if (!response.ok()) missingImages.push(`${source} (${response.status()})`);
    }
    if (missingImages.length) throw new Error(`Missing images: ${missingImages.join(", ")}`);

    for (const persona of ["customer", "super-admin", "booking-admin", "receptionist", "social-media"]) {
      await page.goto(`http://127.0.0.1:${port}/?persona=${persona}`, { waitUntil: "networkidle" });
      if (await page.locator(".persona-section").count() !== 1) throw new Error(`${persona} view did not render exactly one guide.`);
    }
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.goto(`http://127.0.0.1:${port}/?persona=customer`, { waitUntil: "networkidle" });
    const overflows = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflows) throw new Error("Customer guide has horizontal overflow at 390px.");
    await mobile.getByRole("button", { name: "Menu" }).click();
    if (!await mobile.locator("#site-nav").evaluate((nav) => nav.classList.contains("open"))) throw new Error("Mobile guide menu did not open.");
    await mobile.close();
  } finally { await browser.close(); }
  console.log("Browser smoke passed: persona navigation, screenshots, scenario counts, and mobile layout.");
} finally { server.kill("SIGTERM"); }
