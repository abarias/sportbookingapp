import { FacilityCard } from "@/components/shared/facility-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { getFacilityCards } from "@/server/facilities/queries";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const facilities = await getFacilityCards();

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Browse"
        title="Available facilities"
        description="Browse live facility inventory from PostgreSQL and drill into date-based availability for each court."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {facilities.map((facility) => (
          <FacilityCard key={facility.id} facility={facility} />
        ))}
      </div>
    </main>
  );
}
