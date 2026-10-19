"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { CurrentUser, ProfileInput } from "@/lib/auth/schemas";
import { navigate } from "@/lib/navigate";
import { meQueryOptions } from "@/lib/queries/me";
import { createClient } from "@/lib/supabase/client";

/*
 * Every client call for sign-in and the signed-in person lives here
 * (ADR-0001). Google sign-in and sign-out talk to Supabase Auth from the
 * browser; the current-user query and the name change call our Route Handlers.
 */

export function useCurrentUser() {
  return useQuery(meQueryOptions);
}

/**
 * Sends the browser to Google; it returns to /auth/callback with a code, which
 * decides who gets in (ADR-0008). `hd` narrows Google's account chooser to the
 * company domain (a convenience, not the check); `select_account` always shows
 * the chooser, so "Use a different account" means it.
 */
export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async (next: string | null): Promise<void> => {
      const callback = new URL("/auth/callback", window.location.origin);
      if (next) callback.searchParams.set("next", next);
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            hd: "authoritysolutions.com",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    },
  });
}

/** Changes the person's own name; the user menu reads the same `me` query. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<CurrentUser>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user);
    },
  });
}

/**
 * Ends the session, clears everything cached for it and goes to /login. The
 * cache is cleared even if Supabase could not be reached: the local session
 * is removed either way. Used by the user menu and by "Use a different
 * account" on /access-denied.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await createClient().auth.signOut();
    },
    onSettled: () => {
      queryClient.clear();
      navigate("/login");
    },
  });
}
