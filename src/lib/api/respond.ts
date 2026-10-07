import { z } from "zod";

import type { ApiErrorCode } from "@/lib/auth/schemas";
import { AccessError, type AccessErrorCode } from "@/lib/data/users";

const STATUS: Record<AccessErrorCode, number> = {
  unauthenticated: 401,
  profile_required: 403,
  email_conflict: 409,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
};

export function apiError(
  code: ApiErrorCode,
  status: number,
  fields?: Record<string, string[] | undefined>,
) {
  return Response.json({ error: { code, fields } }, { status });
}

/** A zod failure as the validation error naming the fields (ADR-0003). */
export function invalidInput(error: z.ZodError) {
  return apiError("invalid_input", 400, z.flattenError(error).fieldErrors);
}

/**
 * The refusal contract (spec 02): a guard's refusal becomes 401, 403 with
 * "profile_required", 404 or 409. Anything else is a real failure and is rethrown.
 */
export function refusal(error: unknown): Response {
  if (error instanceof AccessError) {
    return apiError(error.code, STATUS[error.code]);
  }
  throw error;
}
