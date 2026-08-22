import { PricingBillingMode, PricingDayType } from "@prisma/client";

import { getDayOfWeek, minutesToTimeLabel } from "@/lib/time/slots";
import type { HolidayInput, PriceCalculation, PriceSegment, PricingDiagnostic, PricingRuleInput, RateCardRow } from "@/server/pricing/types";

const PRECEDENCE: Record<PricingDayType, number> = {
  DEFAULT: 0,
  WEEKDAY: 1,
  WEEKEND: 2,
  SELECTED_DAYS: 3,
  HOLIDAY: 4
};

export class PricingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingConfigurationError";
  }
}

function dateFieldToKey(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function isEffective(rule: PricingRuleInput, dateKey: string) {
  const from = dateFieldToKey(rule.effectiveFrom);
  const until = dateFieldToKey(rule.effectiveUntil);
  return (!from || dateKey >= from) && (!until || dateKey <= until);
}

function getHoliday(dateKey: string, facilityId: string, holidays: HolidayInput[]) {
  return [...holidays].sort((left, right) => Number(right.facilityId === facilityId) - Number(left.facilityId === facilityId)).find(
    (holiday) =>
      holiday.isActive &&
      dateFieldToKey(holiday.date) === dateKey &&
      (holiday.facilityId === null || holiday.facilityId === facilityId)
  ) ?? null;
}

function matchesDay(rule: PricingRuleInput, dayOfWeek: number, isHoliday: boolean) {
  switch (rule.dayType) {
    case PricingDayType.DEFAULT:
      return true;
    case PricingDayType.HOLIDAY:
      return isHoliday;
    case PricingDayType.WEEKDAY:
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case PricingDayType.WEEKEND:
      return dayOfWeek === 0 || dayOfWeek === 6;
    case PricingDayType.SELECTED_DAYS:
      return rule.daysOfWeek.includes(dayOfWeek);
  }
}

function matchesSegment(rule: PricingRuleInput, startMinutes: number, endMinutes: number) {
  if (rule.dayType === PricingDayType.WEEKEND || rule.dayType === PricingDayType.HOLIDAY) return true;
  return rule.startMinutes <= startMinutes && rule.endMinutes >= endMinutes;
}

function selectRule(params: {
  rules: PricingRuleInput[];
  dateKey: string;
  dayOfWeek: number;
  isHoliday: boolean;
  startMinutes: number;
  endMinutes: number;
}) {
  const matches = params.rules
    .filter(
      (rule) =>
        rule.isActive &&
        isEffective(rule, params.dateKey) &&
        matchesDay(rule, params.dayOfWeek, params.isHoliday) &&
        matchesSegment(rule, params.startMinutes, params.endMinutes)
    )
    .sort((left, right) => {
      const specificity = PRECEDENCE[right.dayType] - PRECEDENCE[left.dayType];
      return specificity || right.priority - left.priority || left.displayOrder - right.displayOrder;
    });

  const selected = matches[0];
  if (!selected) {
    throw new PricingConfigurationError(
      `No pricing rule covers ${minutesToTimeLabel(params.startMinutes)}-${minutesToTimeLabel(params.endMinutes)}.`
    );
  }

  const ambiguous = matches.find(
    (rule, index) =>
      index > 0 && PRECEDENCE[rule.dayType] === PRECEDENCE[selected.dayType] && rule.priority === selected.priority
  );
  if (ambiguous) {
    throw new PricingConfigurationError(`Pricing rules "${selected.name}" and "${ambiguous.name}" are ambiguous for this time.`);
  }

  if (selected.amountMinor <= 0) {
    throw new PricingConfigurationError(`Pricing rule "${selected.name}" must have a base rate greater than zero.`);
  }

  return selected;
}

function calculateSegmentAmount(rule: PricingRuleInput, durationMinutes: number) {
  const unitMinutes = rule.billingMode === PricingBillingMode.PER_HOUR ? 60 : rule.minimumMinutes;
  return Math.round((rule.amountMinor * durationMinutes) / unitMinutes);
}

function getDayLabel(rule: PricingRuleInput, isHoliday: boolean) {
  if (isHoliday && rule.dayType === PricingDayType.HOLIDAY) return "Holiday";
  if (rule.dayType === PricingDayType.WEEKDAY) return "Weekday";
  if (rule.dayType === PricingDayType.WEEKEND) return "Weekend";
  if (rule.dayType === PricingDayType.SELECTED_DAYS) return "Selected day";
  return "Default rate";
}

function mergeSegments(segments: PriceSegment[]) {
  return segments.reduce<PriceSegment[]>((result, segment) => {
    const previous = result[result.length - 1];
    if (previous && previous.ruleId === segment.ruleId && previous.endMinutes === segment.startMinutes) {
      previous.endMinutes = segment.endMinutes;
      previous.durationMinutes += segment.durationMinutes;
      previous.amountMinor = Math.round((previous.rateAmountMinor * previous.durationMinutes) / previous.rateUnitMinutes);
      return result;
    }

    result.push({ ...segment });
    return result;
  }, []);
}

export function calculatePrice(params: {
  facilityId: string;
  timezone: string;
  dateKey: string;
  startMinutes: number;
  durationMinutes: number;
  intervalMinutes: number;
  rules: PricingRuleInput[];
  holidays: HolidayInput[];
  calculatedAt?: Date;
}): PriceCalculation {
  const endMinutes = params.startMinutes + params.durationMinutes;
  if (
    params.startMinutes < 0 ||
    endMinutes > 1440 ||
    params.durationMinutes <= 0 ||
    params.startMinutes % params.intervalMinutes !== 0 ||
    params.durationMinutes % params.intervalMinutes !== 0
  ) {
    throw new PricingConfigurationError("The booking range must use valid facility pricing intervals within one local day.");
  }

  const dayOfWeek = getDayOfWeek(params.dateKey, params.timezone);
  const holiday = getHoliday(params.dateKey, params.facilityId, params.holidays);
  const rawSegments: PriceSegment[] = [];

  for (let start = params.startMinutes; start < endMinutes; start += params.intervalMinutes) {
    const end = start + params.intervalMinutes;
    const rule = selectRule({
      rules: params.rules,
      dateKey: params.dateKey,
      dayOfWeek,
      isHoliday: Boolean(holiday),
      startMinutes: start,
      endMinutes: end
    });
    rawSegments.push({
      startMinutes: start,
      endMinutes: end,
      durationMinutes: params.intervalMinutes,
      ruleId: rule.id,
      ruleName: rule.name,
      rateLabel: rule.customerLabel || rule.name,
      dayLabel: getDayLabel(rule, Boolean(holiday)),
      amountMinor: calculateSegmentAmount(rule, params.intervalMinutes),
      rateAmountMinor: rule.amountMinor,
      rateUnit: rule.billingMode === PricingBillingMode.PER_HOUR ? "hour" : "booking block",
      rateUnitMinutes: rule.billingMode === PricingBillingMode.PER_HOUR ? 60 : rule.minimumMinutes
    });
  }

  const segments = mergeSegments(rawSegments);
  return {
    dateKey: params.dateKey,
    currency: "PHP",
    vatTreatment: "EXCLUSIVE",
    isHoliday: Boolean(holiday),
    holidayName: holiday?.name ?? null,
    amountMinor: segments.reduce((sum, segment) => sum + segment.amountMinor, 0),
    durationMinutes: params.durationMinutes,
    calculatedAt: (params.calculatedAt ?? new Date()).toISOString(),
    segments
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function applicableDaysLabel(rule: PricingRuleInput) {
  switch (rule.dayType) {
    case PricingDayType.DEFAULT:
      return "All other dates";
    case PricingDayType.WEEKDAY:
      return "Monday-Friday";
    case PricingDayType.WEEKEND:
      return "Saturday-Sunday";
    case PricingDayType.HOLIDAY:
      return "Configured holidays";
    case PricingDayType.SELECTED_DAYS:
      return rule.daysOfWeek.map((day) => DAY_NAMES[day]).filter(Boolean).join(", ");
  }
}

function effectiveLabel(rule: PricingRuleInput) {
  const from = dateFieldToKey(rule.effectiveFrom);
  const until = dateFieldToKey(rule.effectiveUntil);
  if (from && until) return `${from} through ${until}`;
  if (from) return `From ${from}`;
  if (until) return `Through ${until}`;
  return null;
}

export function deriveRateCard(rules: PricingRuleInput[]): RateCardRow[] {
  const sorted = rules
    .filter((rule) => rule.isActive)
    .sort((left, right) => {
      if (left.dayType === PricingDayType.DEFAULT && right.dayType !== PricingDayType.DEFAULT) return 1;
      if (right.dayType === PricingDayType.DEFAULT && left.dayType !== PricingDayType.DEFAULT) return -1;
      return left.displayOrder - right.displayOrder || PRECEDENCE[right.dayType] - PRECEDENCE[left.dayType];
    });
  const rows: RateCardRow[] = [];
  const selectedDayGroups = new Map<string, { row: RateCardRow; days: Set<number> }>();

  for (const rule of sorted) {
    const row: RateCardRow = {
      key: rule.id,
      applicableDays: applicableDaysLabel(rule),
      timeLabel:
        rule.dayType === PricingDayType.WEEKEND || rule.dayType === PricingDayType.HOLIDAY || (rule.startMinutes === 0 && rule.endMinutes === 1440)
          ? "All operating hours"
          : `${minutesToTimeLabel(rule.startMinutes)}-${minutesToTimeLabel(rule.endMinutes)}`,
      rateLabel: rule.customerLabel || rule.name,
      amountMinor: rule.amountMinor,
      unitLabel: rule.billingMode === PricingBillingMode.PER_HOUR ? "per hour" : `per ${rule.minimumMinutes}-minute block`,
      effectiveLabel: effectiveLabel(rule)
    };

    if (rule.dayType !== PricingDayType.SELECTED_DAYS) {
      rows.push(row);
      continue;
    }

    const groupKey = [row.timeLabel, row.rateLabel, row.amountMinor, row.unitLabel, row.effectiveLabel ?? ""].join("|");
    const existing = selectedDayGroups.get(groupKey);
    if (!existing) {
      const group = { row, days: new Set(rule.daysOfWeek) };
      selectedDayGroups.set(groupKey, group);
      rows.push(row);
      continue;
    }

    rule.daysOfWeek.forEach((day) => existing.days.add(day));
    existing.row.key = `${existing.row.key}-${rule.id}`;
    existing.row.applicableDays = [...existing.days].sort().map((day) => DAY_NAMES[day]).filter(Boolean).join(", ");
  }

  return rows;
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function effectiveRangesOverlap(left: PricingRuleInput, right: PricingRuleInput) {
  const leftStart = dateFieldToKey(left.effectiveFrom) ?? "0000-01-01";
  const leftEnd = dateFieldToKey(left.effectiveUntil) ?? "9999-12-31";
  const rightStart = dateFieldToKey(right.effectiveFrom) ?? "0000-01-01";
  const rightEnd = dateFieldToKey(right.effectiveUntil) ?? "9999-12-31";
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function dayScopesOverlap(left: PricingRuleInput, right: PricingRuleInput) {
  if (left.dayType !== right.dayType) return false;
  if (left.dayType !== PricingDayType.SELECTED_DAYS) return true;
  return left.daysOfWeek.some((day) => right.daysOfWeek.includes(day));
}

function sameRuleDefinition(left: PricingRuleInput, right: PricingRuleInput) {
  return (
    left.dayType === right.dayType &&
    left.startMinutes === right.startMinutes &&
    left.endMinutes === right.endMinutes &&
    left.amountMinor === right.amountMinor &&
    left.priority === right.priority &&
    dateFieldToKey(left.effectiveFrom) === dateFieldToKey(right.effectiveFrom) &&
    dateFieldToKey(left.effectiveUntil) === dateFieldToKey(right.effectiveUntil) &&
    [...left.daysOfWeek].sort().join(",") === [...right.daysOfWeek].sort().join(",")
  );
}

export function analyzePricingRules(rules: PricingRuleInput[]): PricingDiagnostic[] {
  const active = rules.filter((rule) => rule.isActive);
  const diagnostics: PricingDiagnostic[] = [];

  if (!active.some((rule) => rule.dayType === PricingDayType.DEFAULT)) {
    diagnostics.push({
      severity: "error",
      code: "MISSING_DEFAULT",
      message: "Add an active default rate so every valid booking has a price.",
      ruleIds: []
    });
  }

  for (const rule of active) {
    const invalidSelectedDays = rule.dayType === PricingDayType.SELECTED_DAYS && rule.daysOfWeek.length === 0;
    if (rule.amountMinor <= 0 || rule.startMinutes < 0 || rule.startMinutes >= rule.endMinutes || rule.endMinutes > 1440 || invalidSelectedDays) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_RULE",
        message: `Rule "${rule.name}" has an invalid amount, time range, or day selection.`,
        ruleIds: [rule.id]
      });
    }
  }

  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex];
      const right = active[rightIndex];
      if (!left || !right || !dayScopesOverlap(left, right) || !effectiveRangesOverlap(left, right)) continue;
      if (!rangesOverlap(left.startMinutes, left.endMinutes, right.startMinutes, right.endMinutes)) continue;

      if (sameRuleDefinition(left, right)) {
        diagnostics.push({ severity: "error", code: "DUPLICATE_RULE", message: `Rules "${left.name}" and "${right.name}" are duplicates.`, ruleIds: [left.id, right.id] });
      } else if (left.priority === right.priority) {
        diagnostics.push({ severity: "error", code: "AMBIGUOUS_OVERLAP", message: `Rules "${left.name}" and "${right.name}" overlap with equal precedence and priority.`, ruleIds: [left.id, right.id] });
      } else {
        const hidden = left.priority < right.priority ? left : right;
        diagnostics.push({ severity: "warning", code: "SHADOWED_RULE", message: `Rule "${hidden.name}" is overridden where these schedules overlap.`, ruleIds: [left.id, right.id] });
      }
    }
  }

  return diagnostics;
}
