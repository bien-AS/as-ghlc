"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { InviteInput, Member } from "@/lib/members/schemas";
import { membersOptions } from "@/lib/queries/members";
import type { Role } from "@/lib/roles";

/*
 * Every client call for the Users and roles screen (ADR-0001). Nothing here
 * knows the data is sample data (ADR-0006).
 */

export function useMembers({ enabled = true } = {}) {
  return useQuery({
    ...membersOptions,
    enabled,
    // A refusal will not change on a second try, and the error state offers one.
    retry: false,
  });
}

/** Every write answers with the whole list, which replaces the cached one. */
function useMemberWrite<TInput>(
  request: (input: TInput) => [path: string, init: RequestInit],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      const [path, init] = request(input);
      return apiFetch<Member[]>(path, init);
    },
    onSuccess: (members) => {
      queryClient.setQueryData(membersOptions.queryKey, members);
    },
    // Refused or failed: the list may have changed elsewhere, so reload it.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: membersOptions.queryKey });
    },
  });
}

const member = (id: string) => `/api/members/${encodeURIComponent(id)}`;
const invite = (id: string) => `/api/members/invites/${encodeURIComponent(id)}`;

export const useInviteMember = () =>
  useMemberWrite<InviteInput>((input) => [
    "/api/members/invites",
    { method: "POST", body: JSON.stringify(input) },
  ]);
export const useChangeMemberRole = () =>
  useMemberWrite<{ id: string; role: Role }>(({ id, role }) => [
    member(id),
    { method: "PATCH", body: JSON.stringify({ role }) },
  ]);
export const useRemoveMember = () =>
  useMemberWrite<string>((id) => [member(id), { method: "DELETE" }]);
export const useRevokeInvite = () =>
  useMemberWrite<string>((id) => [invite(id), { method: "DELETE" }]);
export const useResendInvite = () =>
  useMemberWrite<string>((id) => [`${invite(id)}/resend`, { method: "POST" }]);
