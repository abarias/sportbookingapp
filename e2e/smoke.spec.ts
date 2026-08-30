import { expect, test, type Page } from "@playwright/test";

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

  test("admin can access operational workspaces", async ({ page }) => {
    await signIn(page, admin);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payment verification" })).toBeVisible();
    await page.goto("/admin/walk-ins");
    await expect(page.getByRole("heading", { name: /walk-in bookings/i })).toBeVisible();
  });

  test("customer cannot access the admin workspace", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(login|forbidden)/);
  });
});
