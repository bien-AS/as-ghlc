import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { z } from "zod";

export type FieldErrors = Record<string, string | undefined>;

/**
 * Reads a form's named fields and validates them with the form's zod schema.
 * On failure it returns the first message per field and moves focus to the
 * first invalid field in document order.
 */
export function readForm<T>(
  schema: z.ZodType<T>,
  form: HTMLFormElement,
): { data: T; errors?: undefined } | { data?: undefined; errors: FieldErrors } {
  const values = Object.fromEntries(new FormData(form));
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    errors[key] ??= issue.message;
  }
  const firstInvalid = Array.from(form.elements).find(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && Boolean(errors[element.name]),
  );
  firstInvalid?.focus();
  return { errors };
}

/**
 * A form's `onChange`: editing a field withdraws that field's error, so a
 * corrected field stops saying it is wrong. The next submit checks it again.
 * (`aria-invalid` and `aria-describedby` follow, because they come from the
 * same error.)
 */
export function clearErrorOnEdit(
  setErrors: Dispatch<SetStateAction<FieldErrors>>,
) {
  return (event: FormEvent<HTMLFormElement>) => {
    const { name } = event.target as HTMLInputElement;
    if (!name) return;
    setErrors((errors) =>
      errors[name] ? { ...errors, [name]: undefined } : errors,
    );
  };
}
