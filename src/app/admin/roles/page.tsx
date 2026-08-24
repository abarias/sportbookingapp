import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { RoleEditor } from "@/components/admin/role-editor";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { getRoleManagementData } from "@/server/rbac/queries";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage({ searchParams }: { searchParams: Promise<{ roleId?: string; new?: string }> }) {
  await requirePermission("roles.view");
  const params = await searchParams;
  const { roles, permissions } = await getRoleManagementData();
  const selectedRole = params.new === "1" ? null : roles.find((role) => role.id === params.roleId) ?? roles[0] ?? null;

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin security" title="Roles and permissions" description="Build explainable administrative access from stable application permissions." />
      <AdminNav current="roles" />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="self-start rounded-[1.75rem] border border-white/10 bg-white/5 p-4 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3 px-2 pb-3">
            <h2 className="font-semibold text-white">Roles</h2>
            <Link className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-stone-950" href="/admin/roles?new=1">New role</Link>
          </div>
          <div className="space-y-2">
            {roles.map((role) => (
              <Link key={role.id} href={`/admin/roles?roleId=${role.id}`} className={`block rounded-2xl border p-3 text-sm transition ${selectedRole?.id === role.id ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-stone-950/40 hover:bg-white/10"}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-medium text-white">{role.name}</span><span className={`text-xs ${role.isActive ? "text-emerald-300" : "text-stone-500"}`}>{role.isActive ? "Active" : "Inactive"}</span></div>
                <p className="mt-1 line-clamp-2 text-stone-400">{role.description}</p>
                <p className="mt-2 text-xs text-stone-500">{role._count.users} users · {role._count.permissions} permissions · {role.isSystem ? "System template" : "Custom"}</p>
                <p className="mt-1 text-xs text-stone-600">Updated {role.updatedAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}{role.updatedBy ? ` by ${role.updatedBy.fullName}` : ""}</p>
              </Link>
            ))}
          </div>
        </aside>
        <RoleEditor key={selectedRole?.id ?? "new"} role={selectedRole} permissions={permissions} />
      </div>
    </main>
  );
}
