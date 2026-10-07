import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { Invoice } from "@/lib/invoices/schemas";

/** A lead's invoice, or null. One factory for the key and options (ADR-0001). */
export const invoiceOptions = (leadId: string) =>
  queryOptions({
    queryKey: ["invoices", "lead", leadId],
    queryFn: () =>
      apiFetch<Invoice | null>(
        `/api/leads/${encodeURIComponent(leadId)}/invoice`,
      ),
  });
