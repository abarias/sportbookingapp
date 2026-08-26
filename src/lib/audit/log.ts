import type { Prisma, PrismaClient } from "@prisma/client";

type AuditClient = Pick<PrismaClient, "auditLog"> | Prisma.TransactionClient;

type AuditInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(client: AuditClient, input: AuditInput) {
  return client.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before,
      after: input.after,
      metadata: input.metadata
    }
  });
}
