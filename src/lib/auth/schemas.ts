import { z } from "zod";

// Shared by forms, hooks and Route Handlers (ADR-0003). No server-only imports here.

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(100, `Use 100 characters or fewer for your ${label}.`);

const email = z
  .string()
  .trim()
  .min(1, "Enter your email.")
  .pipe(z.email("Enter a valid email address, like name@example.com."));

/** Assumed minimum (spec 02); must match the Supabase project's setting. */
export const PASSWORD_MIN_LENGTH = 8;

const newPassword = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`,
  );

/** POST /api/profile accepts exactly these two fields; anything else is rejected. */
export const profileSchema = z.strictObject({
  firstName: name("first name"),
  lastName: name("last name"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const signUpSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  email,
  password: newPassword,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const resetRequestSchema = z.object({ email });
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const updatePasswordSchema = z.object({ password: newPassword });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

/** What GET /api/me and POST /api/profile return. */
export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

/** Machine-readable refusal codes of the application API. */
export type ApiErrorCode =
  | "unauthenticated"
  | "profile_required"
  | "email_conflict"
  // The profile cannot be created without asking: show the profile setup form.
  | "profile_form_required"
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "forbidden";
