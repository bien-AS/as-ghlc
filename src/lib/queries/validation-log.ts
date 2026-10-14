import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { ValidationLog } from "@/lib/validation/schemas";

/** One factory for the key and the options (ADR-0001). */
export const validationLogKeys = { all: ["validation-log"] } as const;

export const validationLogOptions = queryOptions({
  queryKey: validationLogKeys.all,
  queryFn: () => apiFetch<ValidationLog>("/api/validation-log"),
});
