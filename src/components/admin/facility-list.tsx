import Image from "next/image";
import Link from "next/link";

import type { Facility, FacilityImage, PricingRule } from "@prisma/client";

type FacilityListItem = Pick<Facility, "id" | "name" | "type" | "isEnabled"> & {
  images: Pick<FacilityImage, "url">[];
  pricingRules: Pick<PricingRule, "amountMinor">[];
  blockedScheduleCount: number;
};

const facilityTypeLabels: Record<FacilityListItem["type"], string> = {
  BASKETBALL_WHOLE: "Whole basketball court",
  BASKETBALL_HALF: "Half basketball court",
  PICKLEBALL: "Pickleball court",
  BADMINTON: "Badminton court",
  OTHER: "Other facility"
};

export function FacilityList({ facilities, selectedFacilityId }: { facilities: FacilityListItem[]; selectedFacilityId?: string }) {
  return (
    <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Facilities</p>
          <p className="mt-1 text-sm text-stone-400">{facilities.length} bookable spaces</p>
        </div>
        <Link className="rounded-full bg-amber-300 px-3 py-2 text-xs font-semibold text-stone-950 transition hover:bg-amber-200" href="/admin/facilities?new=1">
          Add facility
        </Link>
      </div>
      <div className="mt-2 space-y-2">
        {facilities.length === 0 ? <p className="px-3 py-6 text-sm text-stone-400">No facilities yet.</p> : null}
        {facilities.map((facility) => {
          const isSelected = facility.id === selectedFacilityId;

          return (
            <Link
              key={facility.id}
              href={`/admin/facilities?facilityId=${facility.id}`}
              className={`flex items-center gap-3 rounded-2xl p-3 transition ${isSelected ? "bg-amber-300 text-stone-950" : "text-white hover:bg-white/10"}`}
            >
              <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-900">
                {facility.images[0] ? <Image src={facility.images[0].url} alt={`${facility.name} main image`} fill sizes="64px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{facility.name}</p>
                <p className={`mt-1 truncate text-xs ${isSelected ? "text-stone-900/70" : "text-stone-400"}`}>{facilityTypeLabels[facility.type]}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
                  <span className={isSelected ? "text-stone-900/70" : facility.isEnabled ? "text-emerald-300" : "text-stone-500"}>{facility.isEnabled ? "Enabled" : "Disabled"}</span>
                  {facility.blockedScheduleCount > 0 ? <span className={isSelected ? "text-stone-900/70" : "text-amber-300"}>{facility.blockedScheduleCount} blocks</span> : null}
                </div>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${isSelected ? "text-stone-950" : "text-stone-300"}`}>
                ₱{((facility.pricingRules[0]?.amountMinor ?? 0) / 100).toLocaleString("en-PH")}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
