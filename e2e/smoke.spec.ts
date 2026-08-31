import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const customer = {
  email: process.env.SEED_CUSTOMER_EMAIL ?? process.env.E2E_CUSTOMER_EMAIL ?? "player@sportbooking.local",
  password: process.env.SEED_CUSTOMER_PASSWORD ?? process.env.E2E_CUSTOMER_PASSWORD ?? "Player12345!"
};
const secondCustomer = {
  email: process.env.E2E_SECOND_CUSTOMER_EMAIL ?? "player-two@sportbooking.local",
  password: process.env.E2E_SECOND_CUSTOMER_PASSWORD ?? "Player12345!"
};
const admin = {
  email: process.env.SEED_ADMIN_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? "admin@sportbooking.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? "Admin12345!"
};
const receptionist = {
  email: process.env.E2E_RECEPTIONIST_EMAIL ?? "receptionist@sportbooking.local",
  password: process.env.E2E_RECEPTIONIST_PASSWORD ?? "Receptionist12345!"
};
const bookingAdmin = {
  email: process.env.E2E_BOOKING_ADMIN_EMAIL ?? "booking-admin@sportbooking.local",
  password: process.env.E2E_BOOKING_ADMIN_PASSWORD ?? "BookingAdmin12345!"
};
const socialMedia = {
  email: process.env.E2E_SOCIAL_MEDIA_EMAIL ?? "social-media@sportbooking.local",
  password: process.env.E2E_SOCIAL_MEDIA_PASSWORD ?? "SocialMedia12345!"
};

async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/facilities/, { timeout: 10_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findAvailableSlot(page: Page, route: string, startOffsetDays: number) {
  for (let offset = startOffsetDays; offset < startOffsetDays + 45; offset += 1) {
    const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.goto(`${route}?date=${date}`);
    const availableSlot = page.locator('button:not([disabled])').filter({ hasText: "Available" }).first();

    if (await availableSlot.count()) {
      return { date, availableSlot };
    }
  }

  throw new Error(`No available slot found for ${route} in the test booking window.`);
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
    const { availableSlot } = await findAvailableSlot(page, "/facilities/pickleball-court-1", 14);
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

  test("only one customer can checkout a conflicting cart schedule", async ({ browser }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    await signIn(firstPage, customer);
    await signIn(secondPage, secondCustomer);

    for (const page of [firstPage, secondPage]) {
      await page.goto("/cart");
      const clearCart = page.getByRole("button", { name: "Clear cart" });
      if (await clearCart.isVisible().catch(() => false)) {
        page.once("dialog", (dialog) => dialog.accept());
        await clearCart.click();
        await expect(page.getByText("Your cart is empty")).toBeVisible();
      }
    }

    const futureDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    for (const page of [firstPage, secondPage]) {
      await page.goto("/facilities/pickleball-court-2");
      await page.getByLabel("Booking date").fill(futureDate);
      await page.getByRole("button", { name: "Check availability" }).click();
      await page.waitForURL(new RegExp(`date=${futureDate}`));
      await page.locator('button:not([disabled])').filter({ hasText: "Available" }).first().click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Add to cart" }).click();
      await expect(page).toHaveURL(/\/cart\?added=1/);
      await expect(page.getByRole("heading", { name: "Pickleball Court 2" })).toBeVisible();
    }

    firstPage.once("dialog", (dialog) => dialog.accept());
    secondPage.once("dialog", (dialog) => dialog.accept());
    await Promise.all([
      firstPage.getByRole("button", { name: "Confirm consolidated checkout" }).click(),
      secondPage.getByRole("button", { name: "Confirm consolidated checkout" }).click()
    ]);

    await expect.poll(() => /\/orders\/[^/]+\/payment/.test(firstPage.url()) || /\/orders\/[^/]+\/payment/.test(secondPage.url()), { timeout: 15_000 }).toBe(true);
    const firstSucceeded = /\/orders\/[^/]+\/payment/.test(firstPage.url());
    const secondSucceeded = /\/orders\/[^/]+\/payment/.test(secondPage.url());
    expect(firstSucceeded !== secondSucceeded).toBe(true);
    const winner = firstSucceeded ? firstPage : secondPage;
    const loser = firstSucceeded ? secondPage : firstPage;
    await expect(winner).toHaveURL(/\/orders\/[^/]+\/payment/);
    await expect(loser).toHaveURL(/\/cart/);
    await expect(loser.getByText(/Checkout could not be completed|no longer available/i)).toBeVisible();
    await expect(loser.getByRole("heading", { name: "Pickleball Court 2" })).toBeVisible();

    const orderId = winner.url().match(/\/orders\/([^/]+)\/payment/)?.[1];
    expect(orderId).toBeTruthy();
    const orderReference = (await winner.getByRole("heading", { name: /^Order / }).textContent())?.replace(/^Order\s+/, "").trim();
    expect(orderReference).toBeTruthy();
    const proofReference = `UAT-CART-CONFLICT-${Date.now()}`;
    await winner.locator('input[name="externalReference"]').fill(proofReference);
    await winner.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await winner.getByRole("button", { name: "Submit consolidated proof" }).click();
    await expect(winner).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto(`/admin/orders?search=${encodeURIComponent(orderReference ?? "")}`);
    const orderRow = adminPage.locator("tr").filter({ hasText: orderReference ?? "" });
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("link").first().click();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await winner.goto(`/orders/${orderId}`);
    const bookingLink = winner.getByRole("link", { name: "Booking reference details" }).first();
    const bookingHref = await bookingLink.getAttribute("href");
    expect(bookingHref).toBeTruthy();
    await winner.goto(bookingHref!);
    await expect(winner.getByRole("button", { name: "Cancel booking" })).toBeVisible();
    winner.once("dialog", (dialog) => dialog.accept());
    await winner.getByRole("button", { name: "Cancel booking" }).click();
    await expect(winner.getByText(/Booking cancelled successfully/i)).toBeVisible();

    await adminContext.close();
    await firstContext.close();
    await secondContext.close();
  });

  test("customer sees an expired consolidated order and released schedules", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/orders/seed-expired-order/payment");

    await expect(page.getByText("Order Expired", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/This consolidated hold expired and all included schedules were released/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit consolidated proof" })).toHaveCount(0);

    await page.goto("/facilities/pickleball-court-1?date=2026-10-15");
    await expect(page.getByLabel("Booking date")).toHaveValue("2026-10-15");
    await expect(page.locator('button:not([disabled])').filter({ hasText: "Available" }).first()).toBeVisible();
  });

  test("admin can verify a submitted consolidated payment", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    const { availableSlot } = await findAvailableSlot(customerPage, "/facilities/badminton-court-1", 21);
    await availableSlot.click();
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

  test("admin can reject payment proof and customer sees the recovery state", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    const { availableSlot } = await findAvailableSlot(customerPage, "/facilities/3x3-court-b", 17);
    await availableSlot.click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const transferReference = `UAT-REJECT-${Date.now()}`;
    const rejectionReason = "The uploaded receipt does not show a matching transfer reference.";
    await customerPage.locator('input[name="externalReference"]').fill(transferReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const paymentRow = adminPage.locator("tr").filter({ hasText: transferReference });
    await expect(paymentRow).toBeVisible();
    await paymentRow.click();
    await expect(adminPage).toHaveURL(/\/admin\/payments\/[^/]+/);
    await adminPage.getByPlaceholder("Rejection reason").fill(rejectionReason);
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Reject payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=rejected/);
    await expect(adminPage.getByText(/Payment rejected successfully/i)).toBeVisible();

    await customerPage.goto(`/bookings/${bookingId}/payment`);
    await expect(customerPage.getByText("Payment Rejected", { exact: true }).first()).toBeVisible();
    await expect(customerPage.getByText(rejectionReason, { exact: true })).toBeVisible();
    await expect(customerPage.getByRole("button", { name: "Submit proof for verification" })).toHaveCount(0);

    await adminContext.close();
    await customerContext.close();
  });

  test("customer can cancel a newly confirmed single booking and release its slot", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/3x3-court-a");

    const futureDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));

    const availableSlot = customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first();
    const slotTime = (await availableSlot.locator("p").first().textContent())?.trim();
    expect(slotTime).toBeTruthy();
    await availableSlot.click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const transferReference = `UAT-CANCEL-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(transferReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const paymentRow = adminPage.locator("tr").filter({ hasText: transferReference });
    await expect(paymentRow).toBeVisible();
    await paymentRow.click();
    await expect(adminPage).toHaveURL(/\/admin\/payments\/[^/]+/);
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await customerPage.goto(`/bookings/${bookingId}`);
    await expect(customerPage.getByRole("button", { name: "Cancel booking" })).toBeVisible();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Cancel booking" }).click();
    await expect(customerPage.getByText(/Booking cancelled successfully/i)).toBeVisible();

    await customerPage.goto(`/facilities/3x3-court-a?date=${futureDate}`);
    await expect(customerPage.getByRole("button", { name: new RegExp(`${escapeRegExp(slotTime ?? "")}.*Available`, "i") })).toBeVisible();

    await adminContext.close();
    await customerContext.close();
  });

  test("customer can resubmit proof after an admin requests additional evidence", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/badminton-court-2");

    const futureDate = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));
    await customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first().click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const firstReference = `UAT-ACTION-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(firstReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const firstPaymentRow = adminPage.locator("tr").filter({ hasText: firstReference });
    await expect(firstPaymentRow).toBeVisible();
    await firstPaymentRow.click();
    await expect(adminPage).toHaveURL(/\/admin\/payments\/[^/]+/);
    await adminPage.getByPlaceholder("Instructions for customer").fill("Please upload a clearer receipt that shows the transfer reference.");
    await adminPage.getByRole("button", { name: "Request new proof" }).click();
    await expect(adminPage).toHaveURL(/outcome=action-required/);

    await customerPage.goto(`/bookings/${bookingId}/payment`);
    await expect(customerPage.getByText("Payment Needs Attention", { exact: true })).toBeVisible();
    await expect(customerPage.getByText(/clearer receipt that shows the transfer reference/i)).toBeVisible();
    const replacementReference = `UAT-RESUBMIT-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(replacementReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    await adminPage.goto("/admin/payments?pageSize=50");
    const replacementPaymentRow = adminPage.locator("tr").filter({ hasText: replacementReference });
    await expect(replacementPaymentRow).toBeVisible();
    await replacementPaymentRow.click();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await customerPage.goto(`/bookings/${bookingId}`);
    await expect(customerPage.getByText("CONFIRMED", { exact: true })).toBeVisible();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Cancel booking" }).click();
    await expect(customerPage.getByText(/Booking cancelled successfully/i)).toBeVisible();

    await adminContext.close();
    await customerContext.close();
  });

  test("admin can reschedule a paid booking and release the original slot", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/3x3-court-b");

    const futureDate = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));
    const originalSlot = customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first();
    const originalSlotTime = (await originalSlot.locator("p").first().textContent())?.trim();
    expect(originalSlotTime).toBeTruthy();
    await originalSlot.click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const transferReference = `UAT-RESCHEDULE-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(transferReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const paymentRow = adminPage.locator("tr").filter({ hasText: transferReference });
    await expect(paymentRow).toBeVisible();
    await paymentRow.click();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await adminPage.goto(`/admin/bookings/${bookingId}`);
    const replacementSlot = adminPage.locator("#replacement-slots a").filter({ hasText: "Available" }).first();
    await expect(replacementSlot).toBeVisible();
    await replacementSlot.click();
    await expect(adminPage.getByRole("heading", { name: "Document why this booking is moving" })).toBeVisible();
    await adminPage.getByLabel("Rescheduling reason").fill("Customer requested a later available slot.");
    await adminPage.getByRole("checkbox").check();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Confirm reschedule" }).click();
    await expect(adminPage).toHaveURL(/rescheduled=1/);
    await expect(adminPage.getByText(/Rescheduling changes saved successfully/i)).toBeVisible();
    await expect(adminPage.getByText("No rescheduling history.")).toHaveCount(0);

    await customerPage.goto(`/facilities/3x3-court-b?date=${futureDate}`);
    await expect(customerPage.getByRole("button", { name: new RegExp(`${escapeRegExp(originalSlotTime ?? "")}.*Available`, "i") })).toBeVisible();
    await customerPage.goto(`/bookings/${bookingId}`);
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Cancel booking" }).click();
    await expect(customerPage.getByText(/Booking cancelled successfully/i)).toBeVisible();

    await adminContext.close();
    await customerContext.close();
  });

  test("admin can complete a lower-price reschedule and resolve the adjustment", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/center-court");

    const futureDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));
    await customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first().click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const paymentReference = `UAT-LOWER-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(paymentReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const paymentRow = adminPage.locator("tr").filter({ hasText: paymentReference });
    await expect(paymentRow).toBeVisible();
    await paymentRow.click();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await adminPage.goto(`/admin/bookings/${bookingId}`);
    await adminPage.getByLabel("Replacement facility").selectOption({ label: "3x3 Court A" });
    await adminPage.waitForURL(/facilityId=.*date=/);
    const replacementSlot = adminPage.locator("#replacement-slots a").filter({ hasText: "Available" }).first();
    await expect(replacementSlot).toBeVisible();
    await replacementSlot.click();
    await expect(adminPage.getByRole("heading", { name: "Document why this booking is moving" })).toBeVisible();
    await adminPage.getByLabel("Rescheduling reason").fill("Customer requested a lower-cost replacement court.");
    await adminPage.getByRole("checkbox").check();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Confirm reschedule" }).click();
    await expect(adminPage).toHaveURL(/rescheduled=1/);
    await expect(adminPage.getByText(/Difference: -₱/)).toBeVisible();
    await expect(adminPage.getByText(/Adjustment: UNRESOLVED/i)).toBeVisible();

    await adminPage.locator('select[name="method"]').first().selectOption("MANUAL_REFUND");
    await adminPage.getByRole("textbox", { name: "Resolution notes" }).first().fill("UAT manual refund recorded for the lower replacement rate.");
    await adminPage.getByRole("button", { name: "Record resolution" }).first().click();
    await expect(adminPage.getByText(/Resolved as MANUAL REFUND/i)).toBeVisible();

    await customerPage.goto(`/bookings/${bookingId}`);
    await expect(customerPage.getByRole("heading", { name: "3x3 Court A" })).toBeVisible();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Cancel booking" }).click();
    await expect(customerPage.getByText(/Booking cancelled successfully/i)).toBeVisible();

    await adminContext.close();
    await customerContext.close();
  });

  test("admin can complete a higher-price reschedule after additional payment verification", async ({ browser }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto("/facilities/badminton-court-1");

    const futureDate = new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await customerPage.getByLabel("Booking date").fill(futureDate);
    await customerPage.getByRole("button", { name: "Check availability" }).click();
    await customerPage.waitForURL(new RegExp(`date=${futureDate}`));
    await customerPage.locator('button:not([disabled])').filter({ hasText: "Available" }).first().click();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: /Book now/i }).click();
    await expect(customerPage).toHaveURL(/\/bookings\/[^/]+\/payment/);

    const bookingId = customerPage.url().match(/\/bookings\/([^/]+)\/payment/)?.[1];
    expect(bookingId).toBeTruthy();
    const paymentReference = `UAT-HIGHER-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(paymentReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit proof for verification" }).click();
    await expect(customerPage).toHaveURL(/submitted=1/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admin/payments?pageSize=50");
    const paymentRow = adminPage.locator("tr").filter({ hasText: paymentReference });
    await expect(paymentRow).toBeVisible();
    await paymentRow.click();
    await adminPage.getByRole("button", { name: "Confirm payment" }).click();
    await expect(adminPage).toHaveURL(/outcome=verified/);

    await adminPage.goto(`/admin/bookings/${bookingId}`);
    await adminPage.getByLabel("Replacement facility").selectOption({ label: "Center Court" });
    await adminPage.waitForURL(/facilityId=.*date=/);
    const replacementSlot = adminPage.locator("#replacement-slots a").filter({ hasText: "Available" }).first();
    await expect(replacementSlot).toBeVisible();
    await replacementSlot.click();
    await expect(adminPage.getByRole("heading", { name: "Document why this booking is moving" })).toBeVisible();
    await adminPage.getByLabel("Rescheduling reason").fill("Customer requested a larger replacement court.");
    await adminPage.getByRole("checkbox").check();
    adminPage.once("dialog", (dialog) => dialog.accept());
    await adminPage.getByRole("button", { name: "Confirm reschedule" }).click();
    await expect(adminPage).toHaveURL(/rescheduled=1/);
    await expect(adminPage.getByText(/Difference: \+₱/)).toBeVisible();
    await expect(adminPage.getByText("ADDITIONAL PAYMENT REQUIRED", { exact: true })).toBeVisible();

    await customerPage.goto(`/bookings/${bookingId}/reschedule-payment`);
    await expect(customerPage.getByText("Complete the additional amount", { exact: true })).toBeVisible();
    const additionalReference = `UAT-ADDITIONAL-${Date.now()}`;
    await customerPage.locator('input[name="externalReference"]').fill(additionalReference);
    await customerPage.locator('input[name="proofImage"]').setInputFiles(path.resolve("public/MMG_STELLAR_logo.png"));
    await customerPage.getByRole("button", { name: "Submit additional payment proof" }).click();
    await expect(customerPage.getByText("Status: PAYMENT SUBMITTED. Staff is reviewing your proof.", { exact: true })).toBeVisible();

    await adminPage.goto("/admin/payments?reschedulePageSize=50");
    const additionalPaymentRow = adminPage.locator("tr").filter({ hasText: additionalReference });
    await expect(additionalPaymentRow).toBeVisible();
    await additionalPaymentRow.getByRole("link", { name: "Review" }).click();
    await expect(adminPage.getByRole("heading", { name: "Reschedule adjustment payment" })).toBeVisible();
    await adminPage.getByRole("button", { name: "Verify and complete reschedule" }).click();
    await expect(adminPage.getByText("VERIFIED", { exact: true }).first()).toBeVisible();

    await customerPage.goto(`/bookings/${bookingId}`);
    await expect(customerPage.getByRole("heading", { name: "Center Court" })).toBeVisible();
    customerPage.once("dialog", (dialog) => dialog.accept());
    await customerPage.getByRole("button", { name: "Cancel booking" }).click();
    await expect(customerPage.getByText(/Booking cancelled successfully/i)).toBeVisible();

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

  test("customer can sign out from the mobile menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, customer);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("admin can complete a new-customer cash walk-in booking", async ({ page }) => {
    await signIn(page, admin);
    const { availableSlot } = await findAvailableSlot(page, "/admin/walk-ins", 28);
    await availableSlot.click();

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

  test("customer sees an expired payment hold as expired and without payment actions", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/bookings/seed-pending-booking/payment");

    await expect(page.getByText("Reservation Expired", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/This unpaid reservation hold has expired/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit proof for verification" })).toHaveCount(0);
  });

  test("customer can review a past booking without cancellation controls", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/bookings/seed-confirmed-booking");

    await expect(page.getByRole("heading", { name: "Center Court" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
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

  test("receptionist can create walk-ins but cannot access payment verification", async ({ page }) => {
    await signIn(page, receptionist);
    await page.goto("/admin/walk-ins");
    await expect(page.getByRole("heading", { name: /walk-in bookings/i })).toBeVisible();
    await page.goto("/admin/payments");
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test("booking admin can access payments and reports but cannot manage pricing or roles", async ({ page }) => {
    await signIn(page, bookingAdmin);
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Payment verification" })).toBeVisible();
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
    await page.goto("/admin/pricing");
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto("/admin/roles");
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test("social media staff can access facility content but not customer or booking operations", async ({ page }) => {
    await signIn(page, socialMedia);
    await page.goto("/admin/facilities");
    await expect(page.getByRole("heading", { name: "Facility management" })).toBeVisible();
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto("/admin/walk-ins");
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test("customer cannot access the admin workspace", async ({ page }) => {
    await signIn(page, customer);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(login|forbidden)/);
  });

  test("registration preserves entered fields when a weak password is rejected", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("UAT Registration User");
    await page.getByLabel("Email").fill(`uat-registration-${Date.now()}@example.com`);
    await page.getByLabel("Mobile number").fill("09171234567");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("1234567890");
    await page.getByLabel("Confirm password").fill("1234567890");

    await expect(page.getByRole("button", { name: "Create customer account" })).toBeDisabled();
    await expect(page.getByText(/common password|password/i).last()).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("UAT Registration User");
    await expect(page.getByLabel("Mobile number")).toHaveValue("09171234567");
  });

  test("customer can register, verify email, and sign in", async ({ page }) => {
    const email = `delivered+uat-${Date.now()}@resend.dev`;
    const password = "BlueCourt12345!";

    await page.goto("/register");
    await page.getByLabel("Full name").fill("UAT Registration User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mobile number").fill("09171234567");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create customer account" }).click();

    await expect(page.getByText(/We sent a verification code to your email/i)).toBeVisible();
    const developmentCodeText = await page.getByText(/Development code:/i).textContent();
    const developmentCode = developmentCodeText?.match(/\b\d{6}\b/)?.[0];
    expect(developmentCode).toMatch(/^\d{6}$/);

    await page.getByLabel("Email verification code").fill("000000");
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.getByText(/Incorrect verification code/i)).toBeVisible();

    await page.getByLabel("Email verification code").fill(developmentCode!);
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page).toHaveURL(/\/login\?registered=1/);
    await expect(page.getByText("Email verified. Sign in to continue.", { exact: true })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/facilities/);
  });

  test("customer cannot access sensitive admin routes directly", async ({ page }) => {
    await signIn(page, customer);
    for (const route of ["/admin/payments", "/admin/pricing", "/admin/roles", "/admin/audit-logs"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/(login|forbidden)/);
    }
  });

  test("admin cannot reschedule a completed or past booking", async ({ page }) => {
    await signIn(page, admin);
    await page.goto("/admin/bookings/seed-confirmed-booking");
    await expect(page.getByRole("heading", { name: /Booking / })).toBeVisible();
    await expect(page.getByText("Completed or past bookings cannot be rescheduled.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm reschedule" })).toHaveCount(0);
  });
});
