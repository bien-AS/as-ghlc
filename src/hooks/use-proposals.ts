"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  ProposalDraftInput,
  ProposalEvent,
  ProposalView,
} from "@/lib/proposals/schemas";
import { invoiceOptions } from "@/lib/queries/invoices";
import { leadKeys, leadOptions } from "@/lib/queries/leads";
import { notificationKeys } from "@/lib/queries/notifications";
import {
  proposalLeadsOptions,
  proposalOptions,
  proposalPath,
} from "@/lib/queries/proposals";

/*
 * Every client call for proposals lives here (ADR-0001). Reads and writes go
 * through the Route Handlers under /api/proposals; nothing here knows the data
 * is sample data (ADR-0006).
 */

export function useProposalLeads() {
  return useQuery(proposalLeadsOptions);
}

export function useProposal(leadId: string | undefined) {
  return useQuery({
    ...proposalOptions(leadId ?? ""),
    enabled: Boolean(leadId),
    // A lead that does not exist will not start existing on a second try.
    retry: false,
  });
}

export type ProposalWrite =
  | { action: "generate" }
  | { action: "save"; input: ProposalDraftInput }
  | { action: "send" }
  | { action: "simulate"; event: ProposalEvent };

const request = (write: ProposalWrite): RequestInit =>
  write.action === "save"
    ? { method: "PUT", body: JSON.stringify(write.input) }
    : {
        method: "POST",
        body: JSON.stringify(
          write.action === "simulate" ? { event: write.event } : {},
        ),
      };

/**
 * The four writes on one lead's proposal. One mutation, so the screen has one
 * "busy" and one failure to show. Every write answers with the proposal as it
 * now is, which replaces the cached one.
 */
export function useProposalWrite(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (write: ProposalWrite) =>
      apiFetch<ProposalView>(
        write.action === "save"
          ? proposalPath(leadId)
          : `${proposalPath(leadId)}/${write.action}`,
        request(write),
      ),
    onSuccess: (view) => {
      queryClient.setQueryData(proposalOptions(leadId).queryKey, view);
    },
    onSettled: (_view, error, write) => {
      // Refused or failed: the proposal may have changed elsewhere, so reload it.
      if (error) {
        void queryClient.invalidateQueries({
          queryKey: proposalOptions(leadId).queryKey,
        });
      }
      // Saving a draft changes nothing outside the proposal itself.
      if (write.action === "save" && !error) return;
      // The other writes move the lead: its stage, status, timeline, invoice.
      for (const queryKey of [
        proposalLeadsOptions.queryKey,
        leadOptions(leadId).queryKey,
        invoiceOptions(leadId).queryKey,
        leadKeys.lists,
        leadKeys.summaries,
        // Signing raises "Proposal signed" and "Invoice draft ready" (spec 08).
        notificationKeys.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
