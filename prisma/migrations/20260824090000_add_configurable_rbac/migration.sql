-- Additive RBAC rollout. User.role remains as a compatibility/admin-account flag;
-- effective authorization is derived from active role assignments.
ALTER TABLE "User" ADD COLUMN "adminAccessActive" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "adminAccessActive" = true WHERE "role" = 'ADMIN';

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "systemKey" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isProtected" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL DEFAULT 'STANDARD',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "UserRoleAssignment" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_systemKey_key" ON "Role"("systemKey");
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE INDEX "Role_isActive_idx" ON "Role"("isActive");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "Permission_category_isActive_idx" ON "Permission"("category", "isActive");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");
CREATE INDEX "UserRoleAssignment_assignedByUserId_idx" ON "UserRoleAssignment"("assignedByUserId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

ALTER TABLE "Role" ADD CONSTRAINT "Role_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Role" ADD CONSTRAINT "Role_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "displayName", "description", "category", "riskLevel", "updatedAt") VALUES
('perm_availability_view', 'availability.view', 'View availability', 'View facility schedules, blocked periods, and slot availability.', 'Bookings and availability', 'STANDARD', CURRENT_TIMESTAMP),
('perm_bookings_view', 'bookings.view', 'View bookings', 'View booking records and operational booking status.', 'Bookings and availability', 'STANDARD', CURRENT_TIMESTAMP),
('perm_bookings_create', 'bookings.create', 'Create bookings', 'Create manual and walk-in bookings.', 'Bookings and availability', 'ELEVATED', CURRENT_TIMESTAMP),
('perm_bookings_manage', 'bookings.manage', 'Manage bookings', 'Perform ordinary administrative booking operations.', 'Bookings and availability', 'ELEVATED', CURRENT_TIMESTAMP),
('perm_bookings_reschedule', 'bookings.reschedule', 'Reschedule bookings', 'Move paid or confirmed bookings to another schedule.', 'Bookings and availability', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_customers_limited', 'customers.view_limited', 'View limited customer details', 'View only customer details required to service an active booking.', 'Customers', 'STANDARD', CURRENT_TIMESTAMP),
('perm_customers_full', 'customers.view_full', 'View full customer records', 'View customer contact details and booking history.', 'Customers', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_payments_view', 'payments.view', 'View payments', 'View payment submissions and proof details.', 'Payments', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_payments_verify', 'payments.verify', 'Verify payments', 'Confirm, reject, or request action on submitted payments.', 'Payments', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_reports_view', 'reports.view', 'View reports', 'View booking, revenue, and utilization reports.', 'Reports', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_reports_export', 'reports.export', 'Export reports', 'Export operational or financial report data.', 'Reports', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_facility_content_edit', 'facility_content.edit', 'Edit facility content', 'Edit approved customer-facing facility names and descriptions.', 'Facilities and content', 'STANDARD', CURRENT_TIMESTAMP),
('perm_facility_photos_manage', 'facility_photos.manage', 'Manage facility photos', 'Upload, replace, reorder, and remove facility photos.', 'Facilities and content', 'ELEVATED', CURRENT_TIMESTAMP),
('perm_facilities_manage', 'facilities.manage', 'Manage facility operations', 'Manage facilities, operating hours, availability, policies, and blocked schedules.', 'Facilities and content', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_pricing_view', 'pricing.view', 'View pricing', 'View pricing rules and administrative rate previews.', 'Pricing and holidays', 'STANDARD', CURRENT_TIMESTAMP),
('perm_pricing_manage', 'pricing.manage', 'Manage pricing', 'Create and modify facility pricing rules and fallback rates.', 'Pricing and holidays', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_holidays_manage', 'holidays.manage', 'Manage holidays', 'Create and modify holiday calendars used by pricing.', 'Pricing and holidays', 'ELEVATED', CURRENT_TIMESTAMP),
('perm_roles_view', 'roles.view', 'View roles', 'View roles, permission assignments, and effective access.', 'Administration and security', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_roles_manage', 'roles.manage', 'Manage roles', 'Create, clone, edit, activate, deactivate, and delete roles.', 'Administration and security', 'CRITICAL', CURRENT_TIMESTAMP),
('perm_admin_users_view', 'admin_users.view', 'View admin users', 'View administrative users and their role assignments.', 'Administration and security', 'SENSITIVE', CURRENT_TIMESTAMP),
('perm_admin_users_manage', 'admin_users.manage', 'Manage admin users', 'Assign roles and activate or deactivate administrative access.', 'Administration and security', 'CRITICAL', CURRENT_TIMESTAMP),
('perm_audit_logs_view', 'audit_logs.view', 'View audit logs', 'Review security and administrative activity history.', 'Administration and security', 'SENSITIVE', CURRENT_TIMESTAMP);

INSERT INTO "Role" ("id", "systemKey", "name", "description", "isSystem", "isProtected", "isActive", "updatedAt") VALUES
('role_super_admin', 'SUPER_ADMIN', 'Super Admin', 'Protected recovery role with every application permission.', true, true, true, CURRENT_TIMESTAMP),
('role_receptionist', 'RECEPTIONIST', 'Receptionist', 'Front-desk availability, limited customer lookup, and walk-in booking access.', true, false, true, CURRENT_TIMESTAMP),
('role_booking_admin', 'BOOKING_ADMIN', 'Booking Admin', 'Booking, customer, payment, and reporting administration.', true, false, true, CURRENT_TIMESTAMP),
('role_social_media', 'SOCIAL_MEDIA', 'Social Media Person', 'Customer-facing facility wording and photo management.', true, false, true, CURRENT_TIMESTAMP);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_super_admin', "id" FROM "Permission";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_receptionist', "id" FROM "Permission" WHERE "key" IN (
  'availability.view', 'bookings.view', 'bookings.create', 'customers.view_limited'
);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_booking_admin', "id" FROM "Permission" WHERE "key" IN (
  'availability.view', 'bookings.view', 'bookings.create', 'bookings.manage',
  'bookings.reschedule', 'customers.view_full', 'payments.view', 'payments.verify',
  'reports.view', 'reports.export'
);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'role_social_media', "id" FROM "Permission" WHERE "key" IN (
  'facility_content.edit', 'facility_photos.manage'
);

INSERT INTO "UserRoleAssignment" ("userId", "roleId", "assignedByUserId")
SELECT "id", 'role_super_admin', "id" FROM "User" WHERE "role" = 'ADMIN';

INSERT INTO "AuditLog" ("id", "actorUserId", "action", "entityType", "entityId", "after", "metadata")
SELECT 'audit_rbac_migration_' || "id", NULL, 'rbac.admin_migrated', 'User', "id",
  jsonb_build_object('roleId', 'role_super_admin', 'adminAccessActive', true),
  jsonb_build_object('source', '20260824090000_add_configurable_rbac')
FROM "User" WHERE "role" = 'ADMIN';

CREATE OR REPLACE FUNCTION protect_super_admin_role() RETURNS trigger AS $$
BEGIN
  IF OLD."systemKey" = 'SUPER_ADMIN' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'The protected Super Admin role cannot be deleted.';
    END IF;
    IF NEW."systemKey" IS DISTINCT FROM OLD."systemKey"
      OR NEW."isProtected" IS DISTINCT FROM true
      OR NEW."isSystem" IS DISTINCT FROM true
      OR NEW."isActive" IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Protected Super Admin role properties cannot be changed.';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Role_protect_super_admin"
BEFORE UPDATE OR DELETE ON "Role"
FOR EACH ROW EXECUTE FUNCTION protect_super_admin_role();

CREATE OR REPLACE FUNCTION protect_super_admin_permissions() RETURNS trigger AS $$
BEGIN
  IF OLD."roleId" = 'role_super_admin' AND (TG_OP = 'DELETE' OR NEW."roleId" IS DISTINCT FROM OLD."roleId" OR NEW."permissionId" IS DISTINCT FROM OLD."permissionId") THEN
    RAISE EXCEPTION 'Permissions cannot be removed from the protected Super Admin role.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RolePermission_protect_super_admin"
BEFORE UPDATE OR DELETE ON "RolePermission"
FOR EACH ROW EXECUTE FUNCTION protect_super_admin_permissions();

CREATE OR REPLACE FUNCTION validate_active_role_assignment() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Role" WHERE "id" = NEW."roleId" AND "isActive" = true) THEN
    RAISE EXCEPTION 'Inactive roles cannot be assigned.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UserRoleAssignment_require_active_role"
BEFORE INSERT OR UPDATE ON "UserRoleAssignment"
FOR EACH ROW EXECUTE FUNCTION validate_active_role_assignment();

CREATE OR REPLACE FUNCTION prevent_last_super_admin_assignment_removal() RETURNS trigger AS $$
DECLARE active_count INTEGER;
BEGIN
  IF OLD."roleId" = 'role_super_admin' AND (TG_OP = 'DELETE' OR NEW."roleId" IS DISTINCT FROM OLD."roleId") THEN
    SELECT COUNT(*) INTO active_count
    FROM "UserRoleAssignment" ura
    JOIN "User" u ON u."id" = ura."userId"
    WHERE ura."roleId" = 'role_super_admin'
      AND ura."userId" <> OLD."userId"
      AND u."adminAccessActive" = true
      AND u."role" = 'ADMIN';
    IF active_count = 0 THEN
      RAISE EXCEPTION 'The last active Super Admin assignment cannot be removed.';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UserRoleAssignment_protect_last_super_admin"
BEFORE UPDATE OR DELETE ON "UserRoleAssignment"
FOR EACH ROW EXECUTE FUNCTION prevent_last_super_admin_assignment_removal();

CREATE OR REPLACE FUNCTION prevent_last_super_admin_deactivation() RETURNS trigger AS $$
DECLARE active_count INTEGER;
BEGIN
  IF OLD."adminAccessActive" = true AND (NEW."adminAccessActive" = false OR NEW."role" <> 'ADMIN')
    AND EXISTS (SELECT 1 FROM "UserRoleAssignment" WHERE "userId" = OLD."id" AND "roleId" = 'role_super_admin') THEN
    SELECT COUNT(*) INTO active_count
    FROM "UserRoleAssignment" ura
    JOIN "User" u ON u."id" = ura."userId"
    WHERE ura."roleId" = 'role_super_admin'
      AND ura."userId" <> OLD."id"
      AND u."adminAccessActive" = true
      AND u."role" = 'ADMIN';
    IF active_count = 0 THEN
      RAISE EXCEPTION 'The last active Super Admin cannot be deactivated.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_protect_last_super_admin"
BEFORE UPDATE OF "adminAccessActive", "role" ON "User"
FOR EACH ROW EXECUTE FUNCTION prevent_last_super_admin_deactivation();

-- Prisma uses the database connection role. Supabase browser roles must not
-- access RBAC or audit tables directly if the Data API is enabled.
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Role", "Permission", "RolePermission", "UserRoleAssignment", "AuditLog" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Role", "Permission", "RolePermission", "UserRoleAssignment", "AuditLog" FROM authenticated;
  END IF;
END $$;
