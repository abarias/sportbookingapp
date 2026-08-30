import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const customer = {
  email: "player@sportbooking.local",
  password: "Player12345!"
};
const admin = {
  email: "admin@sportbooking.local",
  password: "Admin12345!"
};

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/facilities/, { timeout: 10_000 });
}

test.describe("release smoke", () => {
  test("public facility browsing works", async ({ page }) => {
    await page.goto("/facilities");
    await expect(page.getByRole("heading", { name: /facilities/i }).first()).toBeVisible();
    const centerCourt = page.locator('a[href="/facilities/center-court"]');
    await expect(centerCourt).toBeVisible();
    await centerCourt.click();
    await expect(page).toHaveURL(/\/facilities\/center-court/);
    await expect(page.getByText(/VAT exclusive/i).first()).toBeVisible();
  });

  test("customer can reach an available booking checkout", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/facilities/center-court");
    await expect(page.getByText(/Sign in to select available hourly slots|Choose hourly slots/i)).toBeVisible();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel("Booking date").fill(futureDate);
    await page.getByRole("button", { name: "Check availability" }).click();
    await page.waitForURL(new RegExp(`date=${futureDate}`));

    const availableSlot = page.locator('button:not([disabled])').filter({ hasText: "Available" }).first();
    await expect(availableSlot).toBeVisible();
    await availableSlot.click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Book now/i }).click();
    await expect(page).toHaveURL(/\/bookings\/[^/]+\/payment/);
    await expect(page.getByText(/payment/i).first()).toBeVisible();
  });

  test("customer can add another facility schedule to the cart", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/cart");
    const clearCart = page.getByRole("button", { name: "Clear cart" });
    if (await clearCart.isVisible().catch(() => false)) {
      page.once("dialog", (dialog) => dialog.accept());
      await clearCart.click();
      await expect(page.getByText("Your cart is empty")).toBeVisible();
    }
    await page.goto("/facilities/pickleball-court-1");

    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel("Booking date").fill(futureDate);
    await page.getByRole("button", { name: "Check availability" }).click();
    await page.waitForURL(new RegExp(`date=${futureDate}`));

    const availableSlot = page.locator('button:not([disabled])').filter({ hasText: "Available" }).first();
    await expect(availableSlot).toBeVisible();
    await availableSlot.click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page).toHaveURL(/\/cart\?added=1/);
    await expect(page.getByText("Consolidated checkout", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pickleball Court 1" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Confirm consolidated checkout" }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+\/payment\?created=1/);
    await expect(page.getByText(/Checkout completed/i)).toBeVisible();

    await page.locator('input[name="externalReference"]').fill(`UAT-${Date.now()}`);
    await page.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await page.getByRole("button", { name: "Submit consolidated proof" }).click();
    await expect(page).toHaveURL(/submitted=1/);
    await expect(page.getByText(/Payment proof submitted successfully/i)).toBeVisible();
  });

  test("admin can verify a submitted consolidated payment", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/badminton-court-1");

    const futureDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));
    await customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first().click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Add to cart" }).click();
    await expect(customerPage).toHaveURL(/\/cart\?added=1/);
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Confirm consolidated checkout" }).click();
    await expect(customerPage).toHaveURL(/\/orders\/[^/]+\/payment\?created=1/);
    const orderHeading = customerPage.getByRole("heading", { name: /^Order / });
    const orderReference = (await orderHeading.textContent())?.replace(/^Order\s+/, "").trim();
    expect(orderReference).toBeTruthy();

    const transferReference = `UAT-VERIFY-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(transferReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit consolidated proof" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto(`/admin/orders?search=${encodeURIComponent(orderReference ?? "")}`);
    const orderRow = adminPage.locator("tr").filter({ hasText: orderReference ?? "" });
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("link").first().click();
    const paymentRow = adminPage.locator("body");
    await expect(paymentRow).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Payment review" })).toBeVisible();
    await expect(adminPage.getByText(transferReference, { exact: false })).toBeVisible();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);
    await expect(adminPage.getByText(/Payment confirmed successfully/i)).toBeVisible();

    await adminContext.close();
    await customerContext.close();
  });

  test("customer booking page fits a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, customer);
    await page.goto("/facilities/center-court");
    await expect(page.getByRole("heading", { name: "Center Court" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("admin can complete a new-customer cash walk-in booking", async ({ page }) => {
    await signIn(page, admin);
    await page.goto("/admin/walk-ins");

    const futureDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel("Booking date").fill(futureDate);
    await page.getByRole("button", { name: "Check availability" }).click();
    await page.waitForURL(new RegExp(`date=${futureDate}`));
    await page.getByRole("button", { name: /Available/i }).first().click();

    const suffix = Date.now();
    await page.getByLabel("Customer name").fill(`UAT Walk-in ${suffix}`);
    await page.getByLabel("Mobile number").fill(`0917${String(suffix).slice(-7)}`);
    await page.getByLabel("Email address").fill(`uat-walkin-${suffix}@example.com`);
    await page.getByRole("button", { name: "Check customer details" }).click();
    await expect(page.getByRole("heading", { name: "Capture payment and confirm" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Create confirmed walk-in booking" }).click();
    await expect(page).toHaveURL(/\/admin\/bookings\/[^?]+\?walkInCreated=1/);
    await expect(page.getByText(/Walk-in booking created successfully/i)).toBeVisible();
  });

  test("customer can view the booking timeline", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
    await expect(page.getByText(/Signed in as/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  });

  test("admin can access operational workspaces", async ({ page }) => {
    await signIn(page, admin);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payment verification" })).toBeVisible();
    await expect(page.getByText("Payment queue", { exact: true })).toBeVisible();
    await page.goto("/admin/walk-ins");
    await expect(page.getByRole("heading", { name: /walk-in bookings/i })).toBeVisible();
  });

  test("customer cannot access the admin workspace", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(login|forbidden)/);
  });
});
