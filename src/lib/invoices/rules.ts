import type { InvoiceStatus } from "@/lib/invoices/schemas";
import type { Tone } from "@/lib/leads/rules";

/** Every invoice status chip takes its word and tone from here. */
export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; tone: Tone }
> = {
  // A draft is waiting for the rep to check it.
  draft: { label: "Draft", tone: "warn" },
  sent: { label: "Sent", tone: "ok" },
};
