(function () {
  const step = (action, expected) => ({ action, expected });
  const shot = (file, caption, alt) => ({ file, caption, alt });
  const scenario = (id, title, category, summary, precondition, requirement, steps, outcome, notes = [], screenshots = [], tags = []) => ({
    id, title, category, summary, precondition, requirement, steps, outcome, notes, screenshots, tags
  });

  const customer = {
    id: "customer",
    name: "Customer",
    shortName: "Customer",
    icon: "CU",
    color: "#16725b",
    cardDescription: "Create an account, reserve facilities, submit payment proof, and track bookings.",
    introduction: "Use this guide when booking a facility for yourself. It covers account access, single and consolidated bookings, payment proof, booking history, and account notifications.",
    can: ["Browse facilities, photos, rate cards, and live availability", "Book one schedule immediately or build a multi-facility cart", "Upload one payment proof for a booking or consolidated order", "Review booking history, payment feedback, and account notifications", "Cancel an eligible booking when the displayed policy allows it"],
    cannot: ["Confirm your own payment", "Reserve a slot merely by adding it to the cart", "Change facility schedules, prices, or operating hours", "Reschedule a paid booking yourself", "Access staff or administration pages"],
    permissionNote: "",
    scenarios: [
      scenario("CUST-01", "Create and verify a customer account", "Account access", "Register with your email address, verify it using the emailed code, and sign in.", "You are signed out and have access to the email inbox you are registering.", "Your name, mobile number, a unique email address, and a strong password.", [
        step("Open the menu and select Register.", "The Create your account page opens."),
        step("Enter your name, email, mobile number, password, and password confirmation.", "Each field keeps its value; password guidance appears before submission if a rule is not met."),
        step("Select Create customer account once.", "A verification page says that a code was sent to your email."),
        step("Open the verification email and enter the six-digit code on the verification page.", "The account is marked verified and you can continue to sign in."),
        step("Sign in with the verified email and password.", "The Facilities page opens and the menu shows My Account and Sign Out.")
      ], "You can sign in and browse as an authenticated customer.", ["Do not share the verification code.", "If the email does not arrive, check spam and verify that the address was typed correctly before requesting another code.", "Repeated requests may be temporarily rate limited."], [shot("customer-register.png", "Customer registration form.", "MMG Stellar customer registration page")], ["registration", "verification", "sign in"]),

      scenario("CUST-02", "Recover or change your password", "Account security", "Use Forgot password when you cannot sign in, or change the password from My Account when already signed in.", "For recovery, you can access the verified email inbox. For a normal change, you know the current password.", "A new strong password that is different from the current password.", [
        step("From Sign In, select Forgot password.", "The password recovery page opens."),
        step("Enter the verified account email and submit the request.", "A neutral confirmation is shown so the page does not reveal whether an account exists."),
        step("Open the recovery email and follow its secure reset link before it expires.", "The reset page allows a new password and confirmation."),
        step("If already signed in, open My Account, expand Change password, and enter the current and new passwords.", "The page checks the same strong-password rules used during registration."),
        step("Submit the change, then sign in again if prompted.", "The old password no longer works and the new password works.")
      ], "The account accepts only the new password.", ["The current password cannot be reused.", "Use a unique password that is not used on another website.", "Never ask staff to send your password by email or chat."], [shot("customer-forgot-password.png", "Password recovery starts from the sign-in page.", "Forgot password page")], ["forgot password", "change password"]),

      scenario("CUST-03", "Browse facilities and understand rates", "Facilities and pricing", "Compare facilities, photos, operating details, and VAT-exclusive rate cards before choosing a schedule.", "No account is required to browse; sign in before booking.", "A preferred facility and approximate date and time.", [
        step("Open Facilities from the main menu.", "Enabled facilities appear as cards with their primary photos and base pricing."),
        step("Open a facility card.", "The facility detail and booking workspace open; facility information can be expanded on small screens."),
        step("Review the rate card and the VAT-exclusive wording.", "The applicable weekday, weekend, holiday, or time-band base rates are visible."),
        step("Choose a date within the available booking window.", "Hourly slots refresh for the selected date without creating a hold."),
        step("Read the slot labels before selecting.", "Available slots show pricing; unavailable, booked, or administratively blocked schedules all appear unavailable to customers.")
      ], "You understand the facility, applicable base rate, and available schedule before selecting a slot.", ["All displayed amounts are base prices and exclusive of VAT.", "The authoritative price is recalculated when a booking or checkout is confirmed.", "Selecting or viewing a slot alone does not reserve it."], [shot("customer-facilities.png", "Public facility list with the main facility image and base pricing.", "MMG Stellar facilities listing"), shot("customer-facility-detail.png", "Facility booking workspace with date and hourly slot selection.", "Facility detail and availability page")], ["facilities", "rates", "availability"]),

      scenario("CUST-04", "Reserve one facility with Book now", "Single booking", "Create a 15-minute payment hold for one facility schedule without using the cart.", "You are signed in and the chosen hourly slots are available.", "A facility, a date, and one or more consecutive hourly slots.", [
        step("Open the facility and choose the booking date.", "Hourly availability refreshes for that date."),
        step("Select the first available hourly slot. Select additional consecutive slots if needed.", "Selected slots are highlighted and the VAT-exclusive base amount updates."),
        step("Select Book now and accept the confirmation prompt.", "The server rechecks availability and creates a temporary reservation only if the complete schedule is still available."),
        step("Review the payment instructions, booking reference, amount due, and deadline.", "A countdown shows how long the unpaid slot remains held."),
        step("Pay externally and submit proof before the deadline using CUST-06.", "The hold stops expiring after valid proof is submitted and waits for staff review.")
      ], "A held booking with one booking reference appears in My Bookings and is awaiting payment or verification.", ["Do not double-click Book now.", "A cart is not needed for a single schedule.", "If another customer secured the slot first, choose another available schedule."], [shot("customer-facility-detail.png", "Select consecutive hourly slots before choosing Book now.", "Customer facility booking controls"), shot("customer-bookings.png", "Upcoming and historical bookings are shown together on My Bookings.", "Customer bookings page")], ["book now", "single booking", "hold"]),

      scenario("CUST-05", "Build a cart and complete consolidated checkout", "Multiple bookings", "Book several facilities or schedules with one order reference, one deadline, and one payment proof.", "You are signed in. Adding an item does not reserve the slot.", "Two or more valid schedules and enough time to review the complete cart.", [
        step("Select a facility date and one or more consecutive hourly slots, then choose Add to cart.", "The cart opens and shows the selected facility, schedule, price, and current availability."),
        step("Select Add another facility or schedule and repeat for each required schedule.", "The persistent cart contains each distinct schedule; exact duplicate items are prevented."),
        step("Review every cart item, the VAT-exclusive amount due, and any price-change or availability warnings.", "Each item is still a preview and no slot is held yet."),
        step("Edit or remove any incorrect item. Resolve all Needs attention warnings.", "The consolidated amount updates and checkout becomes available only when the cart is valid."),
        step("Select Confirm consolidated checkout and accept the explicit confirmation.", "The server validates and holds all items atomically; if any item fails, none are booked."),
        step("Open the resulting order and review the order reference, child booking references, amount, and payment deadline.", "One order groups the individually traceable bookings.")
      ], "A pending consolidated order appears in My Bookings with all selected schedules and one payment action.", ["Cart items do not reserve inventory.", "Different facilities may be booked for overlapping times.", "Checkout is all-or-nothing: an unavailable item prevents the whole order from being created."], [shot("customer-cart.png", "The cart shows each schedule and one consolidated VAT-exclusive amount due.", "Customer consolidated booking cart")], ["cart", "consolidated checkout", "multiple facilities"]),

      scenario("CUST-06", "Upload payment proof and respond to staff feedback", "Payments", "Submit one receipt image and transfer reference, then follow any staff request for new evidence.", "A single booking or order is awaiting payment and has not expired.", "Payment method, transfer reference number, and a JPG, PNG, or WEBP receipt no larger than 5 MB.", [
        step("Open My Bookings and select View payment instructions for the pending booking or order.", "The correct booking/order reference, amount due, instructions, and deadline appear."),
        step("Choose the payment method and enter the transfer reference exactly as shown by the payment provider.", "The transfer reference is ready for duplicate-reference checking."),
        step("Choose the receipt image and submit proof once.", "A green success message appears and the uploaded image can be reviewed."),
        step("Return to My Bookings or My Account.", "The status reads Payment Submitted — For Verification while staff reviews it."),
        step("If staff requests action, open My Account, select Open payment on Payment Needs Attention, read the staff comment, and submit clearer proof.", "The replacement evidence is recorded without creating a second booking or payment.")
      ], "The payment status is For Verification or returns to For Verification after resubmission; the booking is not confirmed until staff verifies it.", ["Uploading proof does not confirm a booking.", "Do not upload account passwords, OTPs, or unrelated personal documents.", "An expired booking does not show a payment action."], [shot("customer-account.png", "My Account inbox links actionable payment updates to the correct page.", "Customer account notification inbox")], ["payment proof", "receipt", "action required"]),

      scenario("CUST-07", "Track, cancel, and review bookings", "Booking history", "Use one timeline for upcoming single bookings, order bookings, payment actions, completed visits, cancellations, and expired holds.", "You are signed in and have at least one booking.", "The relevant booking or order reference.", [
        step("Open My Bookings.", "Bookings needing payment action appear first in Upcoming; expired, rejected, cancelled, and past bookings appear in History."),
        step("Open View order details for a consolidated order or the booking details link for an individual booking.", "Current schedules and payment status are clear; rescheduled history is distinguished from the active schedule."),
        step("For an eligible booking, select Cancel booking and read the confirmation prompt.", "The page states the effect before cancellation."),
        step("Confirm only if you intend to cancel.", "A green success message appears, the booking moves to History, and the slot is released according to policy."),
        step("Open My Account to review recent actionable booking or payment messages.", "Opening the account clears the new-notification badge; unresolved actions remain in the inbox.")
      ], "The timeline and detail pages show the correct current status without exposing internal staff notes.", ["Cancellation availability depends on facility and global policy.", "Refund handling, when applicable, is coordinated by staff and is not automatic.", "Contact staff for paid-booking rescheduling."], [shot("customer-bookings.png", "My Bookings combines single and consolidated booking activity.", "Customer upcoming and history booking timeline"), shot("customer-account.png", "Account inbox with searchable and paginated updates.", "Customer account profile and inbox")], ["history", "cancel", "inbox"])
    ]
  };

  const superAdmin = {
    id: "super-admin",
    name: "Admin — Super Admin",
    shortName: "Super Admin",
    icon: "SA",
    color: "#9a5b08",
    cardDescription: "Configure the platform, manage access, review payments, and audit operations.",
    introduction: "The Super Admin guide covers the full administrative workspace. This role carries every implemented permission and must be used carefully, especially for roles, users, pricing, payment verification, and facility operations.",
    can: ["Access all operational, financial, configuration, and security workspaces", "Create and assign roles and permissions", "Manage facilities, hours, blocked schedules, photos, holidays, and pricing", "Review payments, bookings, customers, reports, and audit records", "Reschedule paid bookings and use authorized adjustment overrides"],
    cannot: ["Delete or weaken the protected Super Admin recovery role", "Deactivate or remove the last active Super Admin", "Treat payment proof as verified without a staff decision", "Recover a customer's existing password", "Bypass authoritative availability and pricing validation"],
    permissionNote: "Super Admin is a protected system role. Custom roles can be configured, so another administrator may have a different combination of access.",
    scenarios: [
      scenario("SA-01", "Read the operational overview", "Daily operations", "Use the dashboard to understand booking activity, pending payments, enabled facilities, and revenue where available.", "You are signed in with active Super Admin access.", "No special test data.", [
        step("Open Admin from the main menu.", "The Operational overview opens and identifies the signed-in administrator."),
        step("Review Confirmed Bookings, Pending Payment, Paid Revenue, and Enabled Facilities.", "The available cards reflect current database records and your financial permission."),
        step("Review Recent bookings and their status labels.", "Customer data, payment details, and status are visible at the level allowed by your permissions."),
        step("Use the admin navigation to open the next required workspace.", "Only server-authorized pages open; the navigation wraps or scrolls appropriately on small screens.")
      ], "You can identify operational work that needs attention without changing a record.", ["Dashboard figures are operational summaries, not a substitute for financial reconciliation."], [shot("admin-overview.png", "Super Admin operational overview and permission-based navigation.", "MMG Stellar admin dashboard")], ["dashboard", "overview"]),

      scenario("SA-02", "Create or update a facility", "Facility operations", "Maintain customer-facing information, fallback pricing, operating hours, cancellation settings, images, and blocked schedules.", "Confirm the requested business change and effective date before editing.", "Facility name, slug for a new facility, type, description, base rate, hours, images, and policy details.", [
        step("Open Admin, then Facilities, and select a facility from the list; use Create facility only for new inventory.", "The selected facility is highlighted and its details load in the editing pane."),
        step("Update General information and pricing, then select the nearby Save changes button.", "A green success message appears near that section and persisted values remain visible."),
        step("Upload one or more facility images, review their order, choose the main photo, and save the image section.", "The image gallery refreshes and the chosen main image is used on public facility cards."),
        step("Set hourly operating times and cancellation settings, then save that section.", "Opening and closing values persist and invalid ranges are rejected."),
        step("Add a blocked schedule. Use All day for a date range or choose hourly start and end times.", "Blocked time is unavailable operationally and appears as booked/unavailable to customers."),
        step("Open the public facility page in a separate tab and verify wording, images, and availability.", "Public content matches the saved configuration without exposing internal controls.")
      ], "The correct facility configuration persists after reload and public presentation matches the intended change.", ["Use Asia/Manila dates and times.", "Do not upload private customer or payment images as facility media.", "Facility changes can affect future availability; verify the public page after saving."], [shot("admin-facilities.png", "Facility list and selected facility editing workspace.", "Admin facility management page")], ["facilities", "operating hours", "blocked schedules", "images"]),

      scenario("SA-03", "Manage dynamic pricing and the holiday calendar", "Pricing", "Configure VAT-exclusive pricing rules and verify the generated public rate card.", "The business-approved base rates, date ranges, day type, and time bands are available.", "Facility, rule label, applicable days, hourly range where required, amount, priority, and effective dates.", [
        step("Open Admin, then Pricing, and select a facility.", "The facility row is highlighted and its fallback rate and schedule overrides are shown."),
        step("Select an existing override or Add rule.", "The rule editor shows the applicable day type and only shows Selected days when that type is chosen."),
        step("Enter the rate, effective dates, and hourly range for time-based weekday or selected-day rules.", "Weekend and holiday rules apply all day and do not request a time range."),
        step("Review conflict, gap, or hidden-rule warnings and use the price preview for a representative date and time.", "The centralized pricing engine shows the expected VAT-exclusive result."),
        step("Save and review the rate-card preview.", "A green success message appears and the preview matches the public rate card wording."),
        step("For a global holiday, open Holidays, add or update the date, and repeat the pricing preview for that date.", "An active holiday rule takes precedence over lower-priority day rules.")
      ], "The public rate card and server price preview agree for weekday, weekend, selected-day, and holiday examples.", ["Pricing changes do not rewrite historical booking price snapshots.", "All configured amounts are base prices and exclusive of VAT.", "Changing future rates can affect carts that have not checked out."], [shot("admin-pricing.png", "Facility pricing rules, editor, preview, and generated rate card.", "Admin dynamic pricing page"), shot("admin-holidays.png", "Global holiday calendar used by dynamic pricing.", "Admin holiday management page")], ["pricing", "holidays", "rate card"]),

      scenario("SA-04", "Review and decide a payment", "Payments", "Verify, reject, or request clearer proof for a single booking, consolidated order, or reschedule adjustment.", "The customer has submitted payment proof and the external payment account can be checked independently.", "Payment/order reference, submitted receipt, transfer reference, actual account records, and a decision note where applicable.", [
        step("Open Admin, then Payments, and select a submitted record from Payment queue or Reschedule adjustment payments.", "The detail page shows the customer, all related schedules, expected amount, submitted reference, proof image, and history."),
        step("Compare the proof and transfer reference against the actual GCash or bank account.", "Any duplicate-reference warning is visible but is treated only as a reconciliation aid."),
        step("Choose Confirm payment, Request new proof, or Reject payment and enter a clear customer-facing comment where needed.", "The confirmation prompt explains the resulting state."),
        step("Confirm the decision once.", "A green success message appears and the status transition is recorded with the acting administrator and timestamp."),
        step("For a consolidated order, verify that all initial child bookings change together.", "Verification confirms all eligible bookings atomically; rejection or final expiration releases all initial holds.")
      ], "The payment, booking/order, customer-facing note, and audit history all show one consistent outcome.", ["Never verify from the screenshot alone; compare with the actual receiving account.", "Request new proof for recoverable evidence issues; use rejection only according to approved policy.", "Do not include internal security details in customer-facing comments."], [shot("admin-payments.png", "Compact payment queue with status and reconciliation details.", "Admin payment verification queue")], ["payments", "verify", "reject"]),

      scenario("SA-05", "Reschedule a paid confirmed booking", "Bookings", "Move an eligible booking while preserving its original payment, schedule, price snapshot, and audit history.", "The booking is paid, verified, confirmed, in the future, and outside the configured cutoff.", "Replacement facility/date/time, business reason, customer-facing note, and adjustment decision if prices differ.", [
        step("Open the booking from Customers, Calendar, or a booking detail link, then select Reschedule.", "Completed, past, incompatible, or cutoff-bound bookings explain why they cannot be rescheduled."),
        step("Choose the replacement facility and date, then select the starting slot.", "The required number of consecutive hourly slots is highlighted based on the original duration; the current booking is visually identified."),
        step("Review the original and replacement schedules, server-calculated price snapshots, and price difference.", "Same, lower, or higher price handling is explained before confirmation."),
        step("Enter the mandatory reason, internal note if needed, and customer-facing note.", "Internal notes remain staff-only."),
        step("Confirm the reschedule once.", "A green success message appears. Same/lower moves complete atomically; a higher-price move provisionally holds the replacement while the original remains valid."),
        step("Resolve any lower-price adjustment or verify any additional payment using the authorized workflow.", "The original payment remains intact and only the affected booking is adjusted.")
      ], "The active schedule, original history, price adjustment, payment traceability, and audit record are all correct.", ["Do not release the original schedule manually.", "Use an adjustment override only with explicit authority and a documented reason.", "Rescheduling one booking in an order does not change sibling bookings."], [shot("admin-calendar.png", "Use the calendar to open the booking before starting the guided rescheduling workflow.", "Administrative booking calendar")], ["reschedule", "price adjustment"]),

      scenario("SA-06", "Create and maintain roles", "Access control", "Build reusable access profiles from stable permissions without relying on editable role names.", "You have a written access request approved by the business owner.", "Role name, description, required capabilities, and users who will receive the role.", [
        step("Open Admin, then Roles, and select Create role or Clone on a suitable starting role.", "A structured permission editor groups capabilities by business domain."),
        step("Enter the role name and description; select only permissions needed for the job.", "Required prerequisite permissions are included or validated."),
        step("Review sensitive-permission warnings and the resulting summary.", "Broad or critical access is visible before saving."),
        step("Save the role and reselect it if necessary to review the persisted permission list.", "A green success message appears and the role shows its active state, permission count, and assigned users."),
        step("Deactivate or delete only an unused custom role after moving affected users.", "Inactive roles grant no effective permissions; protected Super Admin controls cannot be removed.")
      ], "The role grants exactly the approved capabilities and does not create unintended access.", ["Assign permissions by capability, never by copying another person's access without review.", "The protected Super Admin role cannot be deleted or stripped.", "Role changes take effect without relying on stale client-side navigation."], [shot("admin-roles.png", "Role list and categorized permission editor.", "Admin role management workspace")], ["roles", "permissions", "RBAC"]),

      scenario("SA-07", "Assign roles and deactivate admin access", "Admin users", "Give a verified user one or more administrative roles and review the union of effective permissions.", "The person has an existing verified user account and an approved access request.", "User identity, approved roles, and planned activation date.", [
        step("Open Admin, then Admin Users, and search for the person.", "The paginated user list shows matching accounts."),
        step("Select the user and review current roles, effective permissions, and assignment history.", "Each effective permission identifies the contributing role."),
        step("Select or remove roles and review the resulting access before saving.", "Inactive roles cannot be assigned and dependencies remain valid."),
        step("Save the assignment.", "A green success message appears and the selected user's role/effective-permission view immediately refreshes."),
        step("To remove staff access, deactivate admin access and confirm.", "Protected lockout rules prevent removing the last active Super Admin; other affected users are denied admin pages on their next authorized request."),
        step("Ask the staff member to refresh or sign in again and verify the intended navigation and direct-page access.", "The header and admin access reflect the current active state.")
      ], "The staff account has only approved effective permissions and the assignment is recorded in history and audit logs.", ["Do not share a default password between staff accounts.", "Each administrator should change their own password from My Account.", "Removing one role may still leave access through another assigned role."], [shot("admin-users.png", "Searchable admin-user list, role assignments, and effective permissions.", "Admin user management page")], ["admin users", "role assignment", "deactivate"]),

      scenario("SA-08", "Review customers, reports, and audit history", "Oversight", "Investigate operational activity without altering source records.", "You know the customer, booking/order reference, date range, or administrator involved.", "A specific support, reconciliation, or security question.", [
        step("Use Customers to search by name, email, or mobile number and select the customer.", "The profile and paginated booking/payment transactions load in the detail pane."),
        step("Use Reports for approved booking, revenue, allocation, or utilization review and export only when necessary.", "Verified payments are not multiplied across consolidated child bookings."),
        step("Use Audit Logs and search relevant actor, action, entity, or record information.", "Human-readable actor and entity names appear where available, with identifiers retained for traceability."),
        step("Compare timestamps, references, and status transitions across the customer, payment, booking, and audit views.", "The event sequence supports the investigation without exposing secrets."),
        step("Record the outcome in the approved support or incident process.", "No source record is changed merely to make a report reconcile.")
      ], "The operational question is answered with traceable records and any discrepancy is escalated rather than hidden.", ["Exported customer and financial data must be handled as sensitive information.", "Audit logs must not contain passwords, OTPs, or raw receipt files."], [shot("admin-customers.png", "Searchable customer list with booking and payment history.", "Admin customer management page"), shot("admin-audit.png", "Searchable, paginated administrative audit trail.", "Admin audit logs page")], ["customers", "reports", "audit"]),

      scenario("SA-09", "Maintain your own admin password", "Account security", "Change your own password without requiring another administrator to know it.", "You are signed in as an administrator and know your current password.", "A new strong password that is not the current password.", [
        step("Open My Account from the main menu.", "Your admin profile appears without the customer notification inbox."),
        step("Expand Change password.", "Current password, new password, and confirmation fields appear."),
        step("Enter the current password and a compliant new password twice, then select Change password.", "A green success message confirms the change; reuse of the current password is rejected."),
        step("Sign out and sign back in with the new password.", "The new password works and the old password does not.")
      ], "Only you know the current admin password and the account uses the newly chosen password.", ["A Super Admin manages access roles, not another person's password.", "Use Forgot password when the current password is unknown."], [], ["admin password", "my account"])
    ]
  };

  const bookingAdmin = {
    id: "booking-admin",
    name: "Admin — Booking Admin",
    shortName: "Booking Admin",
    icon: "BA",
    color: "#28559a",
    cardDescription: "Manage bookings, customers, payments, rescheduling, and reports.",
    introduction: "Booking Admins handle the full operational booking and payment lifecycle. Their default role includes customer records, payment verification, reports, and normal rescheduling, but excludes platform access and configuration administration.",
    can: ["View availability, bookings, and full customer booking history", "Create and manage bookings", "Review and verify payment proof", "Reschedule eligible paid bookings and resolve lower-price adjustments", "View and export reports"],
    cannot: ["Manage roles or administrator access", "Change pricing, holidays, facilities, or operating hours", "Use the additional-amount waiver override by default", "Edit facility content or photos", "Access audit logs by default"],
    permissionNote: "These are seeded defaults. A Super Admin may change the role, so the visible menu is the authoritative indication of currently assigned capabilities.",
    scenarios: [
      scenario("BA-01", "Monitor bookings and availability", "Daily operations", "Use the overview and calendar to prepare for upcoming facility activity.", "You are signed in with the Booking Admin role.", "A date or booking reference to review.", [
        step("Open Admin and review the operational overview.", "Booking and payment summaries appear; facility configuration controls do not."),
        step("Open Calendar, navigate to the required month, and choose a day.", "The page remains anchored near the selected day and displays hourly facility states."),
        step("Open a booking from the calendar or customer history when action is needed.", "The booking detail shows the current active schedule, payment, and rescheduling history allowed by your permissions."),
        step("Compare customer-facing availability if investigating a conflict.", "Held, confirmed, and blocked inventory is consistently unavailable to customers.")
      ], "You can explain the operational status of each relevant slot and booking.", ["Calendar colors also include text labels; do not rely on color alone."], [shot("admin-calendar.png", "Hourly admin calendar for facility operations.", "Admin booking calendar")], ["calendar", "availability"]),

      scenario("BA-02", "Verify or return payment proof", "Payments", "Make an evidence-based decision on submitted single, consolidated, or rescheduling payments.", "A submitted payment appears in the queue.", "Actual receiving-account record and customer proof.", [
        step("Open Payments and select the submitted record.", "The detail shows the expected amount, reference, proof, related booking(s), and prior review history."),
        step("Check the transfer against the real payment account.", "The amount and transfer reference can be reconciled."),
        step("Confirm, Reject, or Request new proof with an appropriate comment.", "The intended customer-facing status and next action are clear before confirmation."),
        step("Confirm once and review the green success message.", "The decision, reviewer, timestamp, booking/order state, and customer-facing comment persist.")
      ], "Payment and booking/order statuses agree, and the customer receives one clear next action.", ["A receipt upload is not proof of funds by itself.", "Consolidated order verification applies to all initial child bookings atomically."], [shot("admin-payments.png", "Payment and reschedule-adjustment queues.", "Booking Admin payment queue")], ["payment verification"]),

      scenario("BA-03", "Reschedule an eligible paid booking", "Rescheduling", "Move one paid confirmed booking and handle same, lower, or higher pricing safely.", "The booking is eligible and a replacement schedule has been agreed with the customer.", "Replacement details, reason, customer note, and any adjustment information.", [
        step("Open the booking detail and choose Reschedule.", "The page shows current booking details and eligible replacement controls."),
        step("Choose facility/date and select the replacement starting hour.", "The original duration is preserved and the required consecutive slots are selected."),
        step("Review server-calculated before-and-after pricing and enter the reason and notes.", "The adjustment type is clear and internal notes are separated from customer notes."),
        step("Confirm the reschedule.", "Same/lower moves finalize atomically; higher-price moves retain the original booking while additional payment is pending."),
        step("Resolve lower-price adjustments or verify additional proof through the permitted payment workflow.", "History remains traceable and siblings in a consolidated order are unchanged.")
      ], "The customer has one unambiguous active schedule and all original financial history remains intact.", ["The default Booking Admin role cannot waive an additional amount.", "Completed and past bookings cannot be rescheduled."], [shot("admin-calendar.png", "Open the relevant booking from the hourly calendar before starting rescheduling.", "Booking Admin calendar")], ["reschedule", "adjustment"]),

      scenario("BA-04", "Research a customer or booking", "Customer support", "Use customer search and booking history to answer a support question.", "The customer provided a name, contact detail, booking reference, or order reference.", "A legitimate support purpose.", [
        step("Open Customers and search by name, email, or mobile number.", "Matching customer accounts appear in the paginated list."),
        step("Select the customer.", "The detail pane shows contact information, booking transactions, payment status, and proof history."),
        step("Open the relevant booking detail when rescheduling or deeper history is required.", "The selected record is clearly related to its consolidated order when applicable."),
        step("Give the customer only the information needed to resolve the request.", "Internal notes, other customers, and administrative details are not disclosed.")
      ], "The support request is resolved using the correct customer and booking record.", ["Confirm identity according to the approved support procedure before discussing personal or payment information."], [shot("admin-customers.png", "Customer search and transaction detail workspace.", "Booking Admin customer lookup")], ["customers", "support"]),

      scenario("BA-05", "Review and export reports", "Reporting", "Use verified financial and operational records without double-counting consolidated payments.", "The report purpose and date range are approved.", "Date range and secure destination for any export.", [
        step("Open Reports and set the required filters.", "The report uses current booking, verified payment, allocation, and utilization conventions."),
        step("Review totals and sample individual records before exporting.", "Order references and individual booking references remain distinguishable."),
        step("Select Export only if the data is required outside the platform.", "The export is generated under your reports.export permission."),
        step("Store or transmit the export using the approved secure process, then delete local copies when no longer needed.", "Sensitive customer and financial data is not left in an uncontrolled location.")
      ], "The report answers the approved question and reconciles one consolidated payment only once.", ["Pending payments are not paid revenue; waivers are not payments; unresolved refunds are not completed adjustments."], [shot("admin-reports.png", "Permission-protected operational and financial reports.", "Admin reports page")], ["reports", "export"]),

      scenario("BA-06", "Confirm that restricted configuration stays restricted", "Access boundaries", "Verify that operational access does not unintentionally include platform configuration or security administration.", "You are signed in with only the seeded Booking Admin role.", "No test data.", [
        step("Review the admin menu.", "Pricing, Holidays, Facilities, Roles, Admin Users, and Audit Logs are absent by default."),
        step("Try opening one prohibited page using a known direct URL, such as /admin/roles.", "The server denies access or redirects to a permitted page; no sensitive data is rendered."),
        step("Return to Payments, Customers, Calendar, or Reports.", "Permitted workspaces still open normally."),
        step("Report any unexpected access to a Super Admin immediately.", "No unauthorized change is attempted.")
      ], "The Booking Admin can perform operational work but cannot reach security, pricing, or facility-configuration controls.", ["Hidden navigation is not the security control; direct requests are also authorized on the server."], [], ["permissions", "restricted"])
    ]
  };

  const receptionist = {
    id: "receptionist",
    name: "Admin — Receptionist",
    shortName: "Receptionist",
    icon: "RE",
    color: "#9b3d58",
    cardDescription: "Check hourly availability and complete new-customer walk-in bookings.",
    introduction: "Receptionists use a deliberately limited front-desk workspace. Their seeded role supports availability, booking visibility, walk-in creation, and the minimum customer information needed to serve an active booking.",
    can: ["View facility availability and booking status", "Create a confirmed walk-in booking for a genuinely new customer", "Capture cash or permitted transfer details during the walk-in", "See limited customer details needed for the front desk"],
    cannot: ["Browse the full customer directory", "Verify uploaded customer payments", "Reschedule paid bookings", "View financial reports or exports", "Change pricing, facilities, roles, users, or audit records"],
    permissionNote: "The seeded Receptionist role has availability.view, bookings.view, bookings.create, and customers.view_limited. It intentionally excludes full customer and payment access.",
    scenarios: [
      scenario("REC-01", "Check availability for a walk-in", "Front desk", "Choose the schedule before collecting customer and payment details.", "You are signed in with Receptionist access and the customer has requested a future schedule.", "Requested facility, date, and duration.", [
        step("Open Admin, then Walk-ins.", "The date selector, facility list, hourly availability, and pricing labels appear before customer details."),
        step("Choose the requested date within the booking window.", "Slots refresh and unavailable inventory appears booked/unavailable."),
        step("Select a facility, then select the first hourly slot; choose enough consecutive hours for the requested duration.", "The selected schedule and VAT-exclusive base amount update."),
        step("Repeat the schedule back to the customer before entering identity or payment information.", "The customer confirms facility, date, time, duration, and base amount.")
      ], "A valid available schedule is selected and ready for customer validation.", ["Availability may change until the booking is submitted.", "Do not promise a slot that is shown as booked or unavailable."], [shot("admin-walkins.png", "Walk-in booking starts with facility, date, hourly slots, and price.", "Receptionist walk-in availability page")], ["walk-in", "availability"]),

      scenario("REC-02", "Validate a walk-in customer", "Customer validation", "Prevent creating a duplicate walk-in account when the customer already uses the booking platform.", "A valid schedule is selected.", "Customer's full name, email, and mobile number; all are required.", [
        step("Enter the customer's name, email, and mobile number exactly as provided.", "The form can compare email and mobile details with existing accounts."),
        step("Run the customer validation step.", "The page identifies whether matching details already exist without exposing an unrelated customer record."),
        step("If an existing account is found, stop the walk-in flow and ask the customer to sign in on their phone and use the normal booking/payment process.", "No duplicate customer or walk-in booking is created."),
        step("If the customer is genuinely new, continue to payment capture.", "The form enables the remaining walk-in booking steps.")
      ], "Only a genuinely new customer proceeds through the walk-in creation flow.", ["Do not change an email or mobile number merely to bypass duplicate detection.", "Never ask the customer to disclose their password or email verification code."], [shot("admin-walkins.png", "Customer validation follows schedule selection.", "Walk-in customer validation form")], ["walk-in customer", "duplicate"]),

      scenario("REC-03", "Complete a paid walk-in booking", "Walk-in payment", "Create the customer, payment, and confirmed booking in one front-desk workflow without a payment hold.", "The schedule remains selected and customer validation confirms a new customer.", "Payment method; transfer reference for a non-cash method; amount collected according to the displayed base amount.", [
        step("Choose Cash or the accepted transfer method and enter the reference when required.", "Cash does not require a transfer reference; transfer methods retain the reference."),
        step("Review the customer, facility, schedule, duration, and VAT-exclusive amount.", "The complete before-submit summary is accurate."),
        step("Submit the walk-in booking once.", "The server revalidates availability and creates the booking only if the slot remains available."),
        step("Review the green success message and the created booking details page.", "The reference, customer, confirmed status, payment, facility, and schedule are visible."),
        step("Return to Walk-ins for the next customer.", "The previous form is reset and the booked slot now appears unavailable.")
      ], "A confirmed walk-in booking and payment record exist once, and the details page matches the receipt given to the customer.", ["Walk-ins do not use the customer's 15-minute payment hold.", "Do not double-click submit if the response is slow; check the booking detail first."], [shot("admin-walkins.png", "Payment capture and summary are part of the same walk-in workflow.", "Receptionist walk-in payment form")], ["cash", "walk-in booking"]),

      scenario("REC-04", "Respect receptionist access boundaries", "Access boundaries", "Confirm that front-desk duties do not expose customer directories, receipt proof, reports, pricing, or access administration.", "You are signed in with only the seeded Receptionist role.", "No test data.", [
        step("Review the admin navigation.", "Only the overview, calendar/availability, walk-in, and other explicitly granted booking links appear."),
        step("Try opening /admin/customers, /admin/payments, /admin/reports, and /admin/roles directly.", "The server denies each page and does not render sensitive data."),
        step("Return to Walk-ins and Calendar.", "Permitted pages remain usable."),
        step("Report unexpected access rather than using it.", "A Super Admin can investigate the role assignment and audit trail.")
      ], "Receptionist access remains limited to front-desk booking duties and minimum customer data.", ["Direct URL denial is expected behavior, not a system failure."], [], ["permissions", "privacy"])
    ]
  };

  const social = {
    id: "social-media",
    name: "Admin — Social Media",
    shortName: "Social Media",
    icon: "SM",
    color: "#7552a3",
    cardDescription: "Maintain approved facility descriptions and photo galleries without operational access.",
    introduction: "The Social Media role is intentionally narrow. It can maintain approved customer-facing facility wording and photos, while operational, pricing, customer, payment, reporting, and security fields remain server-protected.",
    can: ["Open the permitted facility-content workspace", "Edit approved facility names and descriptions", "Upload, remove, reorder, and choose the main facility photo", "Preview the public facility presentation"],
    cannot: ["Change fallback or dynamic pricing", "Change holidays, operating hours, blocked schedules, cancellation rules, or enabled status", "View customer records, payment proof, bookings, or reports", "Manage roles or administrative users", "Use crafted form requests to change protected operational fields"],
    permissionNote: "The seeded Social Media role has facility_content.edit and facility_photos.manage only. The facility page must submit only the fields permitted by those capabilities.",
    scenarios: [
      scenario("SOC-01", "Update approved facility wording", "Facility content", "Change customer-facing facility wording without changing operational settings.", "Approved final copy is available and you are signed in with Social Media access.", "Facility to update, approved name and/or description, and a reviewer if required by business process.", [
        step("Open Admin, then Facilities, and select the facility from the list.", "The selected facility is highlighted and only permitted content/photo controls are editable."),
        step("Update the approved name or description.", "Pricing, hours, status, blocking, and policy fields are absent or read-only."),
        step("Select the Save changes button for the content section.", "A green success message appears near the save action and the persisted copy remains visible."),
        step("Open the public facility page and review desktop and mobile presentation.", "The wording is readable, accurate, and does not reveal internal information.")
      ], "The approved wording appears on the correct public facility and no operational value changes.", ["Do not publish personal information, private phone numbers, unapproved claims, or pricing inside the description.", "Pricing must be maintained through pricing rules by an authorized administrator."], [shot("admin-facilities.png", "Facility selection and content workspace; controls vary by permission.", "Facility content management page"), shot("customer-facility-detail.png", "Public facility detail used to verify approved content.", "Public facility page preview")], ["content", "description"]),

      scenario("SOC-02", "Upload and organize facility photos", "Facility photos", "Add multiple customer-facing images, control their order, and choose the main listing image.", "Images are approved for publication and contain no private customer information.", "JPG, PNG, or supported image files prepared at an appropriate web size, plus useful image descriptions.", [
        step("Select the facility and open the image section.", "Existing images appear in their current carousel order."),
        step("Choose multiple new images and review the New images ready to upload area.", "Each pending image can be removed or reordered before upload."),
        step("Arrange images in the desired carousel order and mark the strongest representative image as the main photo.", "The intended primary and secondary order is clear before saving."),
        step("Select Save changes for the image section once.", "A green success message appears and the refreshed gallery displays all saved images in order."),
        step("Open Facilities and the facility detail page on desktop and mobile.", "The main photo appears on the listing and all images load in the carousel without distortion.")
      ], "The approved image set loads reliably, has the correct main image, and is ordered for the customer carousel.", ["Do not upload payment receipts, IDs, customer faces without approved consent, or internal documents.", "Remove duplicate or low-quality images before saving."], [shot("admin-facilities.png", "Multi-image review, ordering, and main-image controls are in the facility workspace.", "Facility image management utility"), shot("customer-facilities.png", "The selected main photo appears on the public facility card.", "Public facility image listing")], ["photos", "carousel", "main image"]),

      scenario("SOC-03", "Check responsive public presentation", "Content quality", "Review facility content and images in the layouts customers actually use.", "The content or image change has been saved.", "Desktop browser and a real or simulated mobile browser.", [
        step("Open the public Facilities page on desktop.", "Cards display a consistent main image, readable title, and concise information."),
        step("Open the edited facility and move through the image carousel.", "Every image loads and the rate/booking area remains the primary action."),
        step("Repeat on a narrow mobile viewport or phone.", "The booking controls appear promptly, details can collapse, and no content extends horizontally off-screen."),
        step("Correct approved content/photo issues or report layout defects with a screenshot and URL.", "No operational setting is changed to work around a content layout issue.")
      ], "The public facility page is clear and usable on desktop and mobile.", ["Check Chrome and Safari where practical.", "Facility availability and price correctness belong to operational administrators, but obvious mismatches should be reported."], [shot("customer-facility-detail-mobile.png", "Mobile facility page keeps booking controls within the viewport.", "Mobile public facility booking page")], ["responsive", "mobile", "content review"]),

      scenario("SOC-04", "Confirm sensitive areas stay unavailable", "Access boundaries", "Verify that the content role cannot access bookings, customer data, payments, financial reports, or administrative security.", "You are signed in with only the seeded Social Media role.", "No test data.", [
        step("Review the admin menu.", "Only facility content/photo access and other explicitly granted links appear."),
        step("Try direct navigation to /admin/payments, /admin/customers, /admin/reports, /admin/pricing, /admin/roles, and /admin/admin-users.", "Each request is denied without rendering sensitive records."),
        step("On Facilities, attempt to change only an approved content or photo field.", "The permitted update succeeds."),
        step("Confirm operating hours, prices, blocked schedules, enabled status, and cancellation settings cannot be submitted through the UI.", "Protected operational fields remain unchanged.")
      ], "The role can maintain public content and photos but cannot access or modify operations, finance, customer data, or security.", ["Report any unexpected menu item or direct-page access immediately."], [], ["permissions", "security"])
    ]
  };

  window.GUIDE_CONTENT = {
    version: "September 2026",
    gettingStarted: [
      { title: "Use your own account", text: "Never share passwords, verification codes, or administrator sessions. Each staff member should use an individually assigned account." },
      { title: "Read the status", text: "Held, awaiting payment, submitted, verified, confirmed, action required, rejected, expired, and cancelled each require a different next step." },
      { title: "Use references", text: "Record the customer-facing booking or order reference when paying, supporting a customer, or reporting an issue." },
      { title: "Submit once", text: "Avoid repeated clicks on checkout, proof upload, verification, rescheduling, and walk-in actions. Wait for the success or error message." }
    ],
    personas: [customer, superAdmin, bookingAdmin, receptionist, social]
  };
})();
