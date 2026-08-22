import Image from "next/image";
import Link from "next/link";

import type { Facility, FacilityImage, PricingRule } from "@prisma/client";

type PricingFacility = Pick<Facility, "id" | "name" | "type" | "isEnabled"> & {
  images: Pick<FacilityImage, "url">[];
  pricingRules: Pick<PricingRule, "amountMinor">[];
};

const facilityTypeLabels: Record<PricingFacility["type"], string> = {
  BASKETBALL_WHOLE: "Whole basketball court",
  BASKETBALL_HALF: "Half basketball court",
  PICKLEBALL: "Pickleball court",
  BADMINTON: "Badminton court",
  OTHER: "Other facility"
};

export function PricingFacilityList({ facilities, selectedFacilityId, dateKey }: { facilities: PricingFacility[]; selectedFacilityId?: string; dateKey: string }) {
  return (
    <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-3">
      <div className="px-3 py-2">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Facilities</p>
        <p className="mt-1 text-sm text-stone-400">Select a facility to manage its rates.</p>
      </div>
      <div className="mt-2 space-y-2">
        {facilities.map((facility) => {
          const isSelected = facility.id === selectedFacilityId;

          return (
            <Link
              key={facility.id}
              href={`/admin/pricing?facilityId=${facility.id}&date=${dateKey}`}
              className={`flex items-center gap-3 rounded-2xl p-3 transition ${isSelected ? "bg-amber-300 text-stone-950" : "text-white hover:bg-white/10"}`}
            >
              <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-900">
                {facility.images[0] ? <Image src={facility.images[0].url} alt={`${facility.name} main image`} fill sizes="64px" className="object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{facility.name}</p>
                <p className={`mt-1 text-xs leading-tight ${isSelected ? "text-stone-900/70" : "text-stone-400"}`}>{facilityTypeLabels[facility.type]}</p>
                <p className={`mt-2 text-[10px] uppercase tracking-[0.12em] ${isSelected ? "text-stone-900/70" : facility.isEnabled ? "text-emerald-300" : "text-stone-500"}`}>{facility.isEnabled ? "Enabled" : "Disabled"}</p>
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
