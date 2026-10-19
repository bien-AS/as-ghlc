---
status: accepted
---

# Google sign-in for provisioned Authority Solutions staff only

The app is internal. On the 9 October call Zachery set it: no sign-up, Google accounts only. The owner chose, on 14 October, Google sign-in checked on the server over SAML SSO: SAML needs a Workspace admin to set up a SAML app and a paid Supabase tier, and adds nothing for a handful of staff.

A person gets in only when all of these hold, checked on the server in `/auth/callback` and again by every guard:

1. Google verified the address, and it ends in `@authoritysolutions.com`.
2. An admin has provisioned that address: a `profiles` row exists for it.
3. That profile is active.

Anyone else is signed out and lands on `/access-denied`. The Google `hd` parameter narrows the account chooser to the company domain, but it is a convenience; the server check is the control.

**Provisioning creates the auth user too.** When an admin adds a rep, the app creates the Supabase auth user for that email with the admin API (marked confirmed, no email sent) and writes the `profiles` row with the same id. On the person's first Google sign-in, Supabase links the Google identity to that existing user because the verified emails match. So the profile id still equals the auth user id (ADR-0005's main point), the row exists before the first sign-in, and no outgoing email, and so no SMTP provider, is needed.

The first admins (Zachery, Mitchell, Bien) are created by a seed script, not through the screen.

## Considered Options

- **Any `@authoritysolutions.com` Google account.** Rejected: the whole company would see leads and invoices. Mitchell's requirement is that new reps cannot "jack up anything".
- **SAML SSO.** Rejected: see above.
- **Keep email and password.** Rejected: Zachery ruled it out, and it needs an email provider.

## Consequences

- Supersedes ADR-0004 (open sign-up). Amends ADR-0005: the row is created at provisioning, not at a profile-setup form; there is no profile-setup screen.
- Sign-up, password reset and profile setup screens are deleted.
- Deactivating a rep sets the profile inactive and revokes their sessions; their next request is refused.
- Unverified until tested against the real project: that Supabase links the Google identity to a pre-created user with the same email. If it does not, the fallback is a `auth_user_id` column filled at first sign-in.
- Someone with Google Workspace admin rights has to create the Google OAuth client and give its id and secret to the Supabase project.
