import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const guideRoot = process.cwd();
const repoRoot = resolve(guideRoot, "..");
const output = resolve(guideRoot, "assets/screenshots");
await mkdir(output, { recursive: true });

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [key, value];
  }));
}

let fileEnv = {};
try { fileEnv = parseEnv(await readFile(resolve(repoRoot, ".env"), "utf8")); } catch { /* optional */ }
const env = { ...fileEnv, ...process.env };
const baseURL = env.GUIDE_APP_URL || "http://localhost:3000";
const customer = {
  email: env.GUIDE_CUSTOMER_EMAIL || env.SEED_CUSTOMER_EMAIL || env.E2E_CUSTOMER_EMAIL,
  password: env.GUIDE_CUSTOMER_PASSWORD || env.SEED_CUSTOMER_PASSWORD || env.E2E_CUSTOMER_PASSWORD
};
const admin = { email: env.GUIDE_SUPER_ADMIN_EMAIL || env.SEED_ADMIN_EMAIL || env.E2E_ADMIN_EMAIL, password: env.GUIDE_SUPER_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD || env.E2E_ADMIN_PASSWORD };
const manifest = [];
const browser = await chromium.launch();

async function signIn(page, credentials) {
  if (!credentials.email || !credentials.password) throw new Error("Missing guide screenshot credentials.");
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await page.waitForURL(/\/facilities(?:\?|$)/, { timeout: 15_000 });
  } catch {
    const visibleError = await page.locator("form .text-rose-300").last().textContent().catch(() => null);
    throw new Error(`Screenshot account could not sign in${visibleError ? `: ${visibleError}` : "."}`);
  }
}

async function capture(page, file, url, description, options = {}) {
  await page.goto(`${baseURL}${url}`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      img[src*="MMG_STELLAR_logo"] {
        width: 110px !important;
        height: auto !important;
        max-width: 110px !important;
        opacity: 1 !important;
        transform: none !important;
        clip-path: none !important;
      }
    `
  });
  if (options.after) await options.after(page);
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.textContent = node.textContent
        ?.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "uat-user@example.test")
        .replace(/(?:\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, "09XX XXX XXXX") ?? "";
      node = walker.nextNode();
    }
  });
  if (url.startsWith("/admin/payments")) {
    await page.evaluate(() => {
      document.querySelectorAll("table tbody tr td:first-child").forEach((cell, index) => {
        const name = cell.querySelector("p") ?? cell.firstElementChild;
        if (name) name.textContent = `UAT Customer ${index + 1}`;
      });
    });
  }
  await page.evaluate(async () => {
    await Promise.race([
      Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => undefined))),
      new Promise((resolveWait) => window.setTimeout(resolveWait, 1_000))
    ]);
  });
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: resolve(output, file), fullPage: options.fullPage ?? false });
  manifest.push({ file, route: url, description, capturedAt: new Date().toISOString(), viewport: page.viewportSize() });
  console.log(`Captured ${file}`);
}

try {
  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  const publicPage = await publicContext.newPage();
  await capture(publicPage, "customer-register.png", "/register", "Customer registration form");
  await capture(publicPage, "customer-forgot-password.png", "/forgot-password", "Customer password recovery form");
  await capture(publicPage, "customer-facilities.png", "/facilities", "Public facility listing");
  let firstFacilityHref = await publicPage.locator('a[href^="/facilities/"]').first().getAttribute("href");
  if (!firstFacilityHref) throw new Error("No public facility detail link was found.");
  await capture(publicPage, "customer-facility-detail.png", firstFacilityHref, "Public facility detail and booking workspace");
  await publicContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark" });
  const mobilePage = await mobileContext.newPage();
  await capture(mobilePage, "customer-facility-detail-mobile.png", firstFacilityHref, "Mobile facility detail and booking workspace");
  await mobileContext.close();

  const customerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  const customerPage = await customerContext.newPage();
  await signIn(customerPage, customer);
  await capture(customerPage, "customer-bookings.png", "/bookings", "Customer booking timeline");
  await capture(customerPage, "customer-cart.png", "/cart", "Customer consolidated booking cart");
  await capture(customerPage, "customer-account.png", "/account", "Customer profile and booking/payment inbox");
  await customerContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin);
  const adminRoutes = [
    ["admin-overview.png", "/admin", "Administrative operational overview"],
    ["admin-calendar.png", "/admin/calendar", "Administrative facility calendar"],
    ["admin-walkins.png", "/admin/walk-ins", "Walk-in booking workspace"],
    ["admin-facilities.png", "/admin/facilities", "Facility management workspace"],
    ["admin-pricing.png", "/admin/pricing", "Dynamic pricing management workspace"],
    ["admin-holidays.png", "/admin/holidays", "Holiday calendar"],
    ["admin-payments.png", "/admin/payments", "Payment verification queues"],
    ["admin-customers.png", "/admin/customers?search=Sample%20Player", "Customer management workspace"],
    ["admin-reports.png", "/admin/reports", "Operational and financial reports"],
    ["admin-roles.png", "/admin/roles", "Role and permission management"],
    ["admin-users.png", "/admin/admin-users?search=MVP%20Admin", "Administrative user management"],
    ["admin-audit.png", "/admin/audit-logs", "Administrative audit logs"]
  ];
  for (const [file, route, description] of adminRoutes) await capture(adminPage, file, route, description);
  await adminContext.close();
} finally {
  await browser.close();
}

await writeFile(resolve(output, "manifest.json"), `${JSON.stringify({ baseURL, screenshots: manifest }, null, 2)}\n`);
console.log(`Captured ${manifest.length} screenshots without storing account credentials.`);
