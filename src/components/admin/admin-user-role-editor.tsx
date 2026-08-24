"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { saveAdminUserRolesAction, type RbacActionState } from "@/features/rbac/actions";
import { Button } from "@/components/ui/button";

type RoleOption = { id: string; name: string; description: string; isProtected: boolean; permissions: Array<{ permission: { key: string; displayName: string; category: string } }> };
type UserAccess = {
  id: string;
  fullName: string;
  email: string;
  adminAccessActive: boolean;
  roleAssignments: Array<{ roleId: string; assignedAt: Date; role: { name: string }; assignedBy: { fullName: string } | null }>;
};
type PermissionProvenance = { key: string; displayName: string; category: string; roles: string[] };
type AccessHistory = { id: string; action: string; createdAt: Date; details: string; actor: { fullName: string } | null };

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit">{pending ? "Saving..." : "Save administrative access"}</Button>;
}

export function AdminUserRoleEditor({ user, roles, effectivePermissions, accessHistory, isCurrentUser }: { user: UserAccess; roles: RoleOption[]; effectivePermissions: PermissionProvenance[]; accessHistory: AccessHistory[]; isCurrentUser: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState(saveAdminUserRolesAction, {} as RbacActionState);
  const assignedRoleIds = new Set(user.roleAssignments.map((assignment) => assignment.roleId));
  const [selectedRoleIds, setSelectedRoleIds] = useState(() => [...assignedRoleIds]);
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  const previewPermissions = new Map<string, PermissionProvenance>();
  for (const role of roles.filter((option) => selectedRoleIds.includes(option.id))) {
    for (const item of role.permissions) {
      const current = previewPermissions.get(item.permission.key) ?? { key: item.permission.key, displayName: item.permission.displayName, category: item.permission.category, roles: [] };
      current.roles.push(role.name);
      previewPermissions.set(item.permission.key, current);
    }
  }
  const resultingPermissions = [...previewPermissions.values()].sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <input name="userId" type="hidden" value={user.id} />
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Administrative access</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{user.fullName}</h2>
          <p className="mt-1 text-sm text-stone-400">{user.email}</p>
        </div>
        {isCurrentUser ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Your own assignments are read-only here to prevent accidental lockout. Another Super Admin must change them.</p> : null}
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-white">
          <input defaultChecked={user.adminAccessActive} disabled={isCurrentUser} name="adminAccessActive" type="checkbox" />
          Administrative access active
        </label>
        <fieldset className="space-y-3" disabled={isCurrentUser}>
          <legend className="mb-2 font-semibold text-white">Assigned roles</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm">
                <input className="mt-1" checked={selectedRoleIds.includes(role.id)} name="roleIds" onChange={(event) => setSelectedRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} type="checkbox" value={role.id} />
                <span><span className="font-medium text-white">{role.name}</span>{role.isProtected ? <span className="ml-2 text-xs text-amber-300">Protected</span> : null}<span className="mt-1 block text-stone-400">{role.description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        {state.error ? <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">{state.error}</p> : null}
        {state.success ? <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">{state.success}</p> : null}
        {!isCurrentUser ? <div className="flex justify-end"><SaveButton /></div> : null}
      </form>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <h3 className="font-semibold text-white">Resulting effective permissions</h3>
        <p className="mt-1 text-sm text-stone-400">Live preview of the selected role union. Each row identifies its source.</p>
        <div className="mt-4 space-y-2">
          {resultingPermissions.length ? resultingPermissions.map((permission) => (
            <div key={permission.key} className="grid gap-1 rounded-2xl border border-white/10 bg-stone-950/40 p-3 text-sm md:grid-cols-[1fr_1fr]">
              <div><p className="font-medium text-white">{permission.displayName}</p><p className="text-xs text-stone-500">{permission.key}</p></div>
              <p className="text-stone-300">From: {permission.roles.join(", ")}</p>
            </div>
          )) : <p className="text-sm text-stone-400">No effective permissions.</p>}
        </div>
        {effectivePermissions.length !== resultingPermissions.length ? <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">The selected roles change this user&apos;s effective permission count from {effectivePermissions.length} to {resultingPermissions.length}. Review before saving.</p> : null}
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <h3 className="font-semibold text-white">Assignment history</h3>
        <div className="mt-4 space-y-2 text-sm text-stone-300">
          {accessHistory.length ? accessHistory.map((entry) => <div key={entry.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-3"><p className="font-medium capitalize text-white">{entry.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-stone-500">{new Date(entry.createdAt).toLocaleString()} · {entry.actor?.fullName ?? "System"}</p><p className="mt-2 text-sm leading-6 text-stone-300">{entry.details}</p></div>) : user.roleAssignments.length ? user.roleAssignments.map((assignment) => <p key={assignment.roleId}>{assignment.role.name} assigned {new Date(assignment.assignedAt).toLocaleString()} by {assignment.assignedBy?.fullName ?? "system migration"}</p>) : <p className="text-stone-400">No role-assignment history.</p>}
        </div>
      </section>
    </div>
  );
}
