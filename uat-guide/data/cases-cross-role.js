addUatCases([
  uatCase({
    id: "XROLE-HP-001", persona: "cross-role", category: "End-to-end", scenario: "Happy path", priority: "Critical",
    purpose: "Move a customer booking from hold to verified confirmation across roles.", feature: "Customer booking and payment verification",
    preconditions: ["Customer and Booking Admin use separate browsers", "One open UAT slot and synthetic receipt"], account: "Customer, then Booking Admin, then Receptionist",
    steps: [
      { action: "Customer: select an hourly slot, choose Reserve & Pay, and submit proof.", expected: "Handoff status: booking HELD, payment SUBMITTED; slot unavailable." },
      { action: "Booking Admin: open Payments, review the matching reference/proof, and Confirm payment.", expected: "Handoff status: payment VERIFIED, booking CONFIRMED; green outcome banner." },
      { action: "Customer: refresh My bookings.", expected: "Booking Confirmed is visible with the same amount/schedule." },
      { action: "Receptionist: open Calendar for the date.", expected: "The confirmed booking is present using limited customer identity." }
    ],
    finalExpected: "All three personas see one consistent booking/reference/status without duplicate revenue.", screenshots: ["xrole-payment-submitted", "xrole-payment-confirmed", "xrole-calendar-confirmed"],
    cleanup: "Retain as confirmed test evidence or cancel only through an approved policy test.", sourceEvidence: ["src/server/payments/service.ts", "src/server/admin/calendar.ts"]
  }),
  uatCase({
    id: "XROLE-REC-001", persona: "cross-role", category: "End-to-end", scenario: "Recovery", priority: "Critical",
    purpose: "Release an abandoned hold without admin intervention.", feature: "Cross-role hold expiry",
    preconditions: ["Customer creates a hold and submits no proof", "Second customer/receptionist tracks the slot"], account: "Two Customers and Receptionist",
    steps: [
      { action: "Customer A: reserve a slot and record the deadline.", expected: "Slot becomes unavailable in Customer B and Receptionist views." },
      { action: "Wait past expiry without keeping Customer A's browser open.", expected: "Authoritative deadline passes." },
      { action: "Customer B: refresh the facility; Receptionist: refresh Calendar/Walk-ins.", expected: "Slot is available in both views." },
      { action: "Customer A: open My bookings.", expected: "Expired record appears in History with no payment link." }
    ],
    finalExpected: "Expiry returns inventory consistently across all personas.", screenshots: ["xrole-hold-expired"],
    sourceEvidence: ["src/server/bookings/expiration.ts", "src/app/api/cron/expire-bookings/route.ts"]
  }),
  uatCase({
    id: "XROLE-HP-002", persona: "cross-role", category: "End-to-end", scenario: "Happy path", priority: "High",
    purpose: "Create a new walk-in and verify visibility for operations and customer history.", feature: "Walk-in lifecycle",
    preconditions: ["Fresh UAT identity and available slot", "Coordinate whether the new account password/login path is expected"], account: "Receptionist, Booking Admin, optional Customer",
    steps: [
      { action: "Receptionist: create a confirmed walk-in with Cash.", expected: "One Customer, Booking, and verified Payment are created in one operation." },
      { action: "Booking Admin: search Customers and select the UAT walk-in.", expected: "Booking and payment method/reference are visible." },
      { action: "Booking Admin: inspect Calendar and Reports.", expected: "Booking occupies the slot and verified amount is counted once." },
      { action: "If the customer can authenticate through the agreed onboarding path, open My bookings.", expected: "The same booking appears; otherwise mark this step Blocked pending business onboarding decision." }
    ],
    finalExpected: "Walk-in data is consistent; customer account-access expectations are explicitly confirmed.", screenshots: ["xrole-walkin-customer-history"],
    sourceEvidence: ["src/features/admin/actions.ts", "src/server/bookings/service.ts"], confidence: "business"
  }),
  uatCase({
    id: "XROLE-HP-003", persona: "cross-role", category: "End-to-end", scenario: "Happy path", priority: "Critical",
    purpose: "Reschedule a verified booking and reconcile old/new slots, history, and notification.", feature: "Cross-role rescheduling",
    preconditions: ["Eligible confirmed booking", "Booking Admin and Customer testers", "Replacement slot"], account: "Booking Admin, Customer, Receptionist",
    steps: [
      { action: "Booking Admin: complete a same-price replacement with customer-facing note.", expected: "Booking remains confirmed on new schedule and history records old schedule." },
      { action: "Customer: refresh My bookings and check email if enabled.", expected: "Current schedule is unambiguous; previous schedule is historical; no internal note appears." },
      { action: "Receptionist: inspect both facility/date schedules.", expected: "Old slot is available and new slot booked." },
      { action: "Booking Admin: inspect Reports and booking history.", expected: "One booking/payment is counted; initiator and timestamps are traceable." }
    ],
    finalExpected: "Rescheduling changes inventory once while preserving payment and customer-safe history.", screenshots: ["xrole-reschedule-customer", "xrole-reschedule-calendar"],
    sourceEvidence: ["src/server/bookings/rescheduling.ts", "src/lib/notifications/rescheduling.ts"]
  }),
  uatCase({
    id: "XROLE-HP-004", persona: "cross-role", category: "End-to-end", scenario: "Happy path", priority: "Critical",
    purpose: "Propagate a pricing change from administration to public rate card and new bookings only.", feature: "Pricing propagation",
    preconditions: ["Dedicated UAT facility", "Existing future booking snapshot", "Open future slot"], account: "Super Admin and Customer",
    steps: [
      { action: "Super Admin: record the existing booking amount, add/update a future-effective pricing rule, and save.", expected: "Admin warns that future active booking snapshots will not change." },
      { action: "Customer: open the facility on an affected date.", expected: "Public rate card and slot labels show the new VAT-exclusive base rate." },
      { action: "Customer: create a new hold in the affected time.", expected: "Server-calculated payment amount matches the new rule." },
      { action: "Super Admin: re-open the existing booking.", expected: "Its historical amount/snapshot remains unchanged." }
    ],
    finalExpected: "Pricing changes affect new quotes/bookings only and never rewrite history.", screenshots: ["xrole-pricing-public", "xrole-pricing-snapshot"],
    cleanup: "Deactivate the UAT override after evidence capture.", sourceEvidence: ["src/server/pricing/engine.ts", "src/server/pricing/snapshot.ts", "src/app/admin/pricing/page.tsx"]
  }),
  uatCase({
    id: "XROLE-PERM-001", persona: "cross-role", category: "Access control", scenario: "Happy path", priority: "Critical",
    purpose: "Create a custom role and verify both granted and denied actions.", feature: "Configurable RBAC",
    preconditions: ["Dedicated UAT admin user"], account: "Super Admin and custom-role user",
    steps: [
      { action: "Super Admin: create UAT-Availability Reviewer with availability.view only and assign it.", expected: "Effective permissions show only the selected capability and dependencies." },
      { action: "Custom user: sign in and open Calendar.", expected: "Calendar access succeeds." },
      { action: "Custom user: directly open Payments, Customers, Pricing, Facilities, and Roles.", expected: "Every prohibited route is denied." },
      { action: "Super Admin: add payments.view, save, and have the user retry without signing out.", expected: "Payments becomes accessible on the next request; verify controls remain absent." }
    ],
    finalExpected: "Permission changes are immediate, additive, and enforced by capability rather than role name.", screenshots: ["xrole-custom-role", "xrole-custom-role-forbidden"],
    cleanup: "Remove assignment and delete the unused UAT role.", sourceEvidence: ["src/lib/auth/authorization.ts", "src/features/rbac/actions.ts"]
  }),
  uatCase({
    id: "XROLE-CONC-001", persona: "cross-role", category: "Booking integrity", scenario: "Edge", priority: "Critical",
    purpose: "Prove only one of two competing customers can hold the same inventory.", feature: "Database overlap protection",
    preconditions: ["Two Customers, synchronized clocks, same open facility/hour"], account: "Two Customers and Receptionist observer",
    steps: [
      { action: "Both customers select the same slot and pause at confirmation.", expected: "No hold exists yet; observer sees available." },
      { action: "Both confirm Reserve & Pay simultaneously.", expected: "Exactly one succeeds and one receives conflict." },
      { action: "Receptionist: refresh Calendar/Walk-ins.", expected: "Exactly one held booking occupies the slot." },
      { action: "Search each customer's My bookings.", expected: "Only the successful customer has the held record." }
    ],
    finalExpected: "No double booking exists at UI, service, or database level.", screenshots: ["xrole-concurrency-result"],
    sourceEvidence: ["prisma/migrations/20260815140500_update_overlap_guards_for_held_bookings/migration.sql", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "XROLE-PERM-002", persona: "cross-role", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Confirm sensitive data is inaccessible to Customer, Receptionist, and Social Media users.", feature: "Sensitive-data isolation",
    preconditions: ["Known UAT customer/payment/admin URLs", "Separate browsers for each persona"], account: "Customer, Receptionist, Social Media Person, Super Admin observer",
    steps: [
      { action: "Customer: try an admin customer/payment URL; Receptionist and Social Media: try customer, payment, report, role, and audit URLs.", expected: "Every unauthorized request is denied without record details." },
      { action: "Attempt to reuse a private proof URL in an unauthorized browser after its signed lifetime or session context.", expected: "Access is denied/expired; permanent public access is a Critical defect." },
      { action: "Super Admin: verify only authorized audit entries and no verification code/password/storage token appears.", expected: "Logs contain actor/action/context but no secrets." }
    ],
    finalExpected: "Protected personal, payment, and security data never crosses persona boundaries.", screenshots: ["xrole-sensitive-data-denied"],
    sourceEvidence: ["src/lib/auth/authorization.ts", "src/lib/storage/payment-proofs.ts", "src/server/admin/queries.ts"]
  }),

  uatCase({
    id: "GEN-RESP-001", persona: "general", category: "Responsive", scenario: "Edge", priority: "High",
    purpose: "Check the complete portal/app shell at representative viewports.", feature: "Responsive browser matrix",
    preconditions: ["Test Chrome latest, Safari latest, and mobile Safari/Chrome where available"], account: "Any relevant persona",
    steps: [
      { action: "At 390x844, 768x1024, 1280x800, and 1440x900, open home, facility detail, bookings, and one admin page.", expected: "No page-level horizontal scrolling, overlap, clipped actions, or detached dropdowns." },
      { action: "Zoom desktop browser to 200%.", expected: "Content reflows and primary actions remain reachable." },
      { action: "Rotate a real mobile device.", expected: "State is preserved and layout adapts without reload errors." }
    ],
    finalExpected: "Supported pages remain readable and operable across target browsers/viewports.", screenshots: ["responsive-viewport-matrix"],
    sourceEvidence: ["src/app", "src/components"]
  }),
  uatCase({
    id: "GEN-EXC-001", persona: "general", category: "Reliability", scenario: "Exception", priority: "High",
    purpose: "Observe safe behavior during failed or interrupted network requests.", feature: "Network failure handling",
    preconditions: ["Browser DevTools can simulate Offline/Slow 3G", "Use a non-destructive UAT record"], account: "Customer or authorized admin",
    steps: [
      { action: "Set Offline immediately before a form submission.", expected: "The operation does not appear successful; the user can retry after reconnecting." },
      { action: "Reconnect and refresh before retrying.", expected: "Authoritative current state appears." },
      { action: "Retry once and inspect for duplicates.", expected: "At most one booking/payment/reschedule/facility mutation exists." },
      { action: "Repeat under Slow 3G and double-click the action.", expected: "Pending/disabled text prevents accidental repeat where implemented." }
    ],
    finalExpected: "Failure is recoverable and does not produce ambiguous duplicate records.", screenshots: ["general-network-failure"],
    sourceEvidence: ["src/components", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "GEN-ACC-001", persona: "general", category: "Accessibility", scenario: "Edge", priority: "High",
    purpose: "Check keyboard, focus, labels, announcements, and non-color status across personas.", feature: "Accessibility baseline",
    preconditions: ["Keyboard-only pass", "Optional VoiceOver/NVDA pass"], account: "Customer and one admin persona",
    steps: [
      { action: "Navigate header, menu, forms, slot grids, tables, pagination, dialogs, and accordions using keyboard only.", expected: "Every interactive control is reachable, visible on focus, named, and operable." },
      { action: "Trigger errors and successes.", expected: "Messages are understandable and associated/announced without requiring color." },
      { action: "Review image alternative text and table headers.", expected: "Facility images are described and data tables have meaningful headers." },
      { action: "Check contrast in available/booked/selected/status states.", expected: "Text remains legible and labels distinguish states." }
    ],
    finalExpected: "No critical task requires pointer precision, color perception, or visual guesswork.", screenshots: ["general-accessibility-focus"],
    sourceEvidence: ["src/components"]
  }),
  uatCase({
    id: "GEN-UX-001", persona: "general", category: "Usability", scenario: "Edge", priority: "Medium",
    purpose: "Check plain-language status, destructive confirmations, and timestamps.", feature: "Usability consistency",
    preconditions: ["Use customer and admin booking/payment/reschedule records"], account: "Customer and Super Admin",
    steps: [
      { action: "Compare status labels across My bookings, Payment, Calendar, Payments, and Rescheduling.", expected: "Customer views use plain language; internal enum names are not exposed as the main message." },
      { action: "Compare displayed dates/times.", expected: "They are consistently understandable as Asia/Manila/local venue time." },
      { action: "Attempt Cancel, Reject, Delete rule, Delete role, and Confirm reschedule.", expected: "Destructive or consequential actions require explicit confirmation and required reasons where designed." },
      { action: "Review empty states and validation messages.", expected: "They explain the next action rather than showing technical errors." }
    ],
    finalExpected: "Terminology and confirmations are consistent enough for business users.", screenshots: ["general-status-language"],
    sourceEvidence: ["src/components/bookings", "src/components/admin"]
  })
]);
