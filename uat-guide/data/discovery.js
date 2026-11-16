window.UAT_DISCOVERY = {
  version: "2026.08.27",
  assessedCommit: "6363c3a",
  assessedBranch: "uat-testing",
  applicationName: "MMG Stellar Sports Booking",
  timezone: "Asia/Manila",
  confidenceLegend: {
    confirmed: "Confirmed from active application code, schema, migration, or automated test.",
    inferred: "Inferred from connected code paths; execute manually before accepting.",
    business: "The software behavior is visible, but the intended business outcome needs confirmation.",
    gap: "Not implemented or inconsistent in the assessed repository."
  },
  framework: [
    "Next.js 16 App Router with React 19 and strict TypeScript",
    "PostgreSQL through Prisma ORM",
    "Credentials authentication through NextAuth/Auth.js",
    "Tailwind CSS user interface",
    "Supabase Storage adapters for facility images and private payment proofs",
    "Resend for email verification and rescheduling emails",
    "Vercel Cron for booking/rescheduling expiry and notification delivery"
  ],
  lifecycle: {
    booking: ["HELD", "PENDING_PAYMENT (legacy-compatible)", "CONFIRMED", "CANCELLED", "EXPIRED"],
    payment: ["AWAITING_PAYMENT", "SUBMITTED", "VERIFIED", "REJECTED", "ACTION_REQUIRED", "legacy/future states: PENDING, PAID, FAILED, EXPIRED, REFUNDED"],
    reschedule: ["ADDITIONAL_PAYMENT_REQUIRED", "PAYMENT_SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED"]
  },
  configuration: [
    { name: "Customer payment hold", value: "15 minutes by default", evidence: "booking.paymentHoldMinutes / PAYMENT_HOLD_MINUTES" },
    { name: "Additional reschedule payment hold", value: "15 minutes by default", evidence: "RESCHEDULE_PAYMENT_HOLD_MINUTES" },
    { name: "Reschedule cutoff", value: "24 hours by default", evidence: "RESCHEDULE_CUTOFF_HOURS" },
    { name: "Customer booking duration", value: "1 to 4 hours, in hourly increments", evidence: "createBookingSchema and adminWalkInBookingSchema" },
    { name: "Internal slot resolution", value: "30 minutes", evidence: "Facility.slotIntervalMinutes and overlap logic" },
    { name: "Booking window", value: "Today through end of next month; through end of the following month from the last Monday onward", evidence: "src/server/bookings/booking-window.ts" },
    { name: "Cancellation window", value: "24 hours after booking creation by default, with per-facility override", evidence: "booking.cancellationWindowHours and facility override" },
    { name: "Email verification code", value: "6 digits, 15-minute default expiry, 5 failed attempts", evidence: "src/lib/config/auth.ts" },
    { name: "Registration throttling", value: "5 attempts per email/IP in 15 minutes by default", evidence: "src/features/auth/actions.ts" },
    { name: "Payment/facility image upload", value: "Images only; 5 MB maximum per file", evidence: "booking and admin upload actions" }
  ],
  personas: [
    {
      id: "customer",
      label: "Customer",
      short: "CUST",
      icon: "C",
      description: "Browses facilities, creates held bookings, submits payment proof, reviews history, and cancels eligible bookings.",
      permissions: ["Authenticated access to own bookings and payment records only"],
      routes: ["/facilities", "/facilities/[slug]", "/bookings", "/bookings/[id]/payment", "/bookings/[id]/reschedule-payment"]
    },
    {
      id: "super-admin",
      label: "Super Admin",
      short: "SA",
      icon: "SA",
      description: "Protected recovery role with every application permission.",
      permissions: ["All 24 permissions in the current catalog"],
      routes: ["All /admin routes"]
    },
    {
      id: "receptionist",
      label: "Receptionist",
      short: "REC",
      icon: "R",
      description: "Front-desk availability and walk-in booking access with limited customer information.",
      permissions: ["availability.view", "bookings.view", "bookings.create", "customers.view_limited"],
      routes: ["/admin", "/admin/calendar", "/admin/walk-ins"]
    },
    {
      id: "booking-admin",
      label: "Booking Admin",
      short: "BA",
      icon: "BA",
      description: "Booking, customer, payment, report, and normal rescheduling administration.",
      permissions: ["availability.view", "bookings.view", "bookings.create", "bookings.manage", "bookings.reschedule", "bookings.reschedule.resolve_adjustment", "customers.view_limited", "customers.view_full", "payments.view", "payments.verify", "reports.view", "reports.export"],
      routes: ["/admin", "/admin/calendar", "/admin/walk-ins", "/admin/customers", "/admin/payments", "/admin/reports", "/admin/bookings/[id]"]
    },
    {
      id: "social-media",
      label: "Social Media Person",
      short: "SOC",
      icon: "SM",
      description: "Edits customer-facing facility wording and manages facility photos only.",
      permissions: ["facility_content.edit", "facility_photos.manage"],
      routes: ["/admin/facilities"]
    }
  ],
  permissionCatalog: [
    ["availability.view", "View availability"],
    ["bookings.view", "View bookings"],
    ["bookings.create", "Create bookings"],
    ["bookings.manage", "Manage bookings"],
    ["bookings.reschedule", "Reschedule bookings"],
    ["bookings.reschedule.override_adjustment", "Override reschedule adjustment"],
    ["bookings.reschedule.resolve_adjustment", "Resolve reschedule adjustment"],
    ["customers.view_limited", "View limited customer details"],
    ["customers.view_full", "View full customer records"],
    ["payments.view", "View payments"],
    ["payments.verify", "Verify payments"],
    ["reports.view", "View reports"],
    ["reports.export", "Export reports (permission exists; no export UI route was found)"],
    ["facility_content.edit", "Edit facility content"],
    ["facility_photos.manage", "Manage facility photos"],
    ["facilities.manage", "Manage facility operations"],
    ["pricing.view", "View pricing"],
    ["pricing.manage", "Manage pricing"],
    ["holidays.manage", "Manage holidays"],
    ["roles.view", "View roles"],
    ["roles.manage", "Manage roles"],
    ["admin_users.view", "View admin users"],
    ["admin_users.manage", "Manage admin users"],
    ["audit_logs.view", "View audit logs"]
  ],
  knownFindings: [
    {
      level: "gap",
      title: "Registration verifies email, not mobile OTP",
      detail: "The current UI sends a six-digit verification code by email through Resend. A mobile number is collected but no SMS is sent. README and architecture text still describe mobile OTP.",
      evidence: ["src/features/auth/actions.ts", "src/components/auth/register-form.tsx", "src/lib/notifications/email.ts", "README.md"]
    },
    {
      level: "gap",
      title: "Global cancellation settings may be read under reversed variables",
      detail: "The customer bookings page queries the cancellation-window key into cancellationSetting and the enabled key into cancellationWindowSetting. Test cancellation with both global-only and facility overrides before sign-off.",
      evidence: ["src/app/bookings/page.tsx"]
    },
    {
      level: "gap",
      title: "No customer self-service rescheduling",
      detail: "Only authorized administrators can initiate rescheduling. Customers can submit an additional-payment proof after an admin creates a higher-price reschedule.",
      evidence: ["src/app/admin/bookings/[id]/page.tsx", "src/app/bookings/[id]/reschedule-payment/page.tsx"]
    },
    {
      level: "gap",
      title: "No check-in or attendance workflow",
      detail: "No route, model, or action for check-in was found.",
      evidence: ["src/app/admin", "prisma/schema.prisma"]
    },
    {
      level: "gap",
      title: "Report export permission has no matching export control",
      detail: "reports.export exists and is seeded for Booking Admin, but no export endpoint or button was found.",
      evidence: ["src/lib/auth/permissions.ts", "src/app/admin/reports/page.tsx"]
    },
    {
      level: "business",
      title: "Walk-ins are immediately verified and confirmed",
      detail: "A new walk-in customer is created/reused by staff and the booking is confirmed with a verified manual payment in one operation. Confirm this is the intended identity and payment policy.",
      evidence: ["src/components/admin/walk-in-booking-form.tsx", "src/server/bookings/service.ts"]
    },
    {
      level: "business",
      title: "Customer sees blocked inventory as Booked",
      detail: "The customer interface intentionally does not distinguish maintenance/private blocks from customer bookings.",
      evidence: ["src/components/bookings/booking-panel.tsx", "src/server/bookings/core.ts"]
    },
    {
      level: "inferred",
      title: "Only rescheduling lifecycle notifications are queued",
      detail: "Email verification is sent immediately; rescheduling uses an outbox and cron retries. General booking/payment/cancellation email templates were not found.",
      evidence: ["src/lib/notifications/email.ts", "src/lib/notifications/rescheduling.ts"]
    },
    {
      level: "gap",
      title: "No browser E2E test suite",
      detail: "Vitest unit/domain tests exist, but Playwright and Cypress are not installed. Browser scenarios in this guide remain manual until the optional capture tooling is enabled.",
      evidence: ["package.json", "src/**/*.test.ts"]
    }
  ],
  safeDataRules: [
    "Use only accounts and records prefixed with UAT-.",
    "Never use real customer names, phone numbers, email inboxes, payment references, or receipts.",
    "Use an approved test email domain/inbox supplied by the UAT coordinator.",
    "Use synthetic Philippine-format mobile numbers reserved by the team; do not message them.",
    "Use generated image fixtures containing the words UAT TEST ONLY for upload tests.",
    "Coordinate facility/date/time allocations before cross-role and concurrency tests.",
    "Do not run prisma seed against staging unless the environment owner explicitly approves it.",
    "Reset through approved UI actions where possible; ask the environment owner for database cleanup rather than deleting records directly."
  ]
};
