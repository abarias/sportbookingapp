import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUserRoleEditor } from "@/components/admin/admin-user-role-editor";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { effectivePermissionProvenance, getAdminUserAccessHistory, getAdminUserManagementData } from "@/server/rbac/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInteger(value, PAGE_SIZE_OPTIONS[0]);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : PAGE_SIZE_OPTIONS[0];
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ userId?: string; search?: string; page?: string; pageSize?: string }> }) {
  const authorization = await requirePermission("admin_users.view");
  const params = await searchParams;
  const page = parsePositiveInteger(params.page, 1);
  const pageSize = parsePageSize(params.pageSize);
  const search = params.search?.trim() ?? "";
  const { users, roles, totalCount } = await getAdminUserManagementData({ includeCustomerCandidates: authorization.permissions.has("customers.view_full"), page, pageSize, search });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) redirect(`/admin/admin-users?page=${totalPages}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
  const selectedUser = users.find((user) => user.id === params.userId) ?? users.find((user) => user.role === "ADMIN") ?? users[0];
  const accessHistory = selectedUser ? await getAdminUserAccessHistory(selectedUser.id) : [];

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin security" title="Administrative users" description="Assign one or more roles, review effective access, and deactivate administrative entry safely." />
      <AdminNav current="admin-users" />
      <form className="flex flex-col gap-3 sm:flex-row" method="get">
        <input className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white" defaultValue={search} name="search" placeholder="Search name, email, or mobile number" />
        <button className="h-11 rounded-full bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/15" type="submit">Search users</button>
      </form>
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="self-start rounded-[1.75rem] border border-white/10 bg-white/5 p-4 xl:sticky xl:top-24">
          <h2 className="px-2 pb-3 font-semibold text-white">User accounts</h2>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {users.map((user) => (
              <Link key={user.id} href={`/admin/admin-users?userId=${user.id}`} className={`block rounded-2xl border p-3 text-sm ${selectedUser?.id === user.id ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-stone-950/40 hover:bg-white/10"}`}>
                <div className="flex justify-between gap-2"><span className="font-medium text-white">{user.fullName}</span><span className={user.adminAccessActive ? "text-emerald-300" : "text-stone-500"}>{user.adminAccessActive ? "Active" : "No access"}</span></div>
                <p className="mt-1 truncate text-stone-400">{user.email}</p>
                <p className="mt-2 text-xs text-stone-500">{user.roleAssignments.map((assignment) => assignment.role.name).join(", ") || "No roles"}</p>
              </Link>
            ))}
          </div>
          <AdminPagination basePath="/admin/admin-users" page={page} pageSize={pageSize} totalCount={totalCount} />
        </aside>
        {selectedUser ? <AdminUserRoleEditor key={selectedUser.id} user={selectedUser} roles={roles} effectivePermissions={effectivePermissionProvenance(selectedUser)} accessHistory={accessHistory} isCurrentUser={selectedUser.id === authorization.session.user.id} /> : <p className="text-stone-400">No user accounts found.</p>}
      </div>
    </main>
  );
}
