import { AdminNav } from "@/components/admin/admin-nav";
import { BlockScheduleForm } from "@/components/admin/block-schedule-form";
import { DeleteBlockScheduleButton } from "@/components/admin/delete-block-schedule-button";
import { FacilityCreateForm } from "@/components/admin/facility-create-form";
import { FacilityForm } from "@/components/admin/facility-form";
import { FacilityList } from "@/components/admin/facility-list";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { formatDateTimeRange } from "@/lib/time/slots";
import { getAdminFacilitiesData } from "@/server/admin/queries";

export const dynamic = "force-dynamic";

type AdminFacilitiesPageProps = {
  searchParams: Promise<{
    facilityId?: string;
    new?: string;
    created?: string;
  }>;
};

export default async function AdminFacilitiesPage({ searchParams }: AdminFacilitiesPageProps) {
  await requireAdminSession();
  const params = await searchParams;
  const { facilities, blocks, cancellationEnabled } = await getAdminFacilitiesData();
  const selectedFacility = facilities.find((facility) => facility.id === params.facilityId) ?? (params.new === "1" ? null : facilities[0]);
  const selectedBlocks = selectedFacility ? blocks.filter((block) => block.facilityId === selectedFacility.id) : [];

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Facility management"
        description="Select a facility to manage its details, images, operating hours, pricing, and blocked schedules."
      />
      <AdminNav current="facilities" />
      <section className="rounded-2xl border border-amber-400/15 bg-amber-400/10 p-4 text-sm text-amber-100">
        Global cancellation is currently {cancellationEnabled ? "enabled" : "disabled"}. Facility-specific settings can inherit or override it.
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <FacilityList
          facilities={facilities.map((facility) => ({
            id: facility.id,
            name: facility.name,
            type: facility.type,
            isEnabled: facility.isEnabled,
            images: facility.images,
            pricingRules: facility.pricingRules,
            blockedScheduleCount: blocks.filter((block) => block.facilityId === facility.id).length
          }))}
          selectedFacilityId={selectedFacility?.id}
        />

        <section className="min-w-0 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 sm:p-6">
          {params.new === "1" ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">New facility</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Add a facility</h2>
                <p className="mt-1 text-sm text-stone-400">Create the facility first, then manage its images, hours, pricing, and blocks from the same workspace.</p>
              </div>
              <FacilityCreateForm />
            </div>
          ) : selectedFacility ? (
            <div className="space-y-8">
              {params.created === "1" ? <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">Facility added successfully. You can now finish configuring its images, hours, pricing, and blocked schedules below.</p> : null}
              <FacilityForm key={selectedFacility.id} facility={selectedFacility} />

              <section className="space-y-5 border-t border-white/10 pt-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Availability controls</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Blocked schedules</h2>
                  <p className="mt-1 text-sm text-stone-400">Block this facility for maintenance, private events, or other exceptions.</p>
                </div>
                <BlockScheduleForm facilities={[selectedFacility]} facilityId={selectedFacility.id} />
                <div className="space-y-3">
                  {selectedBlocks.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-stone-400">No blocked schedules for this facility.</p> : null}
                  {selectedBlocks.map((block) => (
                    <article key={block.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-stone-950/40 p-4 text-sm text-stone-300 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{block.title}</p>
                        <p className="mt-1">{formatDateTimeRange(block.startAtUtc, block.endAtUtc, block.facility.timezone ?? "Asia/Manila")}</p>
                        {block.reason ? <p className="mt-1 text-stone-400">{block.reason}</p> : null}
                      </div>
                      <DeleteBlockScheduleButton blockId={block.id} />
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="flex min-h-96 items-center justify-center rounded-2xl border border-dashed border-white/15 p-6 text-center">
              <div>
                <h2 className="text-xl font-semibold text-white">No facility selected</h2>
                <p className="mt-2 text-sm text-stone-400">Choose a facility from the list or add a new one.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
