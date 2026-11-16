import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "prisma/migrations/20260824090000_add_configurable_rbac/migration.sql"), "utf8");
const auditMigration = readFileSync(path.join(process.cwd(), "prisma/migrations/20260824100000_make_rbac_audit_append_only/migration.sql"), "utf8");

describe("RBAC migration safety controls", () => {
  it("backfills every legacy admin into the protected Super Admin role", () => {
    expect(migration).toContain("WHERE \"role\" = 'ADMIN'");
    expect(migration).toContain("'role_super_admin'");
    expect(migration).toContain("rbac.admin_migrated");
  });

  it("protects the recovery role, permissions, and last active Super Admin", () => {
    expect(migration).toContain("Role_protect_super_admin");
    expect(migration).toContain("RolePermission_protect_super_admin");
    expect(migration).toContain("UserRoleAssignment_protect_last_super_admin");
    expect(migration).toContain("User_protect_last_super_admin");
    expect(auditMigration).toContain("AuditLog_append_only");
  });

  it("prevents browser-facing Supabase roles from directly accessing security tables", () => {
    expect(migration).toContain("ALTER TABLE \"Role\" ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE \"AuditLog\" ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE \"Role\", \"Permission\", \"RolePermission\", \"UserRoleAssignment\", \"AuditLog\" FROM anon");
    expect(migration).toContain("FROM authenticated");
  });
});
