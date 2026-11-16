import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. From uat-guide, run `npm install --no-save playwright` only after the project owner approves this documentation-only dependency.");
  process.exit(1);
}

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "assets/screenshots/manifest.json"), "utf8"));
const baseUrl = process.env.UAT_APP_URL;
if (!baseUrl) throw new Error("Set UAT_APP_URL to the designated non-production UAT application URL.");

const accountEnv = {
  customer: ["UAT_CUSTOMER_EMAIL", "UAT_CUSTOMER_PASSWORD"],
  "super-admin": ["UAT_SUPER_ADMIN_EMAIL", "UAT_SUPER_ADMIN_PASSWORD"],
  receptionist: ["UAT_RECEPTIONIST_EMAIL", "UAT_RECEPTIONIST_PASSWORD"],
  "booking-admin": ["UAT_BOOKING_ADMIN_EMAIL", "UAT_BOOKING_ADMIN_PASSWORD"],
  "social-media": ["UAT_SOCIAL_MEDIA_EMAIL", "UAT_SOCIAL_MEDIA_PASSWORD"]
};
const substitutions = {
  UAT_FACILITY_SLUG: process.env.UAT_FACILITY_SLUG,
  UAT_BOOKING_ID: process.env.UAT_BOOKING_ID,
  UAT_PAYMENT_ID: process.env.UAT_PAYMENT_ID
};

function routeFor(entry) {
  let route = entry.route;
  for (const [key, value] of Object.entries(substitutions)) {
    if (route.includes(`{${key}}`)) {
      if (!value) return null;
      route = route.replaceAll(`{${key}}`, encodeURIComponent(value));
    }
  }
  return route;
}

const browser = await chromium.launch({ headless: true });
const contexts = new Map();
const output = resolve(root, "assets/screenshots/captured");
await mkdir(output, { recursive: true });

async function contextFor(auth, viewport) {
  const key = `${auth}:${viewport.width}x${viewport.height}`;
  if (contexts.has(key)) return contexts.get(key);
  const context = await browser.newContext({ viewportSize: viewport });
  if (auth !== "public") {
    const [emailKey, passwordKey] = accountEnv[auth] || [];
    const email = process.env[emailKey];
    const password = process.env[passwordKey];
    if (!email || !password) {
      await context.close();
      contexts.set(key, null);
      return null;
    }
    const page = await context.newPage();
    await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("networkidle");
    await page.close();
  }
  contexts.set(key, context);
  return context;
}

let captured = 0;
let skipped = 0;
for (const entry of manifest.screenshots) {
  const route = routeFor(entry);
  if (!route) { console.warn(`SKIP ${entry.name}: required record variable missing`); skipped += 2; continue; }
  for (const viewportName of entry.viewports) {
    const viewport = manifest.viewports[viewportName];
    const context = await contextFor(entry.auth, viewport);
    if (!context) { console.warn(`SKIP ${entry.name}-${viewportName}: credentials for ${entry.auth} missing`); skipped += 1; continue; }
    const page = await context.newPage();
    try {
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
      await page.screenshot({ path: resolve(output, `${entry.name}-${viewportName}.png`), fullPage: true });
      captured += 1;
    } catch (error) {
      console.warn(`SKIP ${entry.name}-${viewportName}: ${error.message}`);
      skipped += 1;
    } finally {
      await page.close();
    }
  }
}

for (const context of contexts.values()) if (context) await context.close();
await browser.close();
console.log(`Captured ${captured} screenshots; skipped ${skipped}. Review every image before changing manifest status.`);
