import { PricingBillingMode, PricingDayType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { analyzePricingRules, calculatePrice, deriveRateCard, PricingConfigurationError } from "@/server/pricing/engine";
import type { HolidayInput, PricingRuleInput } from "@/server/pricing/types";

function rule(overrides: Partial<PricingRuleInput> & Pick<PricingRuleInput, "id" | "name">): PricingRuleInput {
  return {
    customerLabel: null,
    dayType: PricingDayType.DEFAULT,
    daysOfWeek: [],
    startMinutes: 0,
    endMinutes: 1440,
    currency: "PHP",
    amountMinor: 100000,
    billingMode: PricingBillingMode.PER_HOUR,
    minimumMinutes: 60,
    priority: 0,
    effectiveFrom: null,
    effectiveUntil: null,
    isActive: true,
    displayOrder: 0,
    ...overrides
  };
}

const defaultRule = rule({ id: "default", name: "Default", amountMinor: 120000 });
const weekdayDay = rule({ id: "weekday-day", name: "Weekday daytime", dayType: PricingDayType.WEEKDAY, startMinutes: 480, endMinutes: 1020, amountMinor: 150000 });
const weekdayEvening = rule({ id: "weekday-evening", name: "Weekday evening", dayType: PricingDayType.WEEKDAY, startMinutes: 1020, endMinutes: 1440, amountMinor: 200000 });
const weekend = rule({ id: "weekend", name: "Weekend", dayType: PricingDayType.WEEKEND, amountMinor: 180000 });
const holidayRule = rule({ id: "holiday", name: "Holiday", dayType: PricingDayType.HOLIDAY, amountMinor: 220000 });
const holiday: HolidayInput = { id: "holiday-1", facilityId: null, name: "Test Holiday", date: new Date("2026-08-25T00:00:00.000Z"), isActive: true };

function calculate(overrides: Partial<Parameters<typeof calculatePrice>[0]> = {}) {
  return calculatePrice({
    facilityId: "facility-1",
    timezone: "Asia/Manila",
    dateKey: "2026-08-24",
    startMinutes: 480,
    durationMinutes: 60,
    intervalMinutes: 30,
    rules: [defaultRule, weekdayDay, weekdayEvening, weekend, holidayRule],
    holidays: [holiday],
    calculatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides
  });
}

describe("dynamic pricing engine", () => {
  it("applies weekday daytime and evening rates", () => {
    expect(calculate().amountMinor).toBe(150000);
    expect(calculate({ startMinutes: 1020 }).amountMinor).toBe(200000);
  });

  it("applies weekend, holiday, selected-day, and default precedence", () => {
    expect(calculate({ dateKey: "2026-08-29" }).amountMinor).toBe(180000);
    expect(calculate({ dateKey: "2026-08-29", startMinutes: 1380 }).amountMinor).toBe(180000);
    expect(calculate({ dateKey: "2026-08-25" }).amountMinor).toBe(220000);
    expect(calculate({ dateKey: "2026-08-25", startMinutes: 1380 }).amountMinor).toBe(220000);
    const selected = rule({ id: "tuesday", name: "Tuesday", dayType: PricingDayType.SELECTED_DAYS, daysOfWeek: [2], amountMinor: 210000 });
    expect(calculate({ dateKey: "2026-08-25", holidays: [], rules: [defaultRule, weekdayDay, selected] }).amountMinor).toBe(210000);
    expect(calculate({ startMinutes: 60, rules: [defaultRule, weekdayDay] }).amountMinor).toBe(120000);
  });

  it("segments a booking crossing a pricing boundary", () => {
    const result = calculate({ startMinutes: 960, durationMinutes: 120 });
    expect(result.amountMinor).toBe(350000);
    expect(result.segments.map((segment) => [segment.ruleId, segment.amountMinor])).toEqual([
      ["weekday-day", 150000],
      ["weekday-evening", 200000]
    ]);
  });

  it("supports a booking ending at midnight", () => {
    const result = calculate({ dateKey: "2026-08-24", startMinutes: 1380, durationMinutes: 60 });
    expect(result.segments[0]?.endMinutes).toBe(1440);
    expect(result.amountMinor).toBe(200000);
  });

  it("honors effective dates and inactive rules", () => {
    const dated = rule({ id: "dated", name: "Dated", dayType: PricingDayType.WEEKDAY, amountMinor: 175000, priority: 1, effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), effectiveUntil: new Date("2026-09-30T00:00:00.000Z") });
    expect(calculate({ dateKey: "2026-08-24", rules: [defaultRule, weekdayDay, dated] }).amountMinor).toBe(150000);
    expect(calculate({ dateKey: "2026-09-01", rules: [defaultRule, weekdayDay, dated] }).amountMinor).toBe(175000);
    expect(calculate({ rules: [defaultRule, { ...weekdayDay, isActive: false }] }).amountMinor).toBe(120000);
  });

  it("detects ambiguous overlaps and missing fallback coverage", () => {
    const overlap = rule({ id: "overlap", name: "Overlap", dayType: PricingDayType.WEEKDAY, startMinutes: 900, endMinutes: 1100, amountMinor: 170000 });
    const diagnostics = analyzePricingRules([defaultRule, weekdayDay, overlap]);
    expect(diagnostics.some((item) => item.code === "AMBIGUOUS_OVERLAP")).toBe(true);
    expect(analyzePricingRules([weekdayDay]).some((item) => item.code === "MISSING_DEFAULT")).toBe(true);
    expect(() => calculate({ rules: [weekdayDay], startMinutes: 60 })).toThrow(PricingConfigurationError);
  });

  it("uses deterministic minor-unit rounding", () => {
    const oddRate = rule({ id: "odd", name: "Odd", amountMinor: 100001 });
    const result = calculate({ rules: [oddRate], startMinutes: 480 });
    expect(result.amountMinor).toBe(100001);
    expect(Number.isInteger(result.amountMinor)).toBe(true);
  });

  it("uses venue date semantics independent of browser timezone", () => {
    const manilaMonday = calculate({ dateKey: "2026-08-24", timezone: "Asia/Manila" });
    expect(manilaMonday.segments[0]?.ruleId).toBe("weekday-day");
  });

  it("derives the public VAT-exclusive rate card from active rules", () => {
    const rows = deriveRateCard([defaultRule, weekdayDay, weekdayEvening, weekend, holidayRule, { ...weekend, id: "inactive", isActive: false }]);
    expect(rows).toHaveLength(5);
    expect(rows.find((row) => row.key === "holiday")?.applicableDays).toBe("Configured holidays");
    expect(rows.every((row) => row.unitLabel === "per hour")).toBe(true);
  });

  it("groups equivalent selected-day rate-card rows without changing meaning", () => {
    const monday = rule({ id: "monday", name: "Monday", customerLabel: "Class rate", dayType: PricingDayType.SELECTED_DAYS, daysOfWeek: [1], startMinutes: 600, endMinutes: 720, amountMinor: 90000 });
    const tuesday = rule({ id: "tuesday", name: "Tuesday", customerLabel: "Class rate", dayType: PricingDayType.SELECTED_DAYS, daysOfWeek: [2], startMinutes: 600, endMinutes: 720, amountMinor: 90000 });
    const rows = deriveRateCard([monday, tuesday]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.applicableDays).toBe("Monday, Tuesday");
  });
});
