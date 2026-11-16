import { expect, test } from "@playwright/test";
import data from "../prisma/data/faq.json";

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
  test(`public FAQ navigation, content and keyboard accordion at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/facilities");
    if (viewport.width < 768) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "FAQs", exact: true }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole("heading", { level: 1, name: "Frequently asked questions" })).toBeVisible();
    const topics = page.locator("main details");
    await expect(topics).toHaveCount(data.topics.length);
    await expect(page.locator("main details[open]")).toHaveCount(0);
    await expect(page.locator("main summary h2")).toHaveText(data.topics.map((topic) => topic.title));
    await page.screenshot({ path: testInfo.outputPath("faq-collapsed.png"), fullPage: true, animations: "disabled" });

    const first = topics.first();
    const control = first.locator("summary");
    await control.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.getByRole("heading", { level: 3 })).toHaveText(data.topics[0].items.map((item) => item.question));
    await expect(first.getByText(/We are open Mondays to Sundays, 7:00am to 12:00mn/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("faq-expanded.png"), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Space");
    await expect(first).not.toHaveAttribute("open");
    await expect(first.getByRole("heading", { level: 3 })).toBeHidden();

    // Click toggles and multiple-open behavior, plus all PDF questions in order.
    for (const [index, topic] of data.topics.entries()) {
      const panel = topics.nth(index);
      await panel.locator("summary").click();
      await expect(panel.getByRole("heading", { level: 3 })).toHaveText(topic.items.map((item) => item.question));
    }
    await expect(page.locator("main details[open]")).toHaveCount(9);
    await expect(page.locator("main ul li")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "mmgstellartaguig@gmail.com" }).first()).toHaveAttribute("href", "mailto:mmgstellartaguig@gmail.com");
    await expect(page.getByText(/violation of facility rules. Applicable repair or replacement costs may be charged/)).toBeVisible();
    await expect(page.getByText(/Reschedule requests may be directed to our front desk/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    await topics.last().locator("summary").click();
    await expect(topics.last()).not.toHaveAttribute("open");
  });
}

test.describe("native FAQ disclosure", () => {
  test.use({ javaScriptEnabled: false });
  test("works without JavaScript", async ({ page }) => {
    await page.goto("/faq");
    const topic = page.locator("main details").first();
    await expect(topic).toBeVisible();
    await expect(topic).not.toHaveAttribute("open");
    await topic.locator("summary").click();
    await expect(topic.getByRole("heading", { name: "What are your operating hours?" })).toBeVisible();
  });
});

test("signed-in customer can reach FAQs without tablet overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.SEED_CUSTOMER_EMAIL ?? process.env.E2E_CUSTOMER_EMAIL ?? "player@sportbooking.local");
  await page.getByLabel("Password").fill(process.env.SEED_CUSTOMER_PASSWORD ?? process.env.E2E_CUSTOMER_PASSWORD ?? "Player12345!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/facilities/);
  await page.getByRole("link", { name: "FAQs", exact: true }).click();
  await expect(page.locator("main details")).toHaveCount(9);
  await page.screenshot({ path: testInfo.outputPath("faq-customer-tablet.png"), fullPage: true, animations: "disabled" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
});
