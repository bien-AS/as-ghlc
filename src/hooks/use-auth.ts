"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  CurrentUser,
  ProfileInput,
  ResetRequestInput,
  SignInInput,
  SignUpInput,
  UpdatePasswordInput,
} from "@/lib/auth/schemas";
import { navigate } from "@/lib/navigate";
import { meQueryOptions } from "@/lib/queries/me";
import { createClient } from "@/lib/supabase/client";

/*
 * Every client call for spec 02 lives here (ADR-0001). The auth mutations talk
 * to Supabase Auth from the browser; the current-user query and the profile
 * mutation call our Route Handlers. Each mutation rejects with the Supabase or
 * API error; forms turn it into words with `authErrorMessage`.
 */

// Emailed links come back to the environment that sent them (spec 02). The
// address carries no query, so the email template can append the token to it.
const confirmUrl = () => `${window.location.origin}/auth/confirm`;

export function useCurrentUser() {
  return useQuery(meQueryOptions);
}

/**
 * Creates the auth user. Written for "confirm email" on: it resolves with
 * nothing, so no caller can branch on what Supabase returned.
 */
export function useSignUp() {
  return useMutation({
    mutationFn: async (input: SignUpInput): Promise<void> => {
      const { error } = await createClient().auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: confirmUrl(),
          // Keys of our own that Google does not use; read back at profile setup.
          data: {
            dw_first_name: input.firstName,
            dw_last_name: input.lastName,
          },
        },
      });
      if (error) throw error;
    },
  });
}

export function useResendConfirmation() {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: confirmUrl() },
      });
      if (error) throw error;
    },
  });
}

export function useSignInWithPassword() {
  return useMutation({
    mutationFn: async (input: SignInInput): Promise<void> => {
      const { error } = await createClient().auth.signInWithPassword(input);
      if (error) throw error;
    },
  });
}

/** Sends the browser to Google; it returns to /auth/callback with a code. */
export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async (next: string): Promise<void> => {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async ({ email }: ResetRequestInput): Promise<void> => {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: confirmUrl(),
      });
      if (error) throw error;
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async ({ password }: UpdatePasswordInput): Promise<void> => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<CurrentUser>("/api/profile", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user);
    },
  });
}

/**
 * Asks the server to create the profile from what the verified session already
 * knows (the silent path). Sends nothing. Rejects when the form must be shown,
 * and gives up after 15 seconds so the person is never left waiting.
 */
export function useCreateProfileSilently() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<CurrentUser>("/api/profile/silent", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryOptions.queryKey, user);
    },
  });
}

/**
 * Ends the session, clears everything cached for it and goes to "/". The
 * cache is cleared even if Supabase could not be reached: the local session
 * is removed either way.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await createClient().auth.signOut();
    },
    onSettled: () => {
      queryClient.clear();
      navigate("/");
    },
  });
}
