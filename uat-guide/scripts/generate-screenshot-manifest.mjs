import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadUatData } from "./load-data.mjs";

const root = process.cwd();
const { cases } = await loadUatData(root);

function routeFor(name) {
  if (/registration/.test(name)) return "/register";
  if (/verification/.test(name)) return "/verify-email";
  if (/login/.test(name)) return "/login";
  if (/facility-list|public-main-image/.test(name)) return "/facilities";
  if (/facility-detail|rate-card|slot|pricing-public|released-slot|booking-window|mixed-slot|blocked-dates/.test(name) && !/^admin|^receptionist|^booking-admin|^social-media/.test(name)) return "/facilities/{UAT_FACILITY_SLUG}";
  if (/payment|proof|action-required/.test(name) && /^customer/.test(name)) return "/bookings/{UAT_BOOKING_ID}/payment";
  if (/customer-(bookings|history|cancel|expired)|xrole-(reschedule-customer|hold-expired)/.test(name)) return "/bookings";
  if (/customer-reschedule-additional-payment/.test(name)) return "/bookings/{UAT_BOOKING_ID}/reschedule-payment";
  if (/calendar/.test(name)) return "/admin/calendar";
  if (/walkin/.test(name)) return "/admin/walk-ins";
  if (/admin-(facility|image|block|add-facility)|social-media/.test(name)) return "/admin/facilities";
  if (/pricing|rate-card-preview/.test(name)) return "/admin/pricing";
  if (/holiday/.test(name)) return "/admin/holidays";
  if (/role|custom-role|protected-super/.test(name)) return "/admin/roles";
  if (/admin-user|assignment-history|effective-permissions/.test(name)) return "/admin/admin-users";
  if (/audit|lockout/.test(name)) return "/admin/audit-logs";
  if (/report/.test(name)) return "/admin/reports";
  if (/payment-queue/.test(name)) return "/admin/payments";
  if (/admin-payment|booking-admin-payment/.test(name)) return "/admin/payments/{UAT_PAYMENT_ID}";
  if (/reschedule/.test(name)) return "/admin/bookings/{UAT_BOOKING_ID}";
  if (/overview|navigation|mobile-menu/.test(name)) return "/admin";
  return "/";
}

function authFor(name, testCase) {
  if (/registration|verification|login|facility-list|facility-detail|rate-card|public-main-image/.test(name)) return "public";
  if (testCase.persona === "customer" || /^customer/.test(name)) return "customer";
  if (testCase.persona === "receptionist" || /^receptionist/.test(name)) return "receptionist";
  if (testCase.persona === "booking-admin" || /^booking-admin/.test(name)) return "booking-admin";
  if (testCase.persona === "social-media" || /^social-media/.test(name)) return "social-media";
  return "super-admin";
}

const byName = new Map();
for (const testCase of cases) {
  for (const name of testCase.screenshots) {
    const current = byName.get(name) || {
      name,
      route: routeFor(name),
      auth: authFor(name, testCase),
      viewports: ["desktop", "mobile"],
      status: "placeholder",
      relatedTestCases: []
    };
    current.relatedTestCases.push(testCase.id);
    byName.set(name, current);
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  note: "Placeholder entries only. Capture with synthetic UAT accounts and records; never use real customer or payment data.",
  requiredVariables: ["UAT_APP_URL", "UAT_FACILITY_SLUG", "UAT_BOOKING_ID", "UAT_PAYMENT_ID", "UAT_<PERSONA>_EMAIL", "UAT_<PERSONA>_PASSWORD"],
  viewports: {
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 }
  },
  screenshots: [...byName.values()].sort((left, right) => left.name.localeCompare(right.name))
};

await mkdir(resolve(root, "assets/screenshots/captured"), { recursive: true });
await writeFile(resolve(root, "assets/screenshots/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifest.screenshots.length} screenshot placeholders.`);
