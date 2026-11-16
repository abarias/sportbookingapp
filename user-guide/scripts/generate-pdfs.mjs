import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.GUIDE_PDF_PORT || 4185);
const output = resolve(root, "output/pdf");
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [resolve(root, "scripts/serve.mjs"), root, String(port)], { stdio: "ignore" });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}`); if (response.ok) return; } catch { /* wait */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Timed out waiting for the guide server.");
}

const documents = [
  ["complete-user-guide.pdf", "all"],
  ["customer-user-guide.pdf", "customer"],
  ["super-admin-user-guide.pdf", "super-admin"],
  ["booking-admin-user-guide.pdf", "booking-admin"],
  ["receptionist-user-guide.pdf", "receptionist"],
  ["social-media-user-guide.pdf", "social-media"]
];

try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    for (const [file, persona] of documents) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const query = persona === "all" ? "?print=1" : `?persona=${persona}&print=1`;
      await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        const images = Array.from(document.images);
        images.forEach((image) => { image.loading = "eager"; });
        await Promise.all(images.map(async (image) => {
          if (!image.complete) {
            await new Promise((resolveImage) => {
              image.addEventListener("load", resolveImage, { once: true });
              image.addEventListener("error", resolveImage, { once: true });
            });
          }
          await image.decode().catch(() => undefined);
        }));
      });
      await page.emulateMedia({ media: "print" });
      await page.pdf({ path: resolve(output, file), format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
      await page.close();
      console.log(`Generated ${file}`);
    }
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); }
