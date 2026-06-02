import { BookingStatus } from "@prisma/client";

export function resolveCancellationEnabled(globalEnabled: boolean, facilityOverride: boolean | null) {
  if (facilityOverride === null) {
    return globalEnabled;
  }

  return facilityOverride;
}

export function resolveCancellationWindowHours(globalHours: number, facilityOverride: number | null) {
  if (facilityOverride === null) {
    return globalHours;
  }

  return facilityOverride;
}

export function canCustomerCancelBooking(params: {
  bookingStatus: BookingStatus;
  startAtUtc: Date;
  createdAt: Date;
  now: Date;
  cancellationEnabled: boolean;
  cancellationWindowHours: number;
}) {
  if (!params.cancellationEnabled) {
    return false;
  }

  if (params.bookingStatus !== BookingStatus.CONFIRMED) {
    return false;
  }

  if (params.startAtUtc <= params.now) {
    return false;
  }

  const cancellationDeadline = new Date(params.createdAt.getTime() + params.cancellationWindowHours * 60 * 60 * 1000);

  return params.now <= cancellationDeadline;
}
