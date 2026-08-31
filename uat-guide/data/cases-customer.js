addUatCases([
  uatCase({
    id: "CUST-HP-001", persona: "customer", category: "Authentication", scenario: "Happy path", priority: "Critical",
    purpose: "Create a customer account and verify the email address.", feature: "Registration and email verification",
    preconditions: ["Use a fresh UAT email inbox that can receive messages", "You are signed out"], account: "No account required",
    data: ["Full name: UAT-Customer Registration", "Valid Philippine-format UAT mobile number", "Unique UAT email", "A 10-72 character password with letters and numbers that does not contain the name or email"],
    steps: [
      { action: "Open Register and complete Full name, Email, Mobile number, Password, and Confirm password.", expected: "All fields retain their values and the password guidance remains visible." },
      { action: "Select Create customer account once.", expected: "The page changes to Email verification code and says a code was sent. No mobile/SMS code is promised." },
      { action: "Open the UAT inbox, copy the latest six-digit code, enter it, and select Verify email.", expected: "A success message appears and the account becomes eligible to sign in." },
      { action: "Open Sign in and use the new credentials.", expected: "Sign-in succeeds and the customer name/menu is shown." }
    ],
    finalExpected: "One verified customer account exists; no duplicate account is created.", screenshots: ["customer-registration-desktop", "customer-email-verification-mobile"],
    cleanup: "Keep the account for later customer tests and record its UAT alias in the test run notes.",
    sourceEvidence: ["src/features/auth/actions.ts", "src/components/auth/register-form.tsx", "src/auth.ts"]
  }),
  uatCase({
    id: "CUST-NEG-001", persona: "customer", category: "Validation", scenario: "Negative", priority: "High",
    purpose: "Confirm invalid registration data is rejected without clearing valid fields.", feature: "Registration validation",
    preconditions: ["You are signed out", "Use an email that is not needed for another test"], account: "No account required",
    data: ["One-character name", "Malformed email", "Non-Philippine mobile number", "1234567890", "Mismatched confirmation"],
    steps: [
      { action: "Enter valid name, email, and mobile values, then use 1234567890 as the password.", expected: "Client-side guidance says to choose a less common password and submission is prevented." },
      { action: "Use a valid strong password but a different Confirm password.", expected: "Passwords do not match is shown before submission." },
      { action: "Correct the password, then test the invalid name, email, and mobile values one at a time.", expected: "Each invalid field is identified; previously valid values remain populated." },
      { action: "Correct all fields and submit.", expected: "Registration proceeds to email verification." }
    ],
    finalExpected: "Invalid data never creates a usable account and corrections do not require retyping unrelated fields.", screenshots: ["customer-registration-validation-mobile"],
    cleanup: "Do not verify the throwaway account unless it will be reused.", sourceEvidence: ["src/features/auth/schemas.ts", "src/features/auth/password-policy.ts", "src/components/auth/register-form.tsx"]
  }),
  uatCase({
    id: "CUST-EDGE-001", persona: "customer", category: "Authentication", scenario: "Edge", priority: "High",
    purpose: "Exercise verification expiry, incorrect-code limits, and resend behavior.", feature: "Email verification controls",
    preconditions: ["An unverified UAT customer exists", "Coordinate timing with the UAT environment owner"], account: "Unverified customer email",
    data: ["Incorrect six-digit code", "A newly resent code"],
    steps: [
      { action: "Open Verify email, enter the account email, and request a new code.", expected: "A generic response is shown and a new message arrives for an unverified account." },
      { action: "Enter an incorrect six-digit code once.", expected: "Incorrect verification code is shown without exposing the correct code." },
      { action: "After the configured expiry or with an exhausted test token prepared by the coordinator, enter that old code.", expected: "The page says the code expired or has too many failed attempts and asks for a new code." },
      { action: "Request codes repeatedly up to the configured resend limit.", expected: "Further requests are rate-limited with a wait message; no account enumeration detail is disclosed." }
    ],
    finalExpected: "Only the newest valid, unexpired code verifies the account; abuse controls are visible.", screenshots: ["customer-verification-expired"],
    cleanup: "Use a fresh code to verify the account if it is needed later.", sourceEvidence: ["src/features/auth/actions.ts", "src/lib/config/auth.ts"],
    confidence: "confirmed"
  }),
  uatCase({
    id: "CUST-HP-002", persona: "customer", category: "Authentication", scenario: "Happy path", priority: "Critical",
    purpose: "Sign in, sign out, and return to a protected page safely.", feature: "Customer session",
    preconditions: ["A verified UAT customer exists"], account: "Verified Customer",
    steps: [
      { action: "Open Sign in, enter valid credentials, and submit.", expected: "The requested page or home page opens and the customer is shown as signed in." },
      { action: "Open My bookings.", expected: "Only this customer's bookings are displayed." },
      { action: "Use Sign out, then revisit /bookings.", expected: "The page asks the user to sign in and does not disclose booking records." },
      { action: "Sign in with an incorrect password.", expected: "A generic sign-in error appears and no account details are disclosed." }
    ],
    finalExpected: "Session access starts and ends predictably, and protected customer data remains private.", screenshots: ["customer-login-desktop", "customer-bookings-signed-out"],
    sourceEvidence: ["src/auth.ts", "src/components/auth/login-form.tsx", "src/app/bookings/page.tsx"]
  }),
  uatCase({
    id: "CUST-HP-003", persona: "customer", category: "Facilities", scenario: "Happy path", priority: "High",
    purpose: "Browse facilities and understand photos, details, rules, and rate cards.", feature: "Facility discovery",
    preconditions: ["At least two enabled facilities with multiple images and pricing rules exist"], account: "Customer or signed-out visitor",
    steps: [
      { action: "Open Facilities and compare at least two cards.", expected: "Each card shows the intended main image, facility name/type, and base-price wording." },
      { action: "Open a facility.", expected: "The booking controls appear before or beside condensed facility information, depending on screen size." },
      { action: "Browse the image carousel and expand facility information on mobile.", expected: "Every image loads, remains within the viewport, and has useful alternative text." },
      { action: "Review Base rate card.", expected: "Rows show applicable days/times, peso base rates, per-hour unit, VAT-exclusive disclaimer, and final-price note." }
    ],
    finalExpected: "A non-technical customer can compare facilities and understand that rates are VAT-exclusive base prices.", screenshots: ["facility-list-desktop", "facility-detail-mobile", "facility-rate-card-desktop"],
    sourceEvidence: ["src/app/facilities/page.tsx", "src/app/facilities/[slug]/page.tsx", "src/components/pricing/rate-card.tsx"]
  }),
  uatCase({
    id: "CUST-HP-004", persona: "customer", category: "Booking", scenario: "Happy path", priority: "Critical",
    purpose: "Select one or more consecutive hourly slots and see an authoritative quote.", feature: "Availability and slot selection",
    preconditions: ["Signed in customer", "A future day with at least three consecutive available hours"], account: "Verified Customer",
    data: ["One enabled facility", "A date inside the booking window"],
    steps: [
      { action: "Open a facility and change Booking date.", expected: "Hourly slots refresh automatically for the selected date without a Check availability action." },
      { action: "Select one available hour.", expected: "The hour is highlighted, a one-hour selection summary appears, and Reserve & Pay becomes available." },
      { action: "Select the immediately following hour.", expected: "Both hours remain selected and the VAT-exclusive base amount updates." },
      { action: "Select either selected hour again.", expected: "The selection clears or contracts consistently; no stuck slot remains." },
      { action: "Select a non-consecutive hour after a starting slot.", expected: "The interface does not create a disjoint booking; only a valid consecutive range is retained." }
    ],
    finalExpected: "Selection is reversible, consecutive, hourly, and priced before commitment.", screenshots: ["customer-slot-selection-desktop", "customer-slot-selection-mobile"],
    cleanup: "Do not select Reserve & Pay in this case.", sourceEvidence: ["src/components/bookings/booking-panel.tsx", "src/components/bookings/booking-date-selector.tsx"]
  }),
  uatCase({
    id: "CUST-EDGE-002", persona: "customer", category: "Pricing", scenario: "Edge", priority: "Critical",
    purpose: "Verify a booking crossing a pricing boundary is itemized correctly.", feature: "Dynamic pricing segmentation",
    preconditions: ["A facility has different adjacent rates, such as before and after 5:00 PM", "Both hours are available"], account: "Verified Customer",
    data: ["A two-hour selection crossing the configured boundary"],
    steps: [
      { action: "Select the hour before the pricing boundary and the hour after it.", expected: "The selected range spans two hours and remains valid." },
      { action: "Review the price summary.", expected: "Two rate segments are listed with the correct labels and amounts." },
      { action: "Add the segment amounts manually.", expected: "They equal the displayed VAT-exclusive base amount exactly." },
      { action: "Compare the same hours on a weekend or configured holiday.", expected: "The applicable weekend/holiday rule and label replace the ordinary weekday calculation." }
    ],
    finalExpected: "The browser quote follows rule precedence and minor-unit arithmetic without silently applying VAT.", screenshots: ["customer-segmented-price"],
    sourceEvidence: ["src/server/pricing/engine.ts", "src/components/bookings/booking-panel.tsx"]
  }),
  uatCase({
    id: "CUST-EDGE-003", persona: "customer", category: "Booking", scenario: "Edge", priority: "High",
    purpose: "Test earliest/latest allowed dates and prevention of past bookings.", feature: "Booking window",
    preconditions: ["Know today's Asia/Manila date", "For last-Monday behavior, execute on that date or use a controlled UAT clock"], account: "Verified Customer",
    steps: [
      { action: "Open the facility date picker.", expected: "Dates before today are unavailable." },
      { action: "Select today and inspect elapsed hours.", expected: "Past hours cannot be selected; future hours can be selected if available." },
      { action: "Before the last Monday, inspect the latest allowed date.", expected: "The maximum is the end of next month." },
      { action: "On/after the last Monday under a controlled test date, inspect the maximum.", expected: "The maximum extends to the end of the following month." },
      { action: "Attempt to alter the date in the URL beyond the maximum.", expected: "The server normalizes it back into the permitted window and does not create an out-of-window booking." }
    ],
    finalExpected: "Both browser and server enforce the Asia/Manila booking window.", screenshots: ["customer-booking-window"],
    sourceEvidence: ["src/server/bookings/booking-window.ts", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "CUST-EDGE-004", persona: "customer", category: "Availability", scenario: "Edge", priority: "Critical",
    purpose: "Confirm operating hours, bookings, blocks, and replacement holds affect availability.", feature: "Slot status",
    preconditions: ["Coordinator provides one booked hour, one admin-blocked hour, and one open hour on the same facility/day"], account: "Verified Customer",
    steps: [
      { action: "Open the prepared date.", expected: "Only operating-hour slots are shown." },
      { action: "Inspect the confirmed booking and admin block.", expected: "Both are labeled Booked to the customer and cannot be selected; internal block details are not disclosed." },
      { action: "Inspect an active unpaid hold or submitted proof booking.", expected: "It also appears unavailable." },
      { action: "Select the open hour.", expected: "Only the genuinely open hour can be selected." }
    ],
    finalExpected: "Customer availability never exposes block reasons and never offers intentionally occupied inventory.", screenshots: ["customer-mixed-slot-statuses"],
    sourceEvidence: ["src/server/bookings/service.ts", "src/components/bookings/booking-panel.tsx"]
  }),
  uatCase({
    id: "CUST-HP-005", persona: "customer", category: "Booking", scenario: "Happy path", priority: "Critical",
    purpose: "Create a temporary reservation only after explicit commitment.", feature: "Reserve & Pay hold",
    preconditions: ["Signed in customer", "One future available hour"], account: "Verified Customer",
    steps: [
      { action: "Select an available slot but do not select Reserve & Pay; have a second tester refresh the same date.", expected: "The second tester still sees the slot available because selection alone creates no hold." },
      { action: "Select Reserve & Pay and accept the confirmation prompt.", expected: "The server rechecks availability and opens Complete your reservation payment." },
      { action: "Review facility, schedule, reference, amount due, VAT-exclusive wording, and countdown.", expected: "All details match the selected booking and the hold deadline is approximately 15 minutes from creation." },
      { action: "Have the second tester refresh availability.", expected: "The held slot is now Booked/unavailable." }
    ],
    finalExpected: "A single HELD/AWAITING_PAYMENT booking blocks the slot only after Reserve & Pay.", screenshots: ["customer-reserve-confirmation", "customer-payment-instructions"],
    cleanup: "Use this held booking in proof or expiry tests; do not create another hold for the same slot.", sourceEvidence: ["src/features/bookings/actions.ts", "src/server/bookings/service.ts", "src/app/bookings/[id]/payment/page.tsx"]
  }),
  uatCase({
    id: "CUST-HP-006", persona: "customer", category: "Payment", scenario: "Happy path", priority: "Critical",
    purpose: "Submit manual payment proof without automatically confirming the booking.", feature: "Proof of payment",
    preconditions: ["An active held booking has at least five minutes remaining", "A synthetic UAT receipt image under 5 MB"], account: "Booking owner",
    data: ["Payment method: GCash or Bank transfer", "Unique UAT transfer reference", "UAT TEST ONLY receipt image"],
    steps: [
      { action: "Open View payment instructions from My bookings.", expected: "The correct held booking and amount are shown." },
      { action: "Choose Payment method, enter the transfer reference, attach the synthetic image, and select Submit proof for verification.", expected: "A green success banner confirms submission." },
      { action: "Review the page after submission.", expected: "Status is Payment Submitted - For Verification; the receipt image and upload time are visible; the countdown is gone." },
      { action: "Open My bookings.", expected: "The booking remains reserved/held for review and is not labeled Booking Confirmed." }
    ],
    finalExpected: "Payment is SUBMITTED, booking remains HELD, and the proof is viewable only by the owner and authorized admins.", screenshots: ["customer-proof-form", "customer-proof-submitted"],
    sourceEvidence: ["src/features/bookings/actions.ts", "src/server/payments/service.ts", "src/app/bookings/[id]/payment/page.tsx"]
  }),
  uatCase({
    id: "CUST-NEG-002", persona: "customer", category: "Payment", scenario: "Negative", priority: "High",
    purpose: "Reject missing, unsupported, and oversized payment evidence.", feature: "Payment upload validation",
    preconditions: ["An active held booking", "Synthetic files: 5 MB image, image just over 5 MB, and a PDF/text file"], account: "Booking owner",
    steps: [
      { action: "Submit without a transfer reference or image.", expected: "Required-field guidance appears and no payment state changes." },
      { action: "Choose a file larger than 5 MB.", expected: "Payment proof image must be 5MB or smaller is shown before or after submission; upload does not proceed." },
      { action: "Attempt to choose or submit a non-image file.", expected: "The picker limits selection and the server rejects a crafted unsupported file." },
      { action: "Upload an image exactly at or below 5 MB with a valid reference.", expected: "Submission succeeds once." }
    ],
    finalExpected: "Only a valid image up to 5 MB is accepted and failed attempts do not create duplicate payments.", screenshots: ["customer-proof-size-error"],
    sourceEvidence: ["src/components/bookings/payment-proof-form.tsx", "src/features/bookings/actions.ts"]
  }),
  uatCase({
    id: "CUST-REC-001", persona: "customer", category: "Reliability", scenario: "Recovery", priority: "Critical",
    purpose: "Confirm an abandoned unpaid hold expires and inventory returns.", feature: "Hold expiration",
    preconditions: ["A held booking with no proof", "A second customer tester", "Permission to wait for expiry or a coordinator-prepared near-expiry record"], account: "Booking owner and second Customer",
    steps: [
      { action: "Record the hold deadline, close the browser, and wait until after it.", expected: "No browser must remain open for expiry to become authoritative." },
      { action: "Open My bookings after expiry.", expected: "The reservation is in History with an expired status; it is not Upcoming and no View payment instructions link appears." },
      { action: "Open the facility/date as the second customer.", expected: "The expired slot is available again." },
      { action: "Refresh twice or allow the cron to run again.", expected: "No duplicate expiry record or error appears." }
    ],
    finalExpected: "Expired unpaid inventory is released idempotently and history remains traceable.", screenshots: ["customer-expired-history", "customer-released-slot"],
    sourceEvidence: ["src/server/bookings/expiration.ts", "src/app/api/cron/expire-bookings/route.ts", "src/app/bookings/page.tsx"]
  }),
  uatCase({
    id: "CUST-REC-002", persona: "customer", category: "Payment", scenario: "Recovery", priority: "High",
    purpose: "Respond to an administrator request for clearer proof.", feature: "Payment action required",
    preconditions: ["Booking Admin has marked a submitted payment Action Required with customer instructions"], account: "Booking owner",
    steps: [
      { action: "Open My bookings and the affected payment.", expected: "Payment Needs Attention and the staff message are visible." },
      { action: "Submit a new unique reference and clearer UAT receipt image.", expected: "A success banner appears and status returns to Payment Submitted - For Verification." },
      { action: "Refresh the page.", expected: "The latest image remains available and no countdown resumes." }
    ],
    finalExpected: "The customer can recover from Action Required without losing the held slot.", screenshots: ["customer-action-required", "customer-proof-resubmitted"],
    sourceEvidence: ["src/server/payments/service.ts", "src/app/bookings/[id]/payment/page.tsx"]
  }),
  uatCase({
    id: "CUST-HP-007", persona: "customer", category: "Bookings", scenario: "Happy path", priority: "High",
    purpose: "Review action-prioritized upcoming bookings and newest-first paginated history.", feature: "My bookings",
    preconditions: ["Customer has awaiting-action, confirmed, expired/rejected/cancelled, and past bookings"], account: "Prepared Customer",
    steps: [
      { action: "Open My bookings.", expected: "Bookings awaiting proof or additional reschedule payment appear at the top of Upcoming." },
      { action: "Inspect rejected, expired, cancelled, and past records.", expected: "They appear in History even if their scheduled date is in the future." },
      { action: "Compare History order.", expected: "Latest scheduled history appears first." },
      { action: "Change Rows per page and use Next/Previous.", expected: "Page count, controls, and records update without duplicates; the dropdown stays attached on mobile." }
    ],
    finalExpected: "The booking timeline makes required customer action obvious and history is stable across pagination.", screenshots: ["customer-bookings-priority", "customer-history-pagination-mobile"],
    sourceEvidence: ["src/app/bookings/page.tsx", "src/components/bookings/booking-history-pagination.tsx"]
  }),
  uatCase({
    id: "CUST-HP-008", persona: "customer", category: "Cancellation", scenario: "Happy path", priority: "Critical",
    purpose: "Cancel a future confirmed booking when policy allows.", feature: "Customer cancellation",
    preconditions: ["Global or facility cancellation is enabled", "A future confirmed booking was created within the configured cancellation window", "No active reschedule"], account: "Booking owner",
    steps: [
      { action: "Open My bookings and find the eligible booking.", expected: "A Cancel action is visible." },
      { action: "Select Cancel and dismiss the confirmation once.", expected: "Nothing changes." },
      { action: "Select Cancel again and confirm.", expected: "A success message appears and the record moves to History as Cancelled." },
      { action: "Open the original facility/date as another customer.", expected: "The cancelled slot is available again." }
    ],
    finalExpected: "Cancellation is explicit, traceable, and releases inventory once.", screenshots: ["customer-cancel-confirmation", "customer-cancelled-history"],
    sourceEvidence: ["src/components/bookings/cancel-booking-button.tsx", "src/server/bookings/policies.ts", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "CUST-NEG-003", persona: "customer", category: "Cancellation", scenario: "Negative", priority: "Critical",
    purpose: "Reject cancellation outside policy and expose any global-setting discrepancy.", feature: "Cancellation policy boundaries",
    preconditions: ["Prepare confirmed bookings: past, outside the cancellation window, facility-disabled, and with active reschedule"], account: "Booking owner",
    steps: [
      { action: "Inspect each ineligible booking in My bookings.", expected: "Cancel is absent for past, late, disabled-policy, and active-reschedule records." },
      { action: "Enable cancellation globally but leave the facility override as Inherit; refresh My bookings.", expected: "An otherwise eligible booking should expose Cancel." },
      { action: "If Cancel remains absent, record a defect against the global setting mapping and do not change facility policy to force a pass.", expected: "The result is recorded as Fail with evidence." },
      { action: "Attempt a stale cancellation from a previously open tab after policy changes.", expected: "The server rejects it and the booking remains unchanged." }
    ],
    finalExpected: "Server policy always wins; global inheritance behavior is explicitly accepted or defected.", screenshots: ["customer-cancellation-ineligible"],
    sourceEvidence: ["src/app/bookings/page.tsx", "src/server/bookings/policies.ts"], confidence: "gap"
  }),
  uatCase({
    id: "CUST-NEG-004", persona: "customer", category: "Booking integrity", scenario: "Negative", priority: "Critical",
    purpose: "Prevent stale or simultaneous attempts from double-booking a slot.", feature: "Concurrency and idempotency",
    preconditions: ["Two verified UAT customers in separate browsers", "One open future hour"], account: "Two Customers",
    steps: [
      { action: "Both testers open the same facility/date and select the same slot without committing.", expected: "Both may select because selection alone is not a hold." },
      { action: "Coordinate both testers to select Reserve & Pay at nearly the same time.", expected: "Exactly one reaches payment instructions; the other receives an availability/conflict error." },
      { action: "On the successful browser, double-click or retry after a simulated refresh.", expected: "The same idempotent result is returned; no second booking/reference is created." },
      { action: "Refresh both availability views.", expected: "One active hold blocks the slot." }
    ],
    finalExpected: "Exactly one valid booking hold exists for the contested range.", screenshots: ["customer-concurrent-winner", "customer-concurrent-conflict"],
    sourceEvidence: ["prisma/migrations/20260815134500_add_booking_overlap_guards/migration.sql", "src/server/bookings/service.ts"]
  }),
  uatCase({
    id: "CUST-RESP-001", persona: "customer", category: "Responsive", scenario: "Edge", priority: "High",
    purpose: "Complete the main booking flow on a narrow mobile viewport.", feature: "Mobile customer booking",
    preconditions: ["Use a real iPhone/Android browser or 390 x 844 emulation", "A future slot is available"], account: "Verified Customer",
    steps: [
      { action: "Open the hamburger menu, select a navigation item, then open it and select Sign In/Register where applicable.", expected: "The menu closes after every selection and when tapping outside." },
      { action: "Open a facility.", expected: "Booking date and slots are visible before expanded facility details; no horizontal page scroll is needed." },
      { action: "Select multiple slots, review pricing, and open payment instructions.", expected: "All controls, labels, and confirmation dialogs fit within the viewport." },
      { action: "Open Payment method and Rows per page dropdowns.", expected: "Options stay attached to their controls rather than floating in the screen center." }
    ],
    finalExpected: "The customer journey is usable one-handed without hidden right-side content.", screenshots: ["customer-mobile-menu", "customer-mobile-booking", "customer-mobile-payment-method"],
    sourceEvidence: ["src/components/layout", "src/components/bookings/booking-panel.tsx", "src/components/bookings/payment-method-menu.tsx"]
  }),
  uatCase({
    id: "CUST-ACC-001", persona: "customer", category: "Accessibility", scenario: "Edge", priority: "Medium",
    purpose: "Use core customer controls without a mouse and with understandable status text.", feature: "Customer accessibility",
    preconditions: ["Desktop browser", "Keyboard only for the first pass"], account: "Verified Customer",
    steps: [
      { action: "Tab through header, date, slot buttons, Reserve & Pay, and payment form.", expected: "Focus is always visible and follows a logical order." },
      { action: "Use Enter/Space to select and deselect slots.", expected: "The same behavior works as pointer input." },
      { action: "Trigger a validation error and a successful proof submission.", expected: "Messages are adjacent to fields or announced through an aria-live region." },
      { action: "Inspect statuses without relying on color.", expected: "Booked, Available, Submitted, Confirmed, and Expired have text labels." }
    ],
    finalExpected: "Core customer tasks are keyboard-operable and status is not color-only.", screenshots: ["customer-keyboard-focus"],
    sourceEvidence: ["src/components/bookings/booking-panel.tsx", "src/components/bookings/payment-proof-form.tsx"]
  })
]);
