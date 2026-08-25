export const permissionCatalog = [
  { key: "availability.view", name: "View availability", description: "View facility schedules, blocked periods, and slot availability.", category: "Bookings and availability", risk: "STANDARD" },
  { key: "bookings.view", name: "View bookings", description: "View booking records and operational booking status.", category: "Bookings and availability", risk: "STANDARD" },
  { key: "bookings.create", name: "Create bookings", description: "Create manual and walk-in bookings.", category: "Bookings and availability", risk: "ELEVATED" },
  { key: "bookings.manage", name: "Manage bookings", description: "Perform ordinary administrative booking operations.", category: "Bookings and availability", risk: "ELEVATED" },
  { key: "bookings.reschedule", name: "Reschedule bookings", description: "Move paid or confirmed bookings to another schedule.", category: "Bookings and availability", risk: "SENSITIVE" },
  { key: "bookings.reschedule.override_adjustment", name: "Override reschedule adjustment", description: "Waive all or part of an additional rescheduling amount.", category: "Bookings and availability", risk: "CRITICAL" },
  { key: "bookings.reschedule.resolve_adjustment", name: "Resolve reschedule adjustment", description: "Record manual refund, customer credit, or approved no-refund outcomes.", category: "Bookings and availability", risk: "SENSITIVE" },
  { key: "customers.view_limited", name: "View limited customer details", description: "View only customer details required to service an active booking.", category: "Customers", risk: "STANDARD" },
  { key: "customers.view_full", name: "View full customer records", description: "View customer contact details and booking history.", category: "Customers", risk: "SENSITIVE" },
  { key: "payments.view", name: "View payments", description: "View payment submissions and proof details.", category: "Payments", risk: "SENSITIVE" },
  { key: "payments.verify", name: "Verify payments", description: "Confirm, reject, or request action on submitted payments.", category: "Payments", risk: "SENSITIVE" },
  { key: "reports.view", name: "View reports", description: "View booking, revenue, and utilization reports.", category: "Reports", risk: "SENSITIVE" },
  { key: "reports.export", name: "Export reports", description: "Export operational or financial report data.", category: "Reports", risk: "SENSITIVE" },
  { key: "facility_content.edit", name: "Edit facility content", description: "Edit approved customer-facing facility names and descriptions.", category: "Facilities and content", risk: "STANDARD" },
  { key: "facility_photos.manage", name: "Manage facility photos", description: "Upload, replace, reorder, and remove facility photos.", category: "Facilities and content", risk: "ELEVATED" },
  { key: "facilities.manage", name: "Manage facility operations", description: "Manage facilities, operating hours, availability, policies, and blocked schedules.", category: "Facilities and content", risk: "SENSITIVE" },
  { key: "pricing.view", name: "View pricing", description: "View pricing rules and administrative rate previews.", category: "Pricing and holidays", risk: "STANDARD" },
  { key: "pricing.manage", name: "Manage pricing", description: "Create and modify facility pricing rules and fallback rates.", category: "Pricing and holidays", risk: "SENSITIVE" },
  { key: "holidays.manage", name: "Manage holidays", description: "Create and modify holiday calendars used by pricing.", category: "Pricing and holidays", risk: "ELEVATED" },
  { key: "roles.view", name: "View roles", description: "View roles, permission assignments, and effective access.", category: "Administration and security", risk: "SENSITIVE" },
  { key: "roles.manage", name: "Manage roles", description: "Create, clone, edit, activate, deactivate, and delete roles.", category: "Administration and security", risk: "CRITICAL" },
  { key: "admin_users.view", name: "View admin users", description: "View administrative users and their role assignments.", category: "Administration and security", risk: "SENSITIVE" },
  { key: "admin_users.manage", name: "Manage admin users", description: "Assign roles and activate or deactivate administrative access.", category: "Administration and security", risk: "CRITICAL" },
  { key: "audit_logs.view", name: "View audit logs", description: "Review security and administrative activity history.", category: "Administration and security", risk: "SENSITIVE" }
] as const;

export type PermissionKey = (typeof permissionCatalog)[number]["key"];
export type PermissionRisk = (typeof permissionCatalog)[number]["risk"];

export const permissionDependencies: Partial<Record<PermissionKey, readonly PermissionKey[]>> = {
  "bookings.create": ["availability.view", "bookings.view"],
  "bookings.manage": ["bookings.view"],
  "bookings.reschedule": ["availability.view", "bookings.view", "bookings.manage", "payments.view"],
  "bookings.reschedule.override_adjustment": ["bookings.reschedule"],
  "bookings.reschedule.resolve_adjustment": ["bookings.reschedule"],
  "customers.view_full": ["customers.view_limited"],
  "payments.verify": ["payments.view"],
  "reports.export": ["reports.view"],
  "pricing.manage": ["pricing.view"],
  "roles.manage": ["roles.view"],
  "admin_users.manage": ["admin_users.view", "roles.view"]
};

export const protectedSuperAdminPermissions = permissionCatalog.map((permission) => permission.key);

const permissionKeys = new Set<string>(protectedSuperAdminPermissions);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeys.has(value);
}

export function expandPermissionDependencies(values: Iterable<PermissionKey>) {
  const expanded = new Set(values);
  let changed = true;

  while (changed) {
    changed = false;
    for (const permission of expanded) {
      for (const dependency of permissionDependencies[permission] ?? []) {
        if (!expanded.has(dependency)) {
          expanded.add(dependency);
          changed = true;
        }
      }
    }
  }

  return expanded;
}

export const seededRolePermissions = {
  SUPER_ADMIN: protectedSuperAdminPermissions,
  RECEPTIONIST: ["availability.view", "bookings.view", "bookings.create", "customers.view_limited"],
  BOOKING_ADMIN: [
    "availability.view",
    "bookings.view",
    "bookings.create",
    "bookings.manage",
    "bookings.reschedule",
    "bookings.reschedule.resolve_adjustment",
    "customers.view_full",
    "payments.view",
    "payments.verify",
    "reports.view",
    "reports.export"
  ],
  SOCIAL_MEDIA: ["facility_content.edit", "facility_photos.manage"]
} as const satisfies Record<string, readonly PermissionKey[]>;

export const permissionCategoryOrder = [
  "Bookings and availability",
  "Customers",
  "Payments",
  "Reports",
  "Facilities and content",
  "Pricing and holidays",
  "Administration and security"
] as const;
