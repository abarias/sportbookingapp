addUatCases([
  uatCase({
    id: "REC-HP-001", persona: "receptionist", category: "Operations", scenario: "Happy path", priority: "High",
    purpose: "Use only the front-desk overview, calendar, and walk-in tools.", feature: "Receptionist workspace",
    preconditions: ["Receptionist role has its seeded permissions only"], account: "Receptionist",
    steps: [
      { action: "Sign in and inspect the admin menu.", expected: "Overview, Calendar, and Walk-ins are visible; customer directory, payments, reports, pricing, facilities, roles, users, and audit are absent." },
      { action: "Open Overview and Calendar.", expected: "Booking status and availability are visible; paid revenue and full contact details are not returned." },
      { action: "Inspect a calendar booking.", expected: "Only the minimum operational customer identity is shown." }
    ],
    finalExpected: "Receptionist access is sufficient for front-desk work and minimized for personal/financial data.", screenshots: ["receptionist-navigation", "receptionist-calendar"],
    sourceEvidence: ["src/lib/auth/permissions.ts", "src/app/admin/page.tsx", "src/server/admin/calendar.ts"]
  }),
  uatCase({
    id: "REC-HP-002", persona: "receptionist", category: "Walk-ins", scenario: "Happy path", priority: "Critical",
    purpose: "Create a confirmed walk-in booking for a genuinely new customer.", feature: "Walk-in booking",
    preconditions: ["Future available hourly slots", "Fresh UAT email and mobile not in the database"], account: "Receptionist",
    data: ["UAT-WalkIn name", "Valid UAT mobile and email", "Cash, GCash, or Bank transfer"],
    steps: [
      { action: "Open Walk-ins, select a facility/date, and choose consecutive hourly slots.", expected: "Booked/blocked inventory is unavailable and each open slot shows the same pricing labels as customer booking." },
      { action: "Enter required customer name, mobile, and email; select Check customer details.", expected: "The page confirms a new walk-in customer can proceed." },
      { action: "Choose Cash and optionally enter a receipt reference, then Create confirmed booking and accept confirmation.", expected: "One confirmed/verified booking is created immediately with no hold." },
      { action: "Observe the post-save page.", expected: "The walk-in form resets/refreshes and the booked slot is now unavailable." }
    ],
    finalExpected: "A new walk-in customer and one confirmed paid booking are traceable without an unpaid hold.", screenshots: ["receptionist-walkin-slots", "receptionist-walkin-payment"],
    cleanup: "Retain the booking for cross-role visibility tests or cancel through an approved process.", sourceEvidence: ["src/components/admin/walk-in-booking-form.tsx", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "REC-EDGE-001", persona: "receptionist", category: "Walk-ins", scenario: "Edge", priority: "High",
    purpose: "Detect an existing customer and direct them to their own booking flow.", feature: "Walk-in customer lookup",
    preconditions: ["Known UAT customer email and mobile exist"], account: "Receptionist",
    steps: [
      { action: "Select an available slot, then enter the existing customer's matching email and mobile.", expected: "The page recognizes the existing customer and asks them to sign in on their own device." },
      { action: "Attempt to continue staff booking without a new-customer confirmation.", expected: "The confirmed walk-in action remains unavailable." },
      { action: "Use mismatched existing email/mobile combinations.", expected: "The app does not silently merge or overwrite customer identity; record the exact safe message." }
    ],
    finalExpected: "Reception staff cannot create a duplicate identity for an existing customer.", screenshots: ["receptionist-existing-customer"],
    sourceEvidence: ["src/components/admin/walk-in-booking-form.tsx", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "REC-NEG-001", persona: "receptionist", category: "Validation", scenario: "Negative", priority: "High",
    purpose: "Reject invalid walk-in identity, payment, duration, and stale inventory.", feature: "Walk-in validation",
    preconditions: ["One future open slot", "A second tester who can take it"], account: "Receptionist",
    steps: [
      { action: "Submit blank/invalid name, email, and Philippine mobile values.", expected: "Field-specific messages appear and no customer is created." },
      { action: "Choose GCash/Bank transfer without a transaction reference.", expected: "A transaction reference is required; Cash may leave it blank." },
      { action: "Attempt more than four hours, less than one hour, or non-hourly duration through stale/crafted input.", expected: "Server validation rejects it." },
      { action: "Have another tester reserve the selected slot before final confirmation, then submit.", expected: "Conflict is shown and no walk-in booking/payment is created." }
    ],
    finalExpected: "Validation and final availability checks prevent partial customer or booking records.", screenshots: ["receptionist-walkin-validation"],
    sourceEvidence: ["src/features/admin/schemas.ts", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "REC-PERM-001", persona: "receptionist", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Deny configuration, payment, report, role, and full-customer access by direct URL.", feature: "Receptionist authorization",
    preconditions: ["Receptionist is signed in"], account: "Receptionist",
    data: ["/admin/facilities", "/admin/pricing", "/admin/holidays", "/admin/payments", "/admin/customers", "/admin/reports", "/admin/roles", "/admin/admin-users", "/admin/audit-logs"],
    steps: [
      { action: "Enter each prohibited URL directly, one at a time.", expected: "Each request reaches Forbidden or another safe denial, never the page data." },
      { action: "Use browser Back after each denial.", expected: "No prohibited content flashes or remains cached." },
      { action: "Attempt an old bookmarked booking-reschedule or payment-review URL.", expected: "Access is denied server-side." }
    ],
    finalExpected: "Receptionist cannot obtain prohibited records or mutation controls through navigation tricks.", screenshots: ["receptionist-forbidden"],
    sourceEvidence: ["src/lib/auth/authorization.ts", "src/app/admin/*/page.tsx"]
  }),
  uatCase({
    id: "REC-REC-001", persona: "receptionist", category: "Reliability", scenario: "Recovery", priority: "High",
    purpose: "Recover safely from refresh, back navigation, and duplicate submission.", feature: "Walk-in reliability",
    preconditions: ["Valid new UAT walk-in details and available slot"], account: "Receptionist",
    steps: [
      { action: "Complete customer lookup, refresh, and use Back/Forward.", expected: "No customer or booking is created merely by navigation; the form returns to a safe state." },
      { action: "At final confirmation, double-click Create confirmed booking or retry after a slow response.", expected: "At most one confirmed booking occupies the slot." },
      { action: "If the result is unclear, inspect Calendar rather than resubmitting.", expected: "One definitive booking is visible." }
    ],
    finalExpected: "Network/navigation retries do not duplicate walk-in inventory.", screenshots: ["receptionist-walkin-recovery"],
    sourceEvidence: ["src/server/bookings/service.ts", "prisma/migrations/20260815134500_add_booking_overlap_guards/migration.sql"]
  }),
  uatCase({
    id: "REC-RESP-001", persona: "receptionist", category: "Responsive", scenario: "Edge", priority: "Medium",
    purpose: "Run a front-desk booking on tablet and mobile widths.", feature: "Receptionist responsive layout",
    preconditions: ["Tablet portrait and 390px mobile viewport"], account: "Receptionist",
    steps: [
      { action: "Open Calendar day detail and Walk-ins at both widths.", expected: "Facility and hourly slot controls do not overflow horizontally." },
      { action: "Complete customer and payment fields using keyboard/touch.", expected: "Labels remain visible and dropdown options stay attached." },
      { action: "Open/close the navigation menu.", expected: "All Receptionist options are reachable and the popup dismisses after selection." }
    ],
    finalExpected: "Front-desk tasks are usable on a tablet without desktop-only assumptions.", screenshots: ["receptionist-walkin-tablet"],
    sourceEvidence: ["src/components/admin/walk-in-booking-form.tsx", "src/components/layout"]
  }),

  uatCase({
    id: "BA-HP-001", persona: "booking-admin", category: "Operations", scenario: "Happy path", priority: "High",
    purpose: "Use the Booking Admin menu and operational queues.", feature: "Booking Admin workspace",
    preconditions: ["Booking Admin has seeded permissions only"], account: "Booking Admin",
    steps: [
      { action: "Sign in and inspect navigation.", expected: "Overview, Calendar, Walk-ins, Payments, Customers, and Reports are available." },
      { action: "Open each permitted route.", expected: "Full customer and payment details needed for booking administration are visible." },
      { action: "Check Overview revenue and Payments queue.", expected: "Financial data is visible because payments.view/reports.view are assigned." }
    ],
    finalExpected: "Booking Admin has complete booking/payment operations without configuration/security administration.", screenshots: ["booking-admin-navigation"],
    sourceEvidence: ["src/lib/auth/permissions.ts", "src/lib/auth/admin-navigation.ts"]
  }),
  uatCase({
    id: "BA-HP-002", persona: "booking-admin", category: "Payments", scenario: "Happy path", priority: "Critical",
    purpose: "Process ordinary and reschedule adjustment payment queues.", feature: "Payment review",
    preconditions: ["Submitted ordinary proof and submitted reschedule proof"], account: "Booking Admin",
    steps: [
      { action: "Open Payments, change rows per page, and review an ordinary submitted payment.", expected: "Queue pagination works and the proof opens through an authorized URL." },
      { action: "Confirm one proof with a note.", expected: "Green success banner appears; booking becomes Confirmed." },
      { action: "Open Reschedule adjustment payments and verify an additional proof.", expected: "Only the additional amount is shown; verification completes the replacement." },
      { action: "Reject a separate additional proof with a reason.", expected: "Original booking remains confirmed and replacement releases." }
    ],
    finalExpected: "Payment decisions drive correct booking/reschedule states and visible customer comments.", screenshots: ["booking-admin-payment-queue", "booking-admin-reschedule-payment"],
    sourceEvidence: ["src/app/admin/payments/page.tsx", "src/features/rescheduling/actions.ts"]
  }),
  uatCase({
    id: "BA-HP-003", persona: "booking-admin", category: "Customers", scenario: "Happy path", priority: "High",
    purpose: "Search customers and review paginated booking/payment history.", feature: "Customer administration",
    preconditions: ["Multiple UAT customers with multiple bookings"], account: "Booking Admin",
    steps: [
      { action: "Open Customers and search by name, email, and mobile number.", expected: "Matching customers appear with aligned pagination controls." },
      { action: "Select a customer.", expected: "Contact details and booking transactions appear in the adjacent detail pane." },
      { action: "Review payment information and authorized proof links, then page bookings.", expected: "Details match Payment review and no records repeat across pages." }
    ],
    finalExpected: "Booking Admin can investigate one customer's complete operational history efficiently.", screenshots: ["booking-admin-customers"],
    sourceEvidence: ["src/app/admin/customers/page.tsx", "src/server/admin/queries.ts"]
  }),
  uatCase({
    id: "BA-HP-004", persona: "booking-admin", category: "Rescheduling", scenario: "Happy path", priority: "Critical",
    purpose: "Initiate normal rescheduling and resolve lower-price outcomes.", feature: "Booking Admin rescheduling",
    preconditions: ["Eligible same-, lower-, and higher-price UAT bookings"], account: "Booking Admin",
    steps: [
      { action: "Complete a same-price reschedule.", expected: "It finalizes atomically with an immutable history row." },
      { action: "Complete a lower-price reschedule and record a valid manual resolution.", expected: "Booking stays confirmed and resolution details are preserved." },
      { action: "Initiate a higher-price reschedule without a waiver.", expected: "Additional-payment hold is created and original booking remains valid." },
      { action: "Look for adjustment-waiver controls.", expected: "They are absent because Booking Admin lacks bookings.reschedule.override_adjustment." }
    ],
    finalExpected: "Booking Admin handles ordinary rescheduling and resolution but cannot waive amounts.", screenshots: ["booking-admin-reschedule"],
    sourceEvidence: ["src/lib/auth/permissions.ts", "src/app/admin/bookings/[id]/page.tsx"]
  }),
  uatCase({
    id: "BA-NEG-001", persona: "booking-admin", category: "Booking integrity", scenario: "Negative", priority: "Critical",
    purpose: "Reject stale replacement slots and preserve the original booking.", feature: "Reschedule conflict handling",
    preconditions: ["Two eligible original bookings and one replacement slot"], account: "Two Booking Admin sessions",
    steps: [
      { action: "Both admins preview the same replacement slot for different bookings.", expected: "Both may see a stale preview before commitment." },
      { action: "Confirm both nearly simultaneously.", expected: "Only one replacement succeeds/holds; the other receives conflict." },
      { action: "Inspect both original bookings and Calendar.", expected: "The failed booking is unchanged; no partial move or duplicate utilization exists." }
    ],
    finalExpected: "Database protection prevents replacement overselling under concurrent administration.", screenshots: ["booking-admin-reschedule-conflict"],
    sourceEvidence: ["prisma/migrations/20260824110000_add_booking_rescheduling/migration.sql"]
  }),
  uatCase({
    id: "BA-PERM-001", persona: "booking-admin", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Deny facility, pricing, holiday, role, admin-user, and audit administration.", feature: "Booking Admin authorization",
    preconditions: ["Booking Admin signed in"], account: "Booking Admin",
    data: ["/admin/facilities", "/admin/pricing", "/admin/holidays", "/admin/roles", "/admin/admin-users", "/admin/audit-logs"],
    steps: [
      { action: "Confirm prohibited items are absent from navigation.", expected: "Only permitted menu items appear." },
      { action: "Enter every prohibited URL directly.", expected: "Each returns Forbidden/safe denial with no data." },
      { action: "Attempt a previously captured role/pricing form submission if available in a safe test client.", expected: "Server permission checks reject it." }
    ],
    finalExpected: "Booking Admin cannot mutate platform configuration or access security administration.", screenshots: ["booking-admin-forbidden"],
    sourceEvidence: ["src/lib/auth/authorization.ts", "src/features/pricing/actions.ts", "src/features/rbac/actions.ts"]
  }),
  uatCase({
    id: "BA-GAP-001", persona: "booking-admin", category: "Reports", scenario: "Exception", priority: "Medium",
    purpose: "Record the discrepancy between report-export permission and available UI.", feature: "Report export",
    preconditions: ["Booking Admin has reports.export"], account: "Booking Admin",
    steps: [
      { action: "Open Reports and inspect all controls.", expected: "The 30-day report is visible." },
      { action: "Look for CSV/PDF/Excel export and attempt a likely export route only if documented by the environment owner.", expected: "No export control/route is currently found." },
      { action: "Record whether export is required for release.", expected: "The scenario is marked Blocked or Fail pending business decision, not Pass." }
    ],
    finalExpected: "The missing UI capability is explicitly dispositioned by the product owner.", screenshots: ["booking-admin-reports-no-export"],
    sourceEvidence: ["src/lib/auth/permissions.ts", "src/app/admin/reports/page.tsx"], confidence: "gap"
  }),
  uatCase({
    id: "BA-RESP-001", persona: "booking-admin", category: "Responsive", scenario: "Edge", priority: "Medium",
    purpose: "Review high-volume queues and rescheduling on tablet/mobile.", feature: "Booking Admin responsive layout",
    preconditions: ["Payment/customer queues contain enough rows for pagination"], account: "Booking Admin",
    steps: [
      { action: "Open Payments and Customers at 390px and tablet widths.", expected: "Tables/cards remain usable and pagination dropdowns stay attached." },
      { action: "Open a payment proof and rescheduling form.", expected: "Receipt, status, notes, slots, and confirmation controls do not overlap or extend off-screen." },
      { action: "Use keyboard navigation on tablet.", expected: "Focus remains visible and destructive actions require confirmation." }
    ],
    finalExpected: "Booking administration remains usable without a wide desktop.", screenshots: ["booking-admin-mobile-queue"],
    sourceEvidence: ["src/app/admin/payments/page.tsx", "src/app/admin/bookings/[id]/page.tsx"]
  }),

  uatCase({
    id: "SOC-HP-001", persona: "social-media", category: "Facility content", scenario: "Happy path", priority: "High",
    purpose: "Edit only approved customer-facing facility wording.", feature: "Facility content editing",
    preconditions: ["Dedicated UAT facility", "Social Media role has seeded permissions only"], account: "Social Media Person",
    steps: [
      { action: "Sign in and inspect navigation.", expected: "Only Facilities is available in admin navigation." },
      { action: "Select the UAT facility and edit Name/Description using the visible content controls.", expected: "A green success message appears and public wording updates." },
      { action: "Inspect operational, pricing, hours, cancellation, enabled-state, and block controls.", expected: "They are absent or disabled for this persona." }
    ],
    finalExpected: "Social Media can update public copy without operational side effects.", screenshots: ["social-media-facility-content"],
    cleanup: "Restore approved UAT wording.", sourceEvidence: ["src/features/admin/facility-permissions.ts", "src/components/admin/facility-form.tsx"]
  }),
  uatCase({
    id: "SOC-HP-002", persona: "social-media", category: "Media", scenario: "Happy path", priority: "High",
    purpose: "Upload, reorder, remove, and choose facility photos.", feature: "Facility photo management",
    preconditions: ["Dedicated UAT facility", "Three valid synthetic images"], account: "Social Media Person",
    steps: [
      { action: "Upload multiple images, reorder previews, and remove one before save.", expected: "The ready-to-upload pane reflects the exact intended set/order." },
      { action: "Save Facility images.", expected: "A green message appears and the gallery refreshes immediately." },
      { action: "Open public Facilities and facility detail.", expected: "Main image and carousel order match the saved order." },
      { action: "Remove/reorder existing images and save.", expected: "Changes persist after switching facilities and refreshing." }
    ],
    finalExpected: "Photo operations are robust and do not expose stale images from another facility.", screenshots: ["social-media-image-manager"],
    cleanup: "Restore approved UAT image order.", sourceEvidence: ["src/components/admin/facility-image-manager.tsx", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "SOC-PERM-001", persona: "social-media", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Prevent crafted facility-content updates from changing operations or pricing.", feature: "Field-level authorization",
    preconditions: ["Record current UAT facility price, hours, enabled state, cancellation, and blocks"], account: "Social Media Person",
    steps: [
      { action: "Confirm price, operating hours, enabled state, cancellation, and blocked-schedule controls are not editable.", expected: "Only approved content and photo controls are exposed." },
      { action: "Submit a normal content/photo change.", expected: "Allowed fields save successfully." },
      { action: "If using an approved security-test client, add crafted operational/pricing fields to the request.", expected: "Server ignores/rejects unauthorized fields; recorded operational values remain unchanged." },
      { action: "Review Audit Log as Super Admin.", expected: "The allowed content/photo change is attributed to the Social Media user." }
    ],
    finalExpected: "Mass assignment cannot expand Social Media authority.", screenshots: ["social-media-limited-fields"],
    cleanup: "Restore content and verify operational baseline remains unchanged.", sourceEvidence: ["src/features/admin/facility-permissions.ts", "src/features/admin/facility-permissions.test.ts", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "SOC-PERM-002", persona: "social-media", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Deny customer, payment, report, booking, pricing, and security data by direct URL.", feature: "Social Media route authorization",
    preconditions: ["Social Media user signed in"], account: "Social Media Person",
    data: ["/admin", "/admin/calendar", "/admin/walk-ins", "/admin/payments", "/admin/customers", "/admin/reports", "/admin/pricing", "/admin/holidays", "/admin/roles", "/admin/admin-users", "/admin/audit-logs"],
    steps: [
      { action: "Enter each prohibited URL directly.", expected: "Every page returns Forbidden/safe denial; no customer, proof, revenue, booking, or role data appears." },
      { action: "Open a known payment-proof URL from another authorized session after signing out there.", expected: "Private proof access is not transferable as a permanent public link; record any leakage as Critical." },
      { action: "Use Back/Forward and refresh.", expected: "Prohibited content does not flash from cache." }
    ],
    finalExpected: "Social Media access is isolated to approved facility content/media.", screenshots: ["social-media-forbidden"],
    sourceEvidence: ["src/lib/auth/authorization.ts", "src/lib/storage/payment-proofs.ts"]
  }),
  uatCase({
    id: "SOC-RESP-001", persona: "social-media", category: "Responsive", scenario: "Edge", priority: "Medium",
    purpose: "Manage facility wording and images on mobile/tablet.", feature: "Social Media responsive layout",
    preconditions: ["390px mobile and tablet viewport", "Synthetic UAT images"], account: "Social Media Person",
    steps: [
      { action: "Open Facilities and switch between facilities near the bottom of the list.", expected: "The selected facility stays visible/highlighted and details do not retain the previous facility's values/images." },
      { action: "Edit long but valid copy and manage image previews.", expected: "Fields, reorder/remove controls, and Save buttons fit the viewport." },
      { action: "Save and inspect public mobile view.", expected: "Copy wraps, carousel stays within viewport, and no horizontal page scroll appears." }
    ],
    finalExpected: "Approved content operations remain usable and accurate on narrow screens.", screenshots: ["social-media-mobile-facility"],
    sourceEvidence: ["src/app/admin/facilities/page.tsx", "src/components/admin/facility-image-manager.tsx"]
  })
]);
