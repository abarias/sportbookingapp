import { logger } from "@/lib/observability/logger";

const technicalErrorPattern = /PrismaClient|Invalid `prisma\.|Transaction API error|constraint (?:failed|violated)|ENOENT|EACCES|ECONN|ETIMEDOUT|ECONNRESET|can't reach database|invalid date|failed to deserialize|body exceeded|P\d{4}|23P01|cannot read propert(?:y|ies)|not a function|fetch failed|query failed|database|\bSQL\b/i;

function getErrorMetadata(error: unknown) {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown };
    return {
      errorName: error.name,
      errorCode: typeof candidate.code === "string" ? candidate.code : undefined,
      errorMessage: error.message,
      errorStack: error.stack
    };
  }

  return {
    errorName: typeof error,
    errorMessage: String(error)
  };
}

/**
 * Keeps expected domain failures useful while preventing implementation details
 * from crossing a server-action boundary.
 */
export function getSafeActionError(
  error: unknown,
  fallback: string,
  event: string,
  metadata: Record<string, unknown> = {}
) {
  logger.error(event, { ...metadata, ...getErrorMetadata(error) });

  if (error instanceof Error && error.message.trim() && !technicalErrorPattern.test(error.message)) {
    return error.message;
  }

  return fallback;
}
