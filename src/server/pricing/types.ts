import type { PricingBillingMode, PricingDayType } from "@prisma/client";

export type PricingRuleInput = {
  id: string;
  name: string;
  customerLabel: string | null;
  dayType: PricingDayType;
  daysOfWeek: number[];
  startMinutes: number;
  endMinutes: number;
  currency: string;
  amountMinor: number;
  billingMode: PricingBillingMode;
  minimumMinutes: number;
  priority: number;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  isActive: boolean;
  displayOrder: number;
};

export type HolidayInput = {
  id: string;
  facilityId: string | null;
  name: string;
  date: Date;
  isActive: boolean;
};

export type PriceSegment = {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  ruleId: string;
  ruleName: string;
  rateLabel: string;
  dayLabel: string;
  amountMinor: number;
  rateAmountMinor: number;
  rateUnit: "hour" | "booking block";
  rateUnitMinutes: number;
};

export type PriceCalculation = {
  dateKey: string;
  currency: "PHP";
  vatTreatment: "EXCLUSIVE";
  isHoliday: boolean;
  holidayName: string | null;
  amountMinor: number;
  durationMinutes: number;
  calculatedAt: string;
  segments: PriceSegment[];
};

export type RateCardRow = {
  key: string;
  applicableDays: string;
  timeLabel: string;
  rateLabel: string;
  amountMinor: number;
  unitLabel: string;
  effectiveLabel: string | null;
};

export type PricingDiagnostic = {
  severity: "error" | "warning";
  code: "MISSING_DEFAULT" | "INVALID_RULE" | "AMBIGUOUS_OVERLAP" | "DUPLICATE_RULE" | "SHADOWED_RULE";
  message: string;
  ruleIds: string[];
};
