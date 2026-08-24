import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { SectionHeading } from "@/components/shared/section-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { getAuditLogData } from "@/server/rbac/queries";
import { redirect } from "next/navigation";

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

export default async function AdminAuditLogsPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string; pageSize?: string }> }) {
  await requirePermission("audit_logs.view");
  const params = await searchParams;
  const page = parsePositiveInteger(params.page, 1);
  const pageSize = parsePageSize(params.pageSize);
  const search = params.search?.trim() ?? "";
  const { logs, totalCount } = await getAuditLogData({ page, pageSize, search });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages) redirect(`/admin/audit-logs?page=${totalPages}&pageSize=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`);

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Admin security" title="Audit log" description="Recent security and administrative changes with actor and affected record context." />
      <AdminNav current="audit-logs" />
      <form className="flex flex-col gap-3 sm:flex-row" method="get">
        <input className="h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white" defaultValue={search} name="search" placeholder="Search actor, user, action, target, or record" />
        <button className="h-11 rounded-full bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/15" type="submit">Search audit log</button>
      </form>
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-stone-950/50 text-stone-400"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {logs.map((log) => (
                <tr key={log.id} className="text-stone-300">
                  <td className="whitespace-nowrap px-4 py-3">{log.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
                  <td className="px-4 py-3">{log.actor?.fullName ?? "System"}<span className="block text-xs text-stone-500">{log.actor?.email}</span></td>
                  <td className="px-4 py-3 font-medium text-white">{log.action}</td>
                  <td className="px-4 py-3">{log.targetLabel}</td>
                  <td className="max-w-md px-4 py-3 text-xs leading-5 text-stone-400">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination basePath="/admin/audit-logs" page={page} pageSize={pageSize} totalCount={totalCount} />
        {!logs.length ? <p className="p-6 text-sm text-stone-400">No audit events recorded yet.</p> : null}
      </section>
    </main>
  );
}
