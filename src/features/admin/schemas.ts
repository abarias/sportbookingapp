import { z } from "zod";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const timeKeySchema = z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.");
const facilityImageUrlSchema = z
  .string()
  .trim()
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Use a local image path or an HTTP(S) image URL.");

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
  amountMinor: z.number().int().min(0, "Price must be zero or greater."),
  imageUrls: z.array(facilityImageUrlSchema).min(1, "Add at least one image URL."),
  cancellationEnabledOverride: z.enum(["inherit", "enabled", "disabled"]),
  operatingHours: z.array(operatingHourSchema).length(7)
});

export const facilityCreateSchema = facilityUpdateSchema.omit({ facilityId: true }).extend({
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
  type: z.enum(["BASKETBALL_WHOLE", "BASKETBALL_HALF", "PICKLEBALL", "BADMINTON", "OTHER"])
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

export const walkInCustomerSchema = z.object({
  fullName: z.string().trim().min(2, "Customer name is required.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(255),
  phone: z.string().trim().regex(/^(\+63|0)9\d{9}$/, "Enter a valid Philippine mobile number."),
});

export const adminWalkInBookingSchema = walkInCustomerSchema.extend({
  facilityId: z.string().min(1, "Facility is required."),
  dateKey: dateKeySchema,
  startTime: timeKeySchema,
  durationMinutes: z
    .number()
    .int()
    .min(60, "Duration must be at least 1 hour.")
    .max(240, "Duration is too long.")
    .refine((value) => value % 60 === 0, "Duration must be in hourly increments."),
  paymentMethod: z.enum(["cash", "manual_gcash", "manual_bank_transfer"]),
  paymentReference: z.string().trim().max(120, "Reference is too long.").optional().or(z.literal(""))
}).superRefine((data, ctx) => {
  if (data.paymentMethod !== "cash" && !data.paymentReference) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter the payment transaction reference.",
      path: ["paymentReference"]
    });
  }
});

export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;
export type FacilityCreateInput = z.infer<typeof facilityCreateSchema>;
export type BlockedScheduleInput = z.infer<typeof blockedScheduleSchema>;
export type WalkInCustomerInput = z.infer<typeof walkInCustomerSchema>;
export type AdminWalkInBookingInput = z.infer<typeof adminWalkInBookingSchema>;
