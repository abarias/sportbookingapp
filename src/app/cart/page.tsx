import Image from "next/image";
import Link from "next/link";

import { CartSummaryActions, RemoveCartItemButton } from "@/components/cart/cart-actions";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { requireUserSession } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/formatting/currency";
import { formatDateTimeRange, getLocalMinutesForDate, minutesToTimeLabel } from "@/lib/time/slots";
import { getActiveCart } from "@/server/cart/service";

export const dynamic = "force-dynamic";

type CartPageProps = { searchParams: Promise<{ added?: string; updated?: string }> };

export default async function CartPage({ searchParams }: CartPageProps) {
  const session = await requireUserSession();
  const [cart, query] = await Promise.all([getActiveCart(session.user.id), searchParams]);
  const items = cart?.items ?? [];
  const hasUnavailableItems = items.some((item) => item.availability === "UNAVAILABLE");
  const hasPriceChanges = items.some((item) => item.priceChanged);
  const currentAmountMinor = items.reduce((sum, item) => sum + item.currentAmountMinor, 0);

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading eyebrow="Your cart" title="Build one checkout across multiple facilities." description="Review every schedule before one consolidated payment. Cart items do not reserve inventory." />
      {query.added === "1" ? <p aria-live="polite" className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">Schedule added to your cart.</p> : null}
      {query.updated === "1" ? <p aria-live="polite" className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">Cart schedule updated.</p> : null}

      {items.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <h2 className="font-serif text-3xl text-white">Your cart is empty</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-300">Choose available hourly schedules from one or more facilities. Nothing is held until consolidated checkout.</p>
          <Button asChild className="mt-6"><Link href="/facilities">Browse facilities</Link></Button>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4" aria-label="Cart schedules">
            {items.map((item) => {
              const image = item.facility.images[0];
              const price = item.currentPrice;
              return (
                <article key={item.id} className="grid min-w-0 gap-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-2xl bg-stone-900">
                    {image ? <Image alt={image.altText} className="aspect-[4/3] h-full w-full object-cover" height={240} src={image.url} unoptimized={image.url.startsWith("/facility_photos/")} width={320} /> : <div className="grid aspect-[4/3] place-items-center text-xs text-stone-500">No image</div>}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div><h2 className="text-xl font-semibold text-white">{item.facility.name}</h2><p className="mt-1 text-sm text-stone-300">{formatDateTimeRange(item.startAtUtc, item.endAtUtc, item.timezone)}</p><p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">{item.durationMinutes / 60} hour{item.durationMinutes === 60 ? "" : "s"}</p></div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${item.availability === "AVAILABLE" ? "bg-emerald-400/20 text-emerald-100" : "bg-rose-400/20 text-rose-100"}`}>{item.availability === "AVAILABLE" ? "Available now" : "Needs attention"}</span>
                    </div>
                    {item.availabilityMessage ? <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-100">{item.availabilityMessage}</p> : null}
                    <div className="rounded-2xl border border-white/10 bg-stone-950/40 p-4">
                      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-stone-500">Current VAT-exclusive base amount</p><p className="mt-1 text-xl font-semibold text-white">{formatCurrency(item.currentAmountMinor, "PHP")}</p></div>{item.priceChanged ? <p className="text-sm text-amber-200">Changed from {formatCurrency(item.quotedAmountMinor, "PHP")}</p> : null}</div>
                      {price && price.segments.length > 1 ? <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-stone-400">{price.segments.map((segment) => <p key={`${segment.startMinutes}-${segment.ruleId}`}>{minutesToTimeLabel(segment.startMinutes)}-{minutesToTimeLabel(segment.endMinutes)} · {segment.rateLabel} · {formatCurrency(segment.amountMinor, "PHP")}</p>)}</div> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-4"><Link className="text-sm font-medium text-amber-200 underline-offset-4 hover:underline" href={`/facilities/${item.facility.slug}?date=${item.dateKey}&replaceCartItem=${item.id}&start=${getLocalMinutesForDate(item.startAtUtc, item.dateKey, item.timezone)}&duration=${item.durationMinutes}`}>Edit schedule</Link><RemoveCartItemButton cartItemId={item.id} /></div>
                  </div>
                </article>
              );
            })}
            <Button asChild variant="secondary"><Link href="/facilities">Add another facility or schedule</Link></Button>
          </section>

          <aside className="h-fit space-y-5 rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-5 xl:sticky xl:top-24">
            <div><p className="text-xs uppercase tracking-[0.18em] text-amber-200">Consolidated checkout</p><p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(currentAmountMinor, "PHP")}</p><p className="mt-1 text-sm text-stone-300">VAT-exclusive amount due for {items.length} booking{items.length === 1 ? "" : "s"}</p></div>
            <ul className="space-y-2 border-y border-white/10 py-4 text-sm text-stone-300"><li>One order reference</li><li>One payment instruction</li><li>One proof upload</li><li>Each schedule remains individually traceable</li></ul>
            <p className="text-xs leading-5 text-stone-400">All rates are base prices and exclusive of VAT. Availability and pricing are revalidated atomically when checkout is confirmed.</p>
            {hasPriceChanges ? <p className="rounded-xl bg-amber-300/15 p-3 text-sm text-amber-100">Prices changed after these items were added. Accept the updated prices before checkout.</p> : null}
            {hasUnavailableItems ? <p className="rounded-xl bg-rose-400/15 p-3 text-sm text-rose-100">Remove or edit unavailable schedules before checkout.</p> : null}
            <CartSummaryActions canCheckout={!hasUnavailableItems && !hasPriceChanges} hasPriceChanges={hasPriceChanges} />
          </aside>
        </div>
      )}
    </main>
  );
}
