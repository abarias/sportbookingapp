import { BookingStatus } from "@prisma/client";

export function resolveCancellationEnabled(globalEnabled: boolean, facilityOverride: boolean | null) {
  if (facilityOverride === null) {
    return globalEnabled;
  }

  return facilityOverride;
}

export function canCustomerCancelBooking(params: {
  bookingStatus: BookingStatus;
  startAtUtc: Date;
  now: Date;
  cancellationEnabled: boolean;
}) {
  if (!params.cancellationEnabled) {
    return false;
  }

  if (params.bookingStatus !== BookingStatus.CONFIRMED) {
    return false;
  }

  return params.startAtUtc > params.now;
}
