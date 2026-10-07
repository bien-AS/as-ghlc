"use client";

import { useQuery } from "@tanstack/react-query";

import { invoiceOptions } from "@/lib/queries/invoices";

/*
 * Every client call for invoices lives here (ADR-0001). There is one: an
 * invoice is drafted by the server when a proposal is signed (spec 15), so
 * the client only reads it.
 */

/** A lead's invoice, or null. Not asked for until `enabled`. */
export function useInvoice(leadId: string, enabled = true) {
  return useQuery({ ...invoiceOptions(leadId), enabled, retry: false });
}
