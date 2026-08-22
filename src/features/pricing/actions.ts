"use server";

import { Prisma, PricingBillingMode, PricingDayType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { holidaySchema, pricingRuleSchema } from "@/features/pricing/schemas";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { analyzePricingRules } from "@/server/pricing/engine";

export type PricingActionState = {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
};

function parseTime(value: FormDataEntryValue | null, isEnd = false) {
  const raw = String(value ?? "");
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const [hours, minutes] = raw.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return Number.NaN;
  if (isEnd && hours === 0 && minutes === 0) return 1440;
  return hours * 60 + minutes;
}

function parseMoney(value: FormDataEntryValue | null) {
  return Math.round(Number.parseFloat(String(value ?? "")) * 100);
}

function toDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function flattenErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(Object.entries(fields).map(([key, messages]) => [key, messages?.[0]]));
}

function revalidatePricing(facilitySlug?: string) {
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/facilities");
  revalidatePath("/facilities");
  if (facilitySlug) revalidatePath(`/facilities/${facilitySlug}`);
}

export async function savePricingRuleAction(_state: PricingActionState, formData: FormData): Promise<PricingActionState> {
  const session = await requireAdminSession();
  const dayType = String(formData.get("dayType") ?? "");
  const isAllDay = dayType === "WEEKEND" || dayType === "HOLIDAY";
  const parsed = pricingRuleSchema.safeParse({
    ruleId: String(formData.get("ruleId") ?? "") || undefined,
    facilityId: String(formData.get("facilityId") ?? ""),
    name: String(formData.get("name") ?? ""),
    customerLabel: String(formData.get("customerLabel") ?? ""),
    dayType,
    daysOfWeek: formData.getAll("daysOfWeek").map(Number),
    startMinutes: isAllDay ? 0 : parseTime(formData.get("startTime")),
    endMinutes: isAllDay ? 1440 : parseTime(formData.get("endTime"), true),
    amountMinor: parseMoney(formData.get("amount")),
    priority: Number.parseInt(String(formData.get("priority") ?? "0"), 10),
    effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
    effectiveUntil: String(formData.get("effectiveUntil") ?? ""),
    isActive: formData.get("isActive") === "on",
    displayOrder: Number.parseInt(String(formData.get("displayOrder") ?? "0"), 10)
  });

  if (!parsed.success) {
    return { error: "Correct the pricing rule and try again.", fieldErrors: flattenErrors(parsed.error) };
  }

  const facility = await prisma.facility.findUnique({
    where: { id: parsed.data.facilityId },
    include: { pricingRules: true }
  });
  if (!facility) return { error: "Facility not found." };

  const candidate = {
    id: parsed.data.ruleId ?? crypto.randomUUID(),
    facilityId: facility.id,
    name: parsed.data.name,
    customerLabel: parsed.data.customerLabel || null,
    dayType: parsed.data.dayType as PricingDayType,
    daysOfWeek: parsed.data.dayType === "SELECTED_DAYS" ? parsed.data.daysOfWeek : [],
    startMinutes: parsed.data.startMinutes,
    endMinutes: parsed.data.endMinutes,
    currency: "PHP",
    amountMinor: parsed.data.amountMinor,
    billingMode: PricingBillingMode.PER_HOUR,
    minimumMinutes: 60,
    priority: parsed.data.priority,
    effectiveFrom: toDate(parsed.data.effectiveFrom),
    effectiveUntil: toDate(parsed.data.effectiveUntil),
    isActive: parsed.data.isActive,
    displayOrder: parsed.data.displayOrder,
    createdByUserId: session.user.id,
    updatedByUserId: session.user.id,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const combined = [...facility.pricingRules.filter((rule) => rule.id !== parsed.data.ruleId), candidate];
  const blockingDiagnostic = analyzePricingRules(combined).find((diagnostic) => diagnostic.severity === "error");
  if (blockingDiagnostic) return { error: blockingDiagnostic.message };

  if (parsed.data.ruleId) {
    const result = await prisma.pricingRule.updateMany({
      where: { id: parsed.data.ruleId, facilityId: facility.id, dayType: { not: PricingDayType.DEFAULT } },
      data: {
        name: candidate.name,
        customerLabel: candidate.customerLabel,
        dayType: candidate.dayType,
        daysOfWeek: candidate.daysOfWeek,
        startMinutes: candidate.startMinutes,
        endMinutes: candidate.endMinutes,
        amountMinor: candidate.amountMinor,
        priority: candidate.priority,
        effectiveFrom: candidate.effectiveFrom,
        effectiveUntil: candidate.effectiveUntil,
        isActive: candidate.isActive,
        displayOrder: candidate.displayOrder,
        updatedByUserId: session.user.id
      }
    });
    if (result.count !== 1) return { error: "Pricing rule could not be updated." };
  } else {
    await prisma.pricingRule.create({ data: candidate });
  }

  revalidatePricing(facility.slug);
  return { success: parsed.data.ruleId ? "Pricing rule updated." : "Pricing rule added." };
}

export async function togglePricingRuleAction(formData: FormData) {
  const session = await requireAdminSession();
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await prisma.pricingRule.findFirst({ where: { id: ruleId, dayType: { not: PricingDayType.DEFAULT } }, include: { facility: true } });
  if (!rule) throw new Error("Pricing rule not found.");
  if (!rule.isActive) {
    const rules = await prisma.pricingRule.findMany({ where: { facilityId: rule.facilityId } });
    const blockingDiagnostic = analyzePricingRules(rules.map((item) => item.id === rule.id ? { ...item, isActive: true } : item)).find((item) => item.severity === "error");
    if (blockingDiagnostic) throw new Error(blockingDiagnostic.message);
  }
  await prisma.pricingRule.update({ where: { id: rule.id }, data: { isActive: !rule.isActive, updatedByUserId: session.user.id } });
  revalidatePricing(rule.facility.slug);
}

export async function deletePricingRuleAction(formData: FormData) {
  await requireAdminSession();
  const ruleId = String(formData.get("ruleId") ?? "");
  const rule = await prisma.pricingRule.findFirst({
    where: { id: ruleId, dayType: { not: PricingDayType.DEFAULT } },
    include: { facility: true }
  });
  if (!rule) throw new Error("Pricing rule not found.");

  await prisma.pricingRule.delete({
    where: { id: rule.id }
  });

  revalidatePricing(rule.facility.slug);
}

export async function saveHolidayAction(_state: PricingActionState, formData: FormData): Promise<PricingActionState> {
  const session = await requireAdminSession();
  const parsed = holidaySchema.safeParse({
    holidayId: String(formData.get("holidayId") ?? "") || undefined,
    facilityId: String(formData.get("facilityId") ?? ""),
    name: String(formData.get("name") ?? ""),
    date: String(formData.get("date") ?? ""),
    isActive: formData.get("isActive") === "on"
  });
  if (!parsed.success) return { error: "Correct the holiday and try again.", fieldErrors: flattenErrors(parsed.error) };

  const data = {
    facilityId: parsed.data.facilityId || null,
    name: parsed.data.name,
    date: toDate(parsed.data.date)!,
    isActive: parsed.data.isActive,
    updatedByUserId: session.user.id
  };

  try {
    const duplicate = await prisma.holiday.findFirst({
      where: {
        id: parsed.data.holidayId ? { not: parsed.data.holidayId } : undefined,
        facilityId: data.facilityId,
        date: data.date,
        name: { equals: data.name, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (duplicate) return { error: "That holiday is already configured for this facility." };

    if (parsed.data.holidayId) {
      await prisma.holiday.update({ where: { id: parsed.data.holidayId }, data });
    } else {
      await prisma.holiday.create({ data: { ...data, createdByUserId: session.user.id } });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "That holiday is already configured for this facility." };
    throw error;
  }

  revalidatePricing();
  return { success: parsed.data.holidayId ? "Holiday updated." : "Holiday added." };
}

export async function toggleHolidayAction(formData: FormData) {
  const session = await requireAdminSession();
  const holidayId = String(formData.get("holidayId") ?? "");
  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } });
  if (!holiday) throw new Error("Holiday not found.");
  await prisma.holiday.update({ where: { id: holiday.id }, data: { isActive: !holiday.isActive, updatedByUserId: session.user.id } });
  revalidatePricing();
}

export async function copyPricingScheduleAction(_state: PricingActionState, formData: FormData): Promise<PricingActionState> {
  const session = await requireAdminSession();
  const sourceFacilityId = String(formData.get("sourceFacilityId") ?? "");
  const targetFacilityId = String(formData.get("targetFacilityId") ?? "");
  if (!sourceFacilityId || !targetFacilityId || sourceFacilityId === targetFacilityId) return { error: "Choose a different target facility." };

  const [source, target] = await Promise.all([
    prisma.facility.findUnique({ where: { id: sourceFacilityId }, include: { pricingRules: { where: { dayType: { not: PricingDayType.DEFAULT } } } } }),
    prisma.facility.findUnique({ where: { id: targetFacilityId }, select: { id: true, slug: true } })
  ]);
  if (!source || !target) return { error: "Source or target facility was not found." };

  await prisma.$transaction(async (tx) => {
    await tx.pricingRule.updateMany({
      where: { facilityId: target.id, dayType: { not: PricingDayType.DEFAULT }, isActive: true },
      data: { isActive: false, updatedByUserId: session.user.id }
    });
    if (source.pricingRules.length > 0) {
      await tx.pricingRule.createMany({
        data: source.pricingRules.map((rule) => ({
          facilityId: target.id,
          name: rule.name,
          customerLabel: rule.customerLabel,
          dayType: rule.dayType,
          daysOfWeek: rule.daysOfWeek,
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          currency: rule.currency,
          amountMinor: rule.amountMinor,
          billingMode: rule.billingMode,
          minimumMinutes: rule.minimumMinutes,
          priority: rule.priority,
          effectiveFrom: rule.effectiveFrom,
          effectiveUntil: rule.effectiveUntil,
          isActive: rule.isActive,
          displayOrder: rule.displayOrder,
          createdByUserId: session.user.id,
          updatedByUserId: session.user.id
        }))
      });
    }
  });

  revalidatePricing(target.slug);
  return { success: `Copied ${source.pricingRules.length} schedule override${source.pricingRules.length === 1 ? "" : "s"}. The target default rate was preserved.` };
}
