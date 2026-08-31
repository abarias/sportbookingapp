"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { cloneRoleAction, deleteRoleAction, saveRoleAction, type RbacActionState } from "@/features/rbac/actions";
import { expandPermissionDependencies, permissionCategoryOrder, permissionDependencies, type PermissionKey } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

type PermissionOption = {
  key: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: string;
};

type EditableRole = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isProtected: boolean;
  isSystem: boolean;
  permissions: Array<{ permission: { key: string } }>;
  users: Array<{ user: { id: string; fullName: string; email: string; adminAccessActive: boolean } }>;
};

const initialState: RbacActionState = {};

function SubmitButton({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "danger" | "secondary" }) {
  const { pending } = useFormStatus();
  const className = tone === "danger" ? "bg-rose-500 text-white hover:bg-rose-400" : tone === "secondary" ? "bg-white/10 text-white hover:bg-white/15" : "";
  return <Button className={className} disabled={pending} type="submit">{pending ? "Working..." : children}</Button>;
}

function ResultMessage({ state }: { state: RbacActionState }) {
  if (state.error) return <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100">{state.error}</p>;
  if (state.success) return <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">{state.success}</p>;
  return null;
}

export function RoleEditor({ role, permissions }: { role: EditableRole | null; permissions: PermissionOption[] }) {
  const router = useRouter();
  const [saveState, saveAction] = useActionState(saveRoleAction, initialState);
  const [cloneState, cloneAction] = useActionState(cloneRoleAction, initialState);
  const [deleteState, deleteAction] = useActionState(deleteRoleAction, initialState);
  const selectedKeys = new Set(role?.permissions.map((item) => item.permission.key) ?? []);
  const [requestedKeys, setRequestedKeys] = useState<PermissionKey[]>(() => [...selectedKeys].filter((key): key is PermissionKey => permissions.some((permission) => permission.key === key)));
  const resultingKeys = expandPermissionDependencies(requestedKeys);
  useEffect(() => {
    if (saveState.success) router.refresh();
  }, [router, saveState.success]);

  return (
    <div className="space-y-5">
      <form action={saveAction} className="space-y-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <input name="roleId" type="hidden" value={role?.id ?? ""} />
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-300">{role ? "Edit role" : "New role"}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{role?.name ?? "Create a custom role"}</h2>
          {role?.isProtected ? <p className="mt-2 text-sm text-amber-100">This recovery role is protected. Its name, status, and permissions cannot be changed.</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-stone-200">
            <span>Role name</span>
            <input className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-white disabled:opacity-60" defaultValue={role?.name ?? ""} disabled={role?.isProtected} maxLength={80} name="name" required />
          </label>
          <label className="flex items-center gap-3 self-end rounded-2xl border border-white/10 bg-stone-950/40 p-3 text-sm text-stone-200">
            <input defaultChecked={role?.isActive ?? true} disabled={role?.isProtected} name="isActive" type="checkbox" />
            Active role
          </label>
          <label className="space-y-2 text-sm text-stone-200 md:col-span-2">
            <span>Description</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-white disabled:opacity-60" defaultValue={role?.description ?? ""} disabled={role?.isProtected} maxLength={500} name="description" required />
          </label>
        </div>

        <section className="space-y-5">
          <div>
            <h3 className="font-semibold text-white">Permission assignment</h3>
            <p className="mt-1 text-sm text-stone-400">Prerequisite permissions are included automatically when the role is saved. Sensitive access is marked for review.</p>
          </div>
          {permissionCategoryOrder.map((category) => {
            const categoryPermissions = permissions.filter((permission) => permission.category === category);
            if (!categoryPermissions.length) return null;
            return (
              <fieldset key={category} className="space-y-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4" disabled={role?.isProtected}>
                <legend className="px-2 text-sm font-semibold text-white">{category}</legend>
                <div className="grid gap-3 lg:grid-cols-2">
                  {categoryPermissions.map((permission) => {
                    const dependencies = permissionDependencies[permission.key as PermissionKey] ?? [];
                    return (
                      <label key={permission.key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                        <input className="mt-1" checked={requestedKeys.includes(permission.key as PermissionKey)} name="permissionKeys" onChange={(event) => setRequestedKeys((current) => event.target.checked ? [...current, permission.key as PermissionKey] : current.filter((key) => key !== permission.key))} type="checkbox" value={permission.key} />
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-medium text-white">
                            {permission.displayName}
                            {permission.riskLevel !== "STANDARD" ? <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">{permission.riskLevel}</span> : null}
                          </span>
                          <span className="mt-1 block text-stone-400">{permission.description}</span>
                          {dependencies.length ? <span className="mt-1 block text-xs text-stone-500">Includes: {dependencies.join(", ")}</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </section>
        {!role?.isProtected ? <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">Review: {requestedKeys.length} selected permissions become {resultingKeys.size} effective role permissions after prerequisites are included.</p> : null}
        <ResultMessage state={saveState} />
        {!role?.isProtected ? <div className="flex justify-end"><SubmitButton>{role ? "Save role" : "Create role"}</SubmitButton></div> : null}
      </form>

      {role ? (
        <><section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
          <h3 className="font-semibold text-white">Assigned users</h3>
          <div className="mt-3 space-y-2 text-sm text-stone-300">
            {role.users.length ? role.users.map((assignment) => <p key={assignment.user.id}>{assignment.user.fullName} · {assignment.user.email} · {assignment.user.adminAccessActive ? "Active" : "Access disabled"}</p>) : <p className="text-stone-400">No users are assigned to this role.</p>}
          </div>
        </section><div className="grid gap-4 sm:grid-cols-2">
          <form action={cloneAction} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input name="roleId" type="hidden" value={role.id} />
            <p className="text-sm text-stone-300">Create an editable custom role with the same permissions.</p>
            <ResultMessage state={cloneState} />
            <SubmitButton tone="secondary">Clone role</SubmitButton>
          </form>
          {!role.isSystem ? (
            <form action={deleteAction} className="space-y-3 rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4" onSubmit={(event) => { if (!window.confirm(`Delete ${role.name}? This cannot be undone.`)) event.preventDefault(); }}>
              <input name="roleId" type="hidden" value={role.id} />
              <p className="text-sm text-stone-300">Only unused custom roles can be deleted.</p>
              <ResultMessage state={deleteState} />
              <SubmitButton tone="danger">Delete role</SubmitButton>
            </form>
          ) : null}
        </div></>
      ) : null}
    </div>
  );
}
