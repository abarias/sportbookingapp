import { AdminNav } from "@/components/admin/admin-nav";
import { WalkInBookingForm } from "@/components/admin/walk-in-booking-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { requireAdminSession } from "@/lib/auth/session";
import { getBookingWindow } from "@/server/bookings/booking-window";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminWalkInsPage() {
  await requireAdminSession();
  const facilities = await prisma.facility.findMany({
    where: { isEnabled: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true }
  });
  const bookingWindow = getBookingWindow(process.env.APP_TIMEZONE ?? "Asia/Manila");

  return (
    <main className="space-y-8 pb-16">
      <SectionHeading
        eyebrow="Admin"
        title="Walk-in bookings"
        description="Create desk-assisted bookings while still capturing customer contact details for future notifications."
      />
      <AdminNav current="walk-ins" />
      <WalkInBookingForm facilities={facilities} minDateKey={bookingWindow.minDateKey} maxDateKey={bookingWindow.maxDateKey} />
    </main>
  );
}
