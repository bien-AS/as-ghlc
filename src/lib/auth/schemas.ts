import { z } from "zod";

// Shared by forms, hooks and Route Handlers (ADR-0003). No server-only imports here.

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(100, `Use 100 characters or fewer for your ${label}.`);

/** PATCH /api/profile accepts exactly these two fields; anything else is rejected. */
export const profileSchema = z.strictObject({
  firstName: name("first name"),
  lastName: name("last name"),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** What GET /api/me and PATCH /api/profile return. */
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
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "forbidden";
