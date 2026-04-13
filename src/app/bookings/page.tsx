import { BookingStatus } from "@prisma/client";
import Link from "next/link";

import { BookingList } from "@/components/bookings/booking-list";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type BookingsPageProps = {
  searchParams: Promise<{
    created?: string;
    mockPaid?: string;
  }>;
};

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const session = await getSession();
  const params = await searchParams;

  if (!session?.user) {
    return (
      <main className="space-y-8 pb-16">
        <SectionHeading
          eyebrow="Customer"
          title="My bookings"
          description="Sign in to view upcoming bookings, booking history, payment status, and cancellations."
        />
        <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-stone-300">
          <p className="mb-4">This section becomes your booking timeline after customer sign-in.</p>
          <Button asChild>
            <Link href="/login?callbackUrl=/bookings">Sign in to continue</Link>
          </Button>
        </section>
      </main>
    );
  }

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      startAtUtc: "asc"
    },
    include: {
      facility: {
        select: {
          name: true
        }
      },
      payment: {
        select: {
          status: true
        }
      }
    }
  });

  const upcoming = bookings.filter((booking) => booking.endAtUtc >= now && booking.status !== BookingStatus.CANCELLED);
  const history = bookings.filter((booking) => booking.endAtUtc < now || booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.EXPIRED);

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Customer"
        title="My bookings"
        description="Track upcoming reservations, pending payment holds, and booking history from the live PostgreSQL data set."
      />
      {params.created === "1" ? (
        <section className="rounded-[1.75rem] border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {params.mockPaid === "1"
            ? "Booking confirmed and marked paid through the temporary mock payment path."
            : "Booking created successfully."}
        </section>
      ) : null}
      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm text-stone-300">
        <p className="mb-3">Signed in as {session.user.email}</p>
        <p>Mock payment mode is currently enabled, so new successful reservations move straight into confirmed and paid state.</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <BookingList
          emptyMessage="No upcoming bookings yet. Start from the facilities page to reserve an open slot."
          items={upcoming.map((booking) => ({
            id: booking.id,
            facilityName: booking.facility.name,
            status: booking.status,
            paymentStatus: booking.payment?.status ?? null,
            amountMinor: booking.amountMinor,
            currency: "PHP",
            startAtUtc: booking.startAtUtc,
            endAtUtc: booking.endAtUtc,
            timezone: booking.timezone,
            paymentHoldExpiresAt: booking.paymentHoldExpiresAt
          }))}
          title="Upcoming"
        />
        <BookingList
          emptyMessage="No booking history yet."
          items={history.map((booking) => ({
            id: booking.id,
            facilityName: booking.facility.name,
            status: booking.status,
            paymentStatus: booking.payment?.status ?? null,
            amountMinor: booking.amountMinor,
            currency: "PHP",
            startAtUtc: booking.startAtUtc,
            endAtUtc: booking.endAtUtc,
            timezone: booking.timezone,
            paymentHoldExpiresAt: booking.paymentHoldExpiresAt
          }))}
          title="History"
        />
      </div>
    </main>
  );
}
