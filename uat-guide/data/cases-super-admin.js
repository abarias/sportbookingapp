addUatCases([
  uatCase({
    id: "SA-HP-001", persona: "super-admin", category: "Dashboard", scenario: "Happy path", priority: "High",
    purpose: "Review complete operational visibility and global booking policy.", feature: "Admin overview",
    preconditions: ["UAT data includes confirmed, held, expired, and cancelled bookings"], account: "Super Admin",
    steps: [
      { action: "Sign in and open Overview.", expected: "Confirmed bookings, pending payment, paid revenue, enabled facilities, and recent bookings are visible." },
      { action: "Compare several recent records with Calendar and Payments.", expected: "Customer, facility, status, and financial visibility are consistent." },
      { action: "Change Cancellation enabled and Cancellation window hours, then save.", expected: "A success response is shown and the values persist after refresh." }
    ],
    finalExpected: "The Super Admin has complete dashboard visibility and global policy changes persist.", screenshots: ["super-admin-overview"],
    cleanup: "Restore the original cancellation settings and record both values.", sourceEvidence: ["src/app/admin/page.tsx", "src/server/admin/queries.ts"]
  }),
  uatCase({
    id: "SA-HP-002", persona: "super-admin", category: "Calendar", scenario: "Happy path", priority: "High",
    purpose: "Use monthly, daily schedule, and facility drill-down views.", feature: "Admin calendar",
    preconditions: ["Selected month has bookings and an all-day block"], account: "Super Admin",
    steps: [
      { action: "Open Calendar and move between months.", expected: "Each day summarizes booked facilities and identifies fully booked/blocked days where applicable." },
      { action: "Select a day in the bottom calendar row.", expected: "The page anchors to that day's detail instead of returning to the top." },
      { action: "Switch between Schedule view and Facility view.", expected: "Booked, available, and blocked hourly slots use the same visual language as other booking screens, with text labels." },
      { action: "Select a facility low in the list.", expected: "Its detailed schedule opens without losing scroll position." }
    ],
    finalExpected: "Month-to-hour drill-down remains readable and anchored.", screenshots: ["admin-calendar-month", "admin-calendar-day-detail"],
    sourceEvidence: ["src/app/admin/calendar/page.tsx", "src/components/admin/admin-calendar-view.tsx"]
  }),
  uatCase({
    id: "SA-HP-003", persona: "super-admin", category: "Facilities", scenario: "Happy path", priority: "High",
    purpose: "Edit facility content, fallback rate, operating hours, policy, and enabled state.", feature: "Facility management",
    preconditions: ["Use a dedicated UAT facility or record original values"], account: "Super Admin",
    steps: [
      { action: "Open Facilities and select a facility from the list.", expected: "The selected row is highlighted and its own details/images/hours are loaded." },
      { action: "Change General information and pricing, then use the nearby Save Changes.", expected: "A green message appears near that button and the saved values remain without reselecting." },
      { action: "Change one day's hourly opening/closing values and save that section.", expected: "Open time is earlier than close time; the new values remain after refresh." },
      { action: "Change a cancellation override and save.", expected: "The override persists and is reflected in customer eligibility." }
    ],
    finalExpected: "Each facility section saves independently with visible, persistent feedback.", screenshots: ["admin-facility-detail", "admin-facility-save-message"],
    cleanup: "Restore original facility values.", sourceEvidence: ["src/app/admin/facilities/page.tsx", "src/components/admin/facility-form.tsx", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "SA-VAL-001", persona: "super-admin", category: "Facilities", scenario: "Negative", priority: "High",
    purpose: "Create a valid facility and preserve entered data after validation errors.", feature: "Add facility",
    preconditions: ["Prepare one or more UAT TEST ONLY images"], account: "Super Admin",
    data: ["Name: UAT-Facility-<run>", "Unique lowercase-hyphen slug", "Type: Other", "Description 10-1000 characters", "Positive hourly rate"],
    steps: [
      { action: "Open Add a facility and confirm default operating hours.", expected: "Open defaults to 6:00 AM and close to 12:00 AM midnight." },
      { action: "Enter invalid slug, short description, zero price, or close time not after open time, then Create Facility.", expected: "Clear validation messages appear; all valid text and selected images remain." },
      { action: "Correct fields, upload multiple images, reorder/remove one, then create.", expected: "The new facility is created once and becomes the selected detail view." },
      { action: "Refresh and find it in Facilities and public Facilities when enabled.", expected: "Type Other and all persisted values/images are correct." }
    ],
    finalExpected: "Facility creation is validated, non-destructive on error, and selects the new record.", screenshots: ["admin-add-facility", "admin-add-facility-validation"],
    cleanup: "Disable the UAT facility after dependent tests; deletion is not implemented.", sourceEvidence: ["src/components/admin/facility-create-form.tsx", "src/features/admin/schemas.ts", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "SA-HP-004", persona: "super-admin", category: "Media", scenario: "Happy path", priority: "High",
    purpose: "Manage multiple facility images and select the main public image.", feature: "Facility image management",
    preconditions: ["Dedicated UAT facility", "Three synthetic JPG/PNG/WEBP/GIF images under 5 MB"], account: "Super Admin",
    steps: [
      { action: "Select three images at once.", expected: "New images ready to upload shows previews." },
      { action: "Remove one and reorder the remaining images before saving.", expected: "Preview order changes and removed image is excluded." },
      { action: "Save Changes in Facility images.", expected: "A green message appears and the persisted gallery updates immediately." },
      { action: "Make a different image first/main, then inspect public Facilities and facility detail.", expected: "The first image is the card image and all images appear in the carousel." }
    ],
    finalExpected: "Image ordering is persistent and drives the main image without stale images from another facility.", screenshots: ["admin-image-manager", "public-main-image"],
    cleanup: "Restore approved UAT images or disable the facility.", sourceEvidence: ["src/components/admin/facility-image-manager.tsx", "src/lib/storage/facility-images.ts"]
  }),
  uatCase({
    id: "SA-NEG-001", persona: "super-admin", category: "Media", scenario: "Negative", priority: "High",
    purpose: "Reject unsafe or excessive facility image selections.", feature: "Facility image validation",
    preconditions: ["Synthetic image over 5 MB, unsupported file, and more than the UI batch limit"], account: "Super Admin",
    steps: [
      { action: "Select an image larger than 5 MB.", expected: "The file is rejected with a supported image under 5MB message." },
      { action: "Select a PDF/text file renamed with an image extension.", expected: "The picker or server rejects the unsupported MIME type." },
      { action: "Select more than the allowed number of new images.", expected: "A clear maximum-count message appears and nothing is silently dropped." },
      { action: "Refresh after each failure.", expected: "No broken or partial image record appears." }
    ],
    finalExpected: "Invalid uploads do not alter the facility gallery.", screenshots: ["admin-image-validation"],
    sourceEvidence: ["src/components/admin/facility-image-manager.tsx", "src/features/admin/actions.ts"]
  }),
  uatCase({
    id: "SA-HP-005", persona: "super-admin", category: "Availability", scenario: "Happy path", priority: "Critical",
    purpose: "Create hourly and all-day facility blocks across date ranges.", feature: "Blocked schedules",
    preconditions: ["Dedicated facility and dates without active bookings"], account: "Super Admin",
    steps: [
      { action: "Add a one-hour block with title, reason, start/end dates, and hourly times.", expected: "The block appears with exact start/end dates and times." },
      { action: "Add an All day block spanning two dates.", expected: "Time fields hide/disable and the existing-block list shows the complete two-day range." },
      { action: "Inspect both dates in customer availability.", expected: "Every affected hour on both dates appears Booked." },
      { action: "Try creating a block that overlaps an active booking, then remove an eligible UAT block.", expected: "The conflict is rejected; deleting a valid block releases only its own slots." }
    ],
    finalExpected: "Block boundaries are exact and database conflict rules preserve active bookings.", screenshots: ["admin-block-all-day", "customer-blocked-dates"],
    cleanup: "Delete UAT blocks after evidence capture.", sourceEvidence: ["src/components/admin/block-schedule-form.tsx", "src/features/admin/schemas.ts", "prisma/migrations/20260815134500_add_booking_overlap_guards/migration.sql"]
  }),
  uatCase({
    id: "SA-HP-006", persona: "super-admin", category: "Pricing", scenario: "Happy path", priority: "Critical",
    purpose: "Create and preview dynamic pricing rules derived into the public rate card.", feature: "Dynamic pricing",
    preconditions: ["Dedicated UAT facility with a positive fallback rate"], account: "Super Admin",
    steps: [
      { action: "Open Pricing, select the facility, and compare the listed fallback rate with Facilities.", expected: "The same fallback rate and facility sort order are used." },
      { action: "Add a Weekday hourly override and save.", expected: "A green message appears; the new override is listed and can be selected for editing." },
      { action: "Add Weekend and Holiday rates.", expected: "These are all-day rules with no time controls." },
      { action: "Add Selected days and choose specific weekdays.", expected: "Day checkboxes appear only for Selected days." },
      { action: "Review Public rate-card preview and the public facility page.", expected: "Both show matching VAT-exclusive rows without internal IDs or priority." }
    ],
    finalExpected: "One authoritative rule set drives both booking totals and public/admin rate cards.", screenshots: ["admin-pricing-workspace", "admin-rate-card-preview"],
    cleanup: "Deactivate or delete UAT overrides and confirm fallback coverage remains.", sourceEvidence: ["src/app/admin/pricing/page.tsx", "src/components/admin/pricing-rule-editor.tsx", "src/server/pricing/engine.ts"]
  }),
  uatCase({
    id: "SA-EDGE-001", persona: "super-admin", category: "Pricing", scenario: "Edge", priority: "Critical",
    purpose: "Validate precedence, midnight, effective dates, conflicts, and gaps.", feature: "Pricing rule diagnostics",
    preconditions: ["UAT facility with fallback rate", "A future configured holiday"], account: "Super Admin",
    steps: [
      { action: "Set an hourly rule ending at 12:00 AM midnight and save.", expected: "The list, edit form, preview, and public rate card all display 12:00 AM, not 12:00 PM." },
      { action: "Create a selected-day rule over a weekday rule and a holiday rule over both.", expected: "Preview follows Holiday > Selected days > Weekend > Weekday > fallback." },
      { action: "Set effective-from/until around the preview date.", expected: "The rule applies inclusively only inside that range." },
      { action: "Attempt duplicate/equal-priority overlapping rules.", expected: "Configuration checks identify ambiguity/duplicates before an incorrect price can be booked." },
      { action: "Create a higher-priority overlap and inspect diagnostics.", expected: "The hidden/shadowed rule is warned about." }
    ],
    finalExpected: "Pricing diagnostics explain ambiguity and preview remains deterministic.", screenshots: ["admin-pricing-diagnostics", "admin-pricing-midnight"],
    sourceEvidence: ["src/features/pricing/schemas.ts", "src/server/pricing/engine.ts"]
  }),
  uatCase({
    id: "SA-HP-007", persona: "super-admin", category: "Pricing", scenario: "Happy path", priority: "High",
    purpose: "Manage global and facility-specific holidays.", feature: "Holiday calendar",
    preconditions: ["A future date without another UAT holiday"], account: "Super Admin",
    steps: [
      { action: "Open Holidays and add UAT-Holiday as a global active holiday.", expected: "It appears in Configured holidays and holiday pricing applies to every facility with a holiday rule." },
      { action: "Edit it to apply to one facility only.", expected: "Only that facility receives the holiday override." },
      { action: "Deactivate it.", expected: "It remains visible for history but no longer affects pricing." }
    ],
    finalExpected: "Holiday activation and scope consistently affect admin preview and customer prices.", screenshots: ["admin-holiday-calendar"],
    cleanup: "Leave the UAT holiday inactive or restore the original calendar.", sourceEvidence: ["src/app/admin/holidays/page.tsx", "src/features/pricing/actions.ts"]
  }),
  uatCase({
    id: "SA-HP-008", persona: "super-admin", category: "Access control", scenario: "Happy path", priority: "Critical",
    purpose: "Create, edit, clone, activate, and safely delete a custom role.", feature: "Role management",
    preconditions: ["At least one unassigned UAT custom role name is available"], account: "Super Admin",
    data: ["Role: UAT-Court Observer", "Description at least 10 characters"],
    steps: [
      { action: "Open Roles, choose Create a custom role, and assign availability.view.", expected: "The role saves with a green message and dependency review is understandable." },
      { action: "Add bookings.create.", expected: "Required permissions availability.view and bookings.view are automatically included." },
      { action: "Clone the role.", expected: "A separate custom role is created with the same permissions." },
      { action: "Deactivate the clone, then try assigning it to a user.", expected: "Inactive roles cannot be assigned." },
      { action: "Delete the unused clone, then try deleting the assigned original.", expected: "Unused custom role deletes after confirmation; assigned role deletion is safely blocked." }
    ],
    finalExpected: "Custom roles are configurable without bypassing dependencies or assignment safety.", screenshots: ["admin-role-editor", "admin-role-save-message"],
    cleanup: "Remove UAT role assignments and delete unused UAT custom roles.", sourceEvidence: ["src/components/admin/role-editor.tsx", "src/features/rbac/actions.ts"]
  }),
  uatCase({
    id: "SA-PERM-001", persona: "super-admin", category: "Access control", scenario: "Negative", priority: "Critical",
    purpose: "Protect the recovery role and last active Super Admin.", feature: "Super Admin safeguards",
    preconditions: ["Use a secondary Super Admin; never test lockout with the only recovery account unless approved"], account: "Super Admin",
    steps: [
      { action: "Select the protected Super Admin role.", expected: "Essential properties/permissions cannot be removed and delete is unavailable or rejected." },
      { action: "Attempt to deactivate or strip roles from the last active Super Admin in an isolated test arrangement.", expected: "The operation is rejected with a safe message." },
      { action: "Attempt to grant a permission the acting test admin does not hold using a constrained custom admin if available.", expected: "Privilege escalation is rejected server-side." },
      { action: "Review Audit Log.", expected: "Blocked protection/escalation attempts are recorded without secrets." }
    ],
    finalExpected: "No UI or crafted request can remove the protected recovery path.", screenshots: ["admin-protected-super-role", "admin-lockout-prevented"],
    cleanup: "Confirm at least one approved active Super Admin remains.", sourceEvidence: ["src/features/rbac/actions.ts", "prisma/migrations/20260824090000_add_configurable_rbac/migration.sql"]
  }),
  uatCase({
    id: "SA-HP-009", persona: "super-admin", category: "Admin users", scenario: "Happy path", priority: "Critical",
    purpose: "Assign multiple roles and observe effective access immediately.", feature: "Administrative users",
    preconditions: ["A dedicated UAT user exists", "Receptionist and Social Media roles are active"], account: "Super Admin",
    steps: [
      { action: "Open Admin Users, search the UAT user, and select it.", expected: "Assigned roles, effective permissions, and contribution sources are shown." },
      { action: "Assign Receptionist and Social Media Person and save.", expected: "A green message appears; both roles stay ticked after refresh and the permission union is updated." },
      { action: "Sign in as that user in another browser and inspect navigation.", expected: "Calendar, Walk-ins, and Facilities are visible; restricted pages remain absent." },
      { action: "Deactivate admin access.", expected: "The impacted user's next navigation is denied and, after session status refresh, signed-in admin identity/menu disappear." },
      { action: "Reactivate with one role and test again.", expected: "Only that active role's permissions return." }
    ],
    finalExpected: "Role changes take effect on the next protected request without stale permission caching.", screenshots: ["admin-user-role-assignment", "admin-effective-permissions"],
    cleanup: "Return the UAT user to its baseline role/access state.", sourceEvidence: ["src/app/admin/admin-users/page.tsx", "src/features/rbac/actions.ts", "src/lib/auth/authorization.ts"]
  }),
  uatCase({
    id: "SA-HP-010", persona: "super-admin", category: "Audit", scenario: "Happy path", priority: "High",
    purpose: "Search and page through readable security/administrative history.", feature: "Audit logs and assignment history",
    preconditions: ["Prior UAT role, facility, pricing, payment, and reschedule actions exist"], account: "Super Admin",
    steps: [
      { action: "Open Audit Log and search by actor name, email, action wording, and target name.", expected: "Relevant rows appear using readable names rather than only internal IDs." },
      { action: "Change rows per page and page forward/back.", expected: "Controls stay aligned on narrow/mobile widths and results do not repeat." },
      { action: "Open Admin Users and inspect Assignment history pagination.", expected: "Newest role/access changes appear first with readable role names." },
      { action: "Compare before/after details for a UAT change.", expected: "Useful values are shown without passwords, verification codes, or storage tokens." }
    ],
    finalExpected: "Administrative activity is searchable, paginated, readable, and free of secrets.", screenshots: ["admin-audit-log", "admin-assignment-history"],
    sourceEvidence: ["src/app/admin/audit-logs/page.tsx", "src/server/rbac/queries.ts", "prisma/migrations/20260824100000_make_rbac_audit_append_only/migration.sql"]
  }),
  uatCase({
    id: "SA-HP-011", persona: "super-admin", category: "Reports", scenario: "Happy path", priority: "High",
    purpose: "Validate 30-day booking, revenue, utilization, and reschedule reporting.", feature: "Reports",
    preconditions: ["Known UAT confirmed/expired/cancelled bookings, verified payments, reschedules, and waiver"], account: "Super Admin",
    steps: [
      { action: "Open Reports and record the 30-day summary.", expected: "Bookings, Confirmed, Paid Base Revenue, reschedules, unresolved adjustments, and waivers are shown." },
      { action: "Reconcile known original and additional verified payments.", expected: "Verified additional payments are counted once; original payments are not duplicated after rescheduling." },
      { action: "Inspect utilization after a completed move and an expired replacement hold.", expected: "Only the current active booking consumes utilization; expired holds do not." },
      { action: "Look for an Export control.", expected: "No export UI is currently implemented; record this as a known gap even though reports.export exists." }
    ],
    finalExpected: "Displayed summaries reconcile to prepared UAT records without double counting.", screenshots: ["admin-reports"],
    sourceEvidence: ["src/app/admin/reports/page.tsx", "src/server/admin/queries.ts", "src/lib/auth/permissions.ts"], confidence: "business"
  }),
  uatCase({
    id: "SA-HP-012", persona: "super-admin", category: "Payments", scenario: "Happy path", priority: "Critical",
    purpose: "Verify, reject, and request new proof from the payment queue.", feature: "Payment verification",
    preconditions: ["Three submitted UAT payments", "One duplicate external reference flag"], account: "Super Admin",
    steps: [
      { action: "Open Payments and inspect summary, columns, duplicate flag, row count, and pagination.", expected: "Only Submitted and Action Required ordinary payments appear; rejected payments are absent." },
      { action: "Open one row, inspect receipt/reference/amount/customer, add an optional note, and Confirm payment.", expected: "A green outcome banner appears; payment becomes Verified and booking Confirmed." },
      { action: "Open a second row, enter instructions, and Request new proof.", expected: "Action Required is saved and the customer can see the instructions." },
      { action: "Open a third row, enter a required reason, and Reject.", expected: "The payment is rejected, booking expires/releases its slot, and it leaves the active queue." }
    ],
    finalExpected: "Every review outcome is explicit, audited, visible to the customer where appropriate, and inventory-safe.", screenshots: ["admin-payment-queue", "admin-payment-review", "admin-payment-success"],
    sourceEvidence: ["src/app/admin/payments/page.tsx", "src/app/admin/payments/[id]/page.tsx", "src/server/payments/service.ts"]
  }),
  uatCase({
    id: "SA-HP-013", persona: "super-admin", category: "Rescheduling", scenario: "Happy path", priority: "Critical",
    purpose: "Complete a same-price administrative reschedule atomically.", feature: "Administrative rescheduling",
    preconditions: ["Future confirmed/verified UAT booking outside the cutoff", "Equal-price replacement slot"], account: "Super Admin",
    steps: [
      { action: "Open the booking detail and select Reschedule replacement facility/date.", expected: "Changing the date refreshes hourly slots; current booking is visually identified; booked slots cannot be selected." },
      { action: "Select a valid starting hour.", expected: "The original duration is selected automatically and the page stays anchored to the chosen slots." },
      { action: "Review before/after cards, enter required reason and notes, select Confirm reschedule, and accept confirmation.", expected: "A green success banner appears and the active schedule changes once." },
      { action: "Inspect history and both facilities.", expected: "Immutable original/replacement details are recorded, original slot is released, and replacement is booked." }
    ],
    finalExpected: "Same-price movement is atomic and preserves payment/reference/history.", screenshots: ["admin-reschedule-slots", "admin-reschedule-review", "admin-reschedule-success"],
    sourceEvidence: ["src/app/admin/bookings/[id]/page.tsx", "src/server/bookings/rescheduling.ts"]
  }),
  uatCase({
    id: "SA-EDGE-002", persona: "super-admin", category: "Rescheduling", scenario: "Edge", priority: "Critical",
    purpose: "Complete a lower-price move and resolve its manual adjustment.", feature: "Lower-price reschedule",
    preconditions: ["Eligible confirmed booking", "Lower-price replacement slot"], account: "Super Admin",
    steps: [
      { action: "Initiate and confirm the lower-price replacement with a reason.", expected: "The booking moves immediately and remains confirmed; an Unresolved adjustment is prominent." },
      { action: "Select a resolution: Manual refund, Customer credit, No refund, or Other; enter required amount/note/reference as applicable.", expected: "Invalid amount or missing note is rejected." },
      { action: "Save a valid resolution.", expected: "Resolver, timestamp, method, amount, note, and reference appear in history." },
      { action: "Inspect Reports.", expected: "The original paid amount is not rewritten and unresolved/refund/credit handling is not counted as new revenue." }
    ],
    finalExpected: "Lower-price moves preserve original payment and require an auditable manual outcome.", screenshots: ["admin-lower-price-adjustment"],
    sourceEvidence: ["src/server/bookings/rescheduling-policy.ts", "src/components/admin/reschedule-adjustment-form.tsx"]
  }),
  uatCase({
    id: "SA-EDGE-003", persona: "super-admin", category: "Rescheduling", scenario: "Edge", priority: "Critical",
    purpose: "Exercise higher-price hold, customer proof, verification, rejection, and expiry.", feature: "Higher-price reschedule",
    preconditions: ["Eligible confirmed booking", "Higher-price replacement slot", "Customer and payment-verifier testers"], account: "Super Admin plus booking owner",
    steps: [
      { action: "Initiate the higher-price move without a waiver.", expected: "Only the replacement is provisionally held; the original booking remains confirmed and unchanged." },
      { action: "As customer, submit proof for only the additional amount.", expected: "The additional payment becomes Submitted; original payment remains separate." },
      { action: "Verify the additional proof as an authorized admin.", expected: "The replacement finalizes, original slot releases, and one final notification is queued/sent." },
      { action: "Repeat with separate UAT records for rejection and hold expiry.", expected: "Replacement hold releases, original booking remains valid, and history shows Rejected or Expired." }
    ],
    finalExpected: "Additional-payment failure never damages the original confirmed booking.", screenshots: ["customer-reschedule-additional-payment", "admin-reschedule-payment-review"],
    sourceEvidence: ["src/app/bookings/[id]/reschedule-payment/page.tsx", "src/app/admin/reschedule-payments/[id]/page.tsx", "src/server/bookings/rescheduling.ts"]
  }),
  uatCase({
    id: "SA-PERM-002", persona: "super-admin", category: "Rescheduling", scenario: "Negative", priority: "Critical",
    purpose: "Use the separate waiver permission without recording a waiver as payment.", feature: "Reschedule adjustment override",
    preconditions: ["Higher-price replacement", "Super Admin and Booking Admin comparison accounts"], account: "Super Admin",
    steps: [
      { action: "Enter a partial waiver with no customer-facing note.", expected: "Submission is rejected and no reschedule is created." },
      { action: "Enter a valid partial/full waiver, reason, and customer note; confirm.", expected: "The waived portion is recorded as an adjustment, not a payment; only any remainder is due." },
      { action: "Attempt the same as Booking Admin.", expected: "Override controls are absent and a crafted request is rejected." },
      { action: "Inspect Audit Log and Reports.", expected: "Actor, reason, amount, and before/after are traceable; waiver is excluded from revenue." }
    ],
    finalExpected: "Waivers are separately authorized, documented, and never inflate revenue.", screenshots: ["admin-reschedule-waiver"],
    sourceEvidence: ["src/lib/auth/permissions.ts", "src/server/bookings/rescheduling-policy.ts"]
  }),
  uatCase({
    id: "SA-NEG-002", persona: "super-admin", category: "Rescheduling", scenario: "Negative", priority: "High",
    purpose: "Reject ineligible, stale, duplicate, and conflicting reschedules.", feature: "Reschedule safeguards",
    preconditions: ["Past/completed booking, near-cutoff booking, active reschedule, and competing replacement slot"], account: "Super Admin",
    steps: [
      { action: "Open a completed or past booking.", expected: "The Reschedule card remains but says Completed or past bookings cannot be rescheduled." },
      { action: "Attempt a booking within the configured cutoff or with an active request.", expected: "The server rejects it with an eligibility message." },
      { action: "Have two admins confirm the same replacement slot from stale pages.", expected: "Only one operation succeeds; the other reports conflict and leaves its original booking unchanged." },
      { action: "Refresh/back and retry the same confirmed request.", expected: "No duplicate history/hold/payment is created." }
    ],
    finalExpected: "Every failed attempt preserves original schedules and inventory.", screenshots: ["admin-reschedule-ineligible", "admin-reschedule-conflict"],
    sourceEvidence: ["src/server/bookings/rescheduling-policy.ts", "prisma/migrations/20260824110000_add_booking_rescheduling/migration.sql"]
  }),
  uatCase({
    id: "SA-RESP-001", persona: "super-admin", category: "Responsive", scenario: "Edge", priority: "High",
    purpose: "Use long Super Admin navigation and complex workspaces on mobile/tablet.", feature: "Admin responsive layout",
    preconditions: ["390 x 844 mobile and 768 x 1024 tablet viewports"], account: "Super Admin",
    steps: [
      { action: "Open the admin hamburger menu and scroll to the final item.", expected: "The menu itself scrolls; every option is reachable." },
      { action: "Select menu items and buttons inside the popup on mobile and desktop widths.", expected: "The popup closes after navigation and when clicking outside." },
      { action: "Open Pricing, Facilities, Admin Users, Audit Log, and Payment review.", expected: "Cards do not overlap or force horizontal page scrolling; dropdowns remain attached." },
      { action: "Rotate/re-size between tablet portrait and landscape.", expected: "Selected records and controls remain usable." }
    ],
    finalExpected: "Every Super Admin destination remains reachable and readable at supported widths.", screenshots: ["admin-mobile-menu", "admin-pricing-mobile", "admin-users-mobile"],
    sourceEvidence: ["src/components/layout", "src/app/admin/pricing/page.tsx"]
  })
]);
