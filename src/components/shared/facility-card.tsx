import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { FacilityCardViewModel } from "@/features/facilities/types";
import { formatCurrency } from "@/lib/formatting/currency";

type FacilityCardProps = {
  facility: FacilityCardViewModel;
};

export function FacilityCard({ facility }: FacilityCardProps) {
  const coverImage = facility.images[0];

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5">
      {coverImage ? (
        <div className="relative aspect-[4/3]">
          <Image src={coverImage.url} alt={coverImage.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-stone-900/80 text-sm text-stone-400">No image</div>
      )}
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <p className="text-sm text-amber-300">{facility.typeLabel}</p>
          <h2 className="text-xl font-semibold text-white">{facility.name}</h2>
          <p className="text-sm leading-6 text-stone-300">{facility.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Starting at</p>
            <p className="text-lg font-semibold text-white">
              {formatCurrency(facility.price.amountMinor, facility.price.currency)}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/facilities/${facility.slug}`}>View</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
