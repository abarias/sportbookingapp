import { AdminNav } from "@/components/admin/admin-nav";
import { BlockScheduleForm } from "@/components/admin/block-schedule-form";
import { DeleteBlockScheduleButton } from "@/components/admin/delete-block-schedule-button";
import { FacilityCreateForm } from "@/components/admin/facility-create-form";
import { FacilityForm } from "@/components/admin/facility-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminFacilitiesData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminFacilitiesPage() {
  await requireAdminSession();
  const { facilities, blocks, cancellationEnabled } = await getAdminFacilitiesData();

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Facility management"
        description="Manage pricing, operating hours, image URLs, enabled state, cancellation behavior, and maintenance blocks."
      />
      <AdminNav current="facilities" />
      <section className="rounded-[1.75rem] border border-amber-400/15 bg-amber-400/10 p-4 text-sm text-amber-100">
        Global cancellation is currently {cancellationEnabled ? "enabled" : "disabled"}. Individual facilities can inherit or override it below.
      </section>
      <FacilityCreateForm />
      <BlockScheduleForm facilities={facilities} />
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Upcoming blocked schedules</h2>
        <div className="mt-4 space-y-4">
          {blocks.length === 0 ? <p className="text-sm text-stone-400">No blocked schedules yet.</p> : null}
          {blocks.map((block) => (
            <article key={block.id} className="rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium text-white">{block.facility.name} • {block.title}</p>
                  <p className="mt-1">{formatDateTimeRange(block.startAtUtc, block.endAtUtc, block.facility.timezone ?? "Asia/Manila")}</p>
                  <p className="mt-1">Created by {block.createdBy.fullName}</p>
                  {block.reason ? <p className="mt-1 text-stone-400">{block.reason}</p> : null}
                </div>
                <DeleteBlockScheduleButton blockId={block.id} />
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="grid gap-6">
        {facilities.map((facility) => (
          <FacilityForm key={facility.id} facility={facility} />
        ))}
      </div>
    </main>
  );
}
