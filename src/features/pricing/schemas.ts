import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const pricingRuleSchema = z
  .object({
    ruleId: z.string().optional(),
    facilityId: z.string().min(1, "Select a facility."),
    name: z.string().trim().min(2, "Enter an admin label.").max(120),
    customerLabel: z.string().trim().max(120).optional().or(z.literal("")),
    dayType: z.enum(["WEEKDAY", "WEEKEND", "HOLIDAY", "SELECTED_DAYS"]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(1).max(1440),
    amountMinor: z.number().int().positive("Rate must be greater than zero."),
    priority: z.number().int().min(0).max(100),
    effectiveFrom: dateKey,
    effectiveUntil: dateKey,
    isActive: z.boolean(),
    displayOrder: z.number().int().min(0).max(1000)
  })
  .superRefine((value, ctx) => {
    if (value.startMinutes >= value.endMinutes) {
      ctx.addIssue({ code: "custom", path: ["endMinutes"], message: "End time must be after start time. Use midnight as the end of day." });
    }
    const allDay = value.dayType === "WEEKEND" || value.dayType === "HOLIDAY";
    if (!allDay && (value.startMinutes % 60 !== 0 || value.endMinutes % 60 !== 0)) {
      ctx.addIssue({ code: "custom", path: ["startMinutes"], message: "Pricing boundaries must use hourly increments." });
    }
    if (value.dayType === "SELECTED_DAYS" && value.daysOfWeek.length === 0) {
      ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Select at least one day." });
    }
    if (value.effectiveFrom && value.effectiveUntil && value.effectiveUntil < value.effectiveFrom) {
      ctx.addIssue({ code: "custom", path: ["effectiveUntil"], message: "Effective-until date must not precede effective-from." });
    }
  });

export const holidaySchema = z.object({
  holidayId: z.string().optional(),
  facilityId: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Enter a holiday name.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid holiday date."),
  isActive: z.boolean()
});

export type PricingRuleFormInput = z.infer<typeof pricingRuleSchema>;
export type HolidayFormInput = z.infer<typeof holidaySchema>;
