import { z } from "zod";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const timeKeySchema = z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.");

const operatingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAtMinutes: z.number().int().min(0).max(1440),
    closesAtMinutes: z.number().int().min(0).max(1440),
    isClosed: z.boolean()
  })
  .superRefine((value, ctx) => {
    if (!value.isClosed && value.opensAtMinutes >= value.closesAtMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Open time must be earlier than close time."
      });
    }
  });

export const facilityUpdateSchema = z.object({
  facilityId: z.string().min(1, "Facility is required."),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  description: z.string().trim().min(10, "Description must be at least 10 characters.").max(1000),
  isEnabled: z.boolean(),
  slotIntervalMinutes: z
    .number()
    .int()
    .min(30, "Slot interval must be at least 30 minutes.")
    .max(240, "Slot interval is too large.")
    .refine((value) => value % 30 === 0, "Slot interval must be in 30-minute increments."),
  amountMinor: z.number().int().min(0, "Price must be zero or greater."),
  minimumMinutes: z
    .number()
    .int()
    .min(30, "Minimum duration must be at least 30 minutes.")
    .max(480, "Minimum duration is too large.")
    .refine((value) => value % 30 === 0, "Minimum duration must be in 30-minute increments."),
  imageUrls: z.array(z.string().url("Each image must be a valid URL.")).min(1, "Add at least one image URL."),
  cancellationEnabledOverride: z.enum(["inherit", "enabled", "disabled"]),
  operatingHours: z.array(operatingHourSchema).length(7)
});

export const blockedScheduleSchema = z
  .object({
    facilityId: z.string().min(1, "Facility is required."),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
    reason: z.string().trim().max(300).optional(),
    startDate: dateKeySchema,
    endDate: dateKeySchema,
    startTime: timeKeySchema,
    endTime: timeKeySchema
  })
  .superRefine((value, ctx) => {
    const start = `${value.startDate}T${value.startTime}`;
    const end = `${value.endDate}T${value.endTime}`;

    if (start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date and time must be after the start date and time.",
        path: ["endTime"]
      });
    }
  });

export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;
export type BlockedScheduleInput = z.infer<typeof blockedScheduleSchema>;
