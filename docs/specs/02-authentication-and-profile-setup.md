---
title: Authentication and profile setup
status: ready
blocked_by: []
owner_to_ask: []
build_now: true
---

# 02. Authentication and profile setup

**Purpose:** let anyone create an account, prove they control their mailbox, complete a profile and reach the dashboard. It serves every person who will use ASCRM.

Decisions behind this spec: ADR-0002 (Supabase Auth for identity), ADR-0004 (open sign-up), ADR-0005 (User row created at profile setup, sharing its id with the auth user).

User-facing text on these screens and in the emails uses the product's public name, Dealwright.

## Problem Statement

There is no way into the app. A person cannot create an account, sign in, recover a forgotten password or sign out, and the app has no record of who a signed-in person is.

## Solution

Four public forms, two routes that receive people returning from outside, and one gate.

- **Sign up** with first name, last name, email and password, confirmed by a link sent to the mailbox; or with Google.
- **Sign in** with email and password, or with Google.
- **Reset password** by a link sent to the mailbox.
- **Profile setup**: the gate. A signed-in person with no User row is always sent to profile setup and cannot use the dashboard until a User row exists. Creating it is what profile setup does.
- **Sign out** from the dashboard.

Sign-up is open to anyone (ADR-0004). Email confirmation and password reset use emailed **links**, not typed codes. Magic-link sign-in is not offered. Google sign-ins never receive a confirmation email.

### Routes

| Route                    | What it is                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`               | Email and password form, "Continue with Google", links to sign up and reset password                                                                     |
| `/sign-up`               | First name, last name, email, password form, "Continue with Google", link to sign in. After submit: the "Check your email" state                         |
| `/reset-password`        | Email form that requests a reset link                                                                                                                    |
| `/reset-password/update` | New password form, reached from the reset link                                                                                                           |
| `/profile-setup`         | First name and last name form; email shown read-only                                                                                                     |
| `/auth/confirm`          | No screen. Where every emailed link lands (sign-up confirmation and password reset). Verifies the link on the server, establishes the session, redirects |
| `/auth/callback`         | No screen. Where Google returns. Completes the sign-in on the server, establishes the session, redirects                                                 |
| `/dashboard` and below   | The app (spec 04)                                                                                                                                        |

### Who is sent where

"Signed in" means a verified Supabase session. "Has a profile" means a User row exists with that session's user id. **A person who has signed up but not confirmed has no session**: for every row below they are "signed out".

| Route                       | Signed out (including unconfirmed)                                    | Signed in, no profile                                       | Signed in, has a profile |
| --------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------ |
| `/`                         | Shows the landing page                                                | Shows the landing page                                      | Shows the landing page   |
| `/sign-in`, `/sign-up`      | Shows the form                                                        | Redirect to `/profile-setup`                                | Redirect to `/dashboard` |
| `/reset-password`           | Shows the form                                                        | Redirect to `/profile-setup`                                | Redirect to `/dashboard` |
| `/reset-password/update`    | Redirect to `/reset-password` with the "link no longer valid" message | Shows the form                                              | Shows the form           |
| `/profile-setup`            | Redirect to `/sign-in`                                                | Shows the form, or creates the profile silently (see below) | Redirect to `/dashboard` |
| `/dashboard` and below      | Redirect to `/sign-in`, remembering the page                          | Redirect to `/profile-setup`                                | Shows the page           |
| `/api/*` (application data) | Refused as unauthenticated                                            | Refused as "profile required"                               | Served                   |

After sign-in, a person who was redirected from a dashboard page is returned to that page. The remembered destination is honoured only when it is a path inside this app; anything else is ignored and `/dashboard` is used.

### Email sign-up and confirmation, end to end

1. **Submit.** The person enters first name, last name, email and password on `/sign-up` and submits.
2. **Account created, unconfirmed.** The app creates the auth user through Supabase Auth with the two names attached to it. No session exists. No User row exists.
3. **"Check your email".** The form is replaced by a state that names the address the link was sent to and offers:
   - **Resend email.** Sends the confirmation again. After each send the control is unavailable for 60 seconds and shows the time remaining, matching Supabase's limit of one confirmation email per address per 60 seconds. If Supabase still refuses for sending too often, the person sees "Too many emails sent. Wait a few minutes and try again."
   - **Use a different email.** Returns to the sign-up form with first name, last name and email filled in and the password empty, so a mistyped address can be corrected and submitted again. The account made with the mistyped address stays unconfirmed and unusable.
   - A line of help: "No email after a few minutes? Check spam. If you already have an account, sign in, continue with Google, or reset your password."
   - The same state is shown whether or not the address was already registered (see Edge cases).
   - Reloading the page returns to the empty sign-up form; the person can still get a new link by signing in (step "Signing in before confirming").
4. **The email.** Sent by Supabase Auth, from Dealwright, containing one link. The link points at `/auth/confirm` in **our** app, in the environment the person signed up in, and carries a token hash and a type.
5. **Clicking the link.** `/auth/confirm` verifies the token hash with Supabase on the server. On success the address is confirmed and a session is established in the browser that opened the link, which need not be the browser that signed up.
6. **Profile rule.** The route redirects to `/dashboard`. The dashboard gate finds no User row and sends the person to `/profile-setup`, which applies the rule below: names are known from sign-up, so the User row is created with id equal to the auth user id and the person lands on `/dashboard` without seeing a form. If either name is somehow missing, the profile setup form is shown instead.

### Failure and edge cases for emailed links

Supabase reports an expired link, an already-used link and an invalid or altered link the same way, so the app cannot tell them apart and shows one message for all three.

| Case                                                        | What the person sees                                                                                                                                                                                      | What they can do                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Confirmation link expired                                   | Redirected to `/sign-in` with: "That link is no longer valid. It may have expired or already been used. If you have confirmed your email, sign in. If not, sign in and we will offer to send a new link." | Sign in with email and password; if unconfirmed, the sign-in form offers Resend (below). |
| Confirmation link already used                              | The same message.                                                                                                                                                                                         | Sign in. The address is already confirmed, so sign-in works.                             |
| Confirmation link invalid or tampered                       | The same message.                                                                                                                                                                                         | Sign in, or sign up again.                                                               |
| Link missing its token or type                              | The same message.                                                                                                                                                                                         | The same.                                                                                |
| Link opened in a different browser or device                | It works. The session is established in the browser that opened the link, and the profile rule runs there. The original tab still shows "Check your email" and has no session.                            | Carry on in the browser that opened the link. In the original browser, sign in.          |
| Link opened while someone else is signed in on that browser | The session becomes that of the person the link belongs to.                                                                                                                                               | Nothing needed.                                                                          |
| Reset link expired, used, invalid or tampered               | Redirected to `/reset-password` with: "That link is no longer valid. It may have expired or already been used. Request a new one."                                                                        | Request a new link.                                                                      |
| Reset link opened in a different browser or device          | It works, as for confirmation.                                                                                                                                                                            | Set the new password there.                                                              |
| The link's remembered destination points outside the app    | The link still verifies; the destination is ignored.                                                                                                                                                      | Lands on `/dashboard`.                                                                   |

### Signing in before confirming

A person who signed up but has not confirmed, and who enters the right email and password on `/sign-in`, is refused by Supabase with a "not confirmed" error. They see: "Confirm your email to sign in. We sent a link to {address}." with **Resend email**, which behaves exactly as on the "Check your email" state (60-second wait, rate-limit message). No session is created.

The app reveals nothing about whether an account exists beyond what Supabase itself reveals: any other failed sign-in, including an unknown address or a wrong password, shows the single message "Email or password is incorrect."

### Signing up with an address that is already known

In every case below the person sees the **same "Check your email" state**. The app never says "this address is already registered".

| Existing account for the address    | What Supabase does                                                                                                               | Source                                       | What the person can do                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Email and password, **confirmed**   | Returns a response that looks like success but hides the account; sends no email.                                                | Supabase docs; **unverified** in our project | No email arrives. The help line points them to sign in or reset their password.                          |
| Email and password, **unconfirmed** | Believed to send the confirmation email again. Whether the newly typed password and names replace the earlier ones is not known. | **Unverified**                               | Click the link in the newest email. If sign-in then fails, reset the password.                           |
| **Google only**                     | Returns the same hidden-account response; sends no verification email.                                                           | Supabase docs                                | No email arrives. The help line points them to continue with Google, or reset their password to add one. |

### Email sign-in

The person enters email and password. On success they go to the remembered page or `/dashboard`, and the gate applies.

### Google sign-in

"Continue with Google" appears on both `/sign-in` and `/sign-up` and behaves the same on each. **No confirmation email is sent at any point**; Google has already verified the address.

- **First time:** Google returns to `/auth/callback`, which establishes the session. There is no User row, so the person is **always** shown the profile setup form, with first and last name prefilled from the Google profile where Google supplies them, and the email shown read-only. Submitting creates the User row and goes to `/dashboard`.
- **Returning:** the User row exists, so the person goes straight to the remembered page or `/dashboard`.
- **Cancelled or failed at Google:** the person returns to `/sign-in` with "Google sign-in did not complete. Try again."
- **Google must finish in the browser that started it.** This is inherent to how the Google flow is secured and is not something a person normally encounters.

**Google with an address that already has an email and password account:**

| Existing account                    | What Supabase does                                                                                                                      | Source        | Result for the person                                                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email and password, **confirmed**   | Links the Google identity to the existing auth user. Same user id.                                                                      | Supabase docs | If they already have a profile, they land on `/dashboard`. They can now sign in either way.                                                                                                                      |
| Email and password, **unconfirmed** | Links Google to the existing auth user and removes that user's unconfirmed identities, so the never-confirmed password no longer works. | Supabase docs | They are signed in through Google with no profile, so they see the profile setup form. Whether the names typed at sign-up survive for prefilling is **unverified**. They can add a password later through reset. |

### Profile setup

- Fields: first name, last name. Both required. The email comes from the session and is shown, not edited.
- Creating the profile writes the User row with **id equal to the Supabase auth user's id**, the session's email, and the two names. The id and email are never read from the form.
- **The silent path:** when the session was established by an emailed confirmation link or by email and password, **and** the auth user carries both names from the sign-up form, the row is created on arrival and the form is not shown. A session established through Google never takes the silent path, even if names are available.
- Submitting twice, or arriving when the row already exists, is harmless: the person goes to `/dashboard`.
- A person on this form can sign out.

### Password reset

The same pattern as confirmation: an emailed link into our app.

1. On `/reset-password` the person enters an email and submits.
2. The page always shows "If an account exists for {address}, we have sent a link to reset your password", whatever the address. A second request for the same address within 60 seconds is refused by Supabase; the page then says "We sent a link a moment ago. Wait a minute before asking again."
3. The email contains one link to `/auth/confirm` in our app, carrying a token hash and the recovery type.
4. `/auth/confirm` verifies it on the server, establishes a session and redirects to `/reset-password/update`.
5. The person enters a new password and submits. On success they stay signed in and go to `/dashboard`; the gate applies. Choosing the password they already had is refused with "Choose a password you have not used for this account."
6. Expired, used and invalid links are handled as in the table above.
7. A person who requests a reset for an address that has never been confirmed: the handling is **unverified**. The neutral message is shown regardless.

### Sign-out

A sign-out control in the dashboard shell (spec 04) and on the profile setup form ends the session and goes to `/`. Cached data from the signed-in session is cleared so the next person at the same browser sees none of it.

## States

| Screen                            | Loading                                                                                                                    | Error                                                                                                                                                                                                                                      | Empty or other                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Sign in                           | Submit shows progress and is disabled; fields locked                                                                       | "Email or password is incorrect"; "Confirm your email to sign in" with Resend; "Too many attempts, try again in a few minutes"; "Google sign-in did not complete"; network failure with retry. The email is kept; the password is cleared. | May open with a notice carried from a redirect: link no longer valid, or signed out.                       |
| Sign up                           | As above                                                                                                                   | Field errors beside each field: name missing, email malformed, password too short or too weak. Too many attempts; network failure. Values are kept except the password.                                                                    | Success replaces the form with "Check your email".                                                         |
| Check your email                  | Resend shows progress, then "Sent" and a 60-second countdown                                                               | "Too many emails sent. Wait a few minutes and try again."; network failure with retry.                                                                                                                                                     | Use a different email returns to the form with values kept.                                                |
| Reset password (request)          | As Sign in                                                                                                                 | Email malformed; asked again too soon; too many attempts; network failure.                                                                                                                                                                 | Success shows the neutral "if an account exists" message. May open with the "link no longer valid" notice. |
| Reset password (update)           | As Sign in                                                                                                                 | Password too short or too weak; same as the current password; session gone (redirect to the request form with the notice); network failure.                                                                                                | None.                                                                                                      |
| Profile setup                     | Submit shows progress. During the silent path the page shows a brief "Setting up your account" state, never an empty form. | Name missing; could not save, with retry; another profile already uses this email (ask the person to sign in the way they did originally).                                                                                                 | Prefilled from Google when names are supplied; blank fields otherwise.                                     |
| `/auth/confirm`, `/auth/callback` | No screen. A blank or neutral loading response at most.                                                                    | Never show an error page of their own; they redirect to `/sign-in` or `/reset-password` with a notice.                                                                                                                                     | None.                                                                                                      |

All forms: errors are announced to assistive technology, the first invalid field receives focus, and Enter submits. Notices carried by a redirect are identified by a short code in the address, never by free text and never with the person's email.

## Data

| Entity                        | Read                                                                                                      | Written                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase auth user (not ours) | Session, user id, email, how the session was established, names attached at sign-up or supplied by Google | Created at sign-up or first Google sign-in. Confirmed by the emailed link. Password changed at reset. All through Supabase Auth, never Prisma. |
| User                          | By id, on every protected request, to decide "has a profile"                                              | Created once at profile setup: id (from the session), email (from the session), firstName, lastName (from the form or from sign-up)            |

No other entity is touched. The User model's fields are those that exist today: id, firstName, lastName, email. The data model sketch's other User fields (workspace, role, external CRM user ID) are not added here; they belong to spec 12.

## Assumptions

- **Question 7** (roles and the sign-in rule): this build has no roles and no allowed-domain or invite rule. Sign-up is open by owner decision (ADR-0004). The handoff's proposed rule is deferred to spec 12, not dropped.
- **Question 9** (kind of product): no Workspace exists yet, so a User belongs to none.
- **Email sender, not decided.** Supabase's built-in mailer is for testing only: it sends at most 2 emails an hour and only to members of the Supabase project's team. Open sign-up cannot work for real people on it. A custom SMTP provider is needed before any real user signs up. Which provider is not decided and is not chosen here.
- **Link lifetime.** Confirmation and reset links are single-use and expire. The lifetime is a Supabase project setting, believed to default to one hour. **Unverified**; check the project's setting.
- **Mail scanners.** Some mail systems open links automatically to check them, which can use up a single-use link before the person clicks it. Supabase documents this and suggests sending the person to an intermediate page with a button. That page is **not** built; if "link no longer valid" reports come from people who clicked once, add it.
- **One Supabase project serves every environment** is assumed, which is why links are built from the environment's own address. If each environment gets its own project, the per-environment configuration below simplifies.
- **Supabase behaviours marked unverified** in the tables above were not confirmed from the documentation and must be checked by hand against the real project before release.
- Automatic linking of a Google identity to an existing account with the same verified address is Supabase's default and is assumed left on.
- Password minimum length: assumed 8 characters, set in the Supabase project so that the form and Supabase agree. Proposed.
- The landing page stays visible to signed-in visitors rather than redirecting them. Proposed.
- Rate limits are Supabase Auth's; the app adds none of its own.

## Acceptance checks

To run by hand against a real Supabase project with email delivery working.

**Confirmation path**

1. Submit `/sign-up` with a new address. The "Check your email" state appears and names that address. In Supabase the user exists and is unconfirmed. No User row exists.
2. Without confirming, load `/dashboard` and `/profile-setup`: both redirect to `/sign-in`.
3. Without confirming, sign in with the right password: "Confirm your email to sign in" appears with Resend. With a wrong password: "Email or password is incorrect".
4. The email arrives from Dealwright with one link, and the link's address is `/auth/confirm` on the same environment that was used to sign up (repeat on local, a preview deployment and production).
5. Click the link. You land on `/dashboard` without seeing the profile form. A User row exists whose id equals the Supabase auth user id, with the names and email from sign-up.
6. Click the same link again: you land on `/sign-in` with the "link no longer valid" notice. Signing in works.
7. **Resend:** sign up with another address, press Resend. A second email arrives; the control counts down 60 seconds and cannot be pressed meanwhile. The link in the newest email confirms the account.
8. **Expired link:** sign up, set the link lifetime in the Supabase project to its minimum (or wait it out), then click the link. You land on `/sign-in` with the notice. Signing in offers Resend; the new link works.
9. **Tampered link:** change one character of the token in the link. You land on `/sign-in` with the notice; no session exists.
10. **Different browser:** sign up in one browser, open the link in another (or on a phone). You land on `/dashboard` there, signed in, with the User row created.
11. **Wrong address:** sign up with a mistyped address, press Use a different email. The form returns with names and email filled; correcting and submitting shows "Check your email" naming the corrected address.
12. **Missing names:** remove the names from an unconfirmed user in Supabase, then click its link. The profile setup form appears instead of the dashboard.

**Already-known addresses**

13. Sign up again with a confirmed address: the same "Check your email" state appears; no account is changed. Record whether an email arrives (expected: none).
14. Sign up again with an unconfirmed address: the same state appears. Record whether an email arrives and which password works after confirming.
15. Sign up with email and password using an address that has only a Google account: the same state appears; expected no email. Continue with Google still works.
16. Continue with Google using an address that has a confirmed email and password account: you land on `/dashboard` as the same user (same id); the password still works afterwards.
17. Continue with Google using an address that has an unconfirmed email and password account: the profile setup form appears; afterwards the old password does not sign in.

**Google**

18. First-time Google sign-in shows the profile setup form with names prefilled and email read-only; no confirmation email is received; submitting creates the User row with id equal to the auth user id and reaches `/dashboard`.
19. The same Google account next time goes straight to `/dashboard`.
20. Cancelling at Google returns to `/sign-in` with the notice.

**Reset**

21. Request a reset for a known and for an unknown address: the message is identical. Asking twice within a minute shows the wait message.
22. The reset email's link goes to `/auth/confirm` on the same environment; clicking it lands on `/reset-password/update`; setting a new password ends on `/dashboard`; the old password no longer works.
23. Click the reset link a second time, and click an altered one: both land on `/reset-password` with the notice.

**Gate, redirects, sign-out**

24. Delete a User row while its owner is signed in, then load a `/dashboard` page: redirect to `/profile-setup`. Call an application API route in that state: refused, not served.
25. Load `/dashboard/anything` signed out: redirect to `/sign-in`; after signing in you are on that page.
26. Signed in with a profile, visit `/sign-in`, `/sign-up`, `/reset-password` and `/profile-setup`: each lands on `/dashboard`.
27. A link whose remembered destination points at another site ends on `/dashboard`.
28. Send a different id or email in the profile setup request: the row is created with the session's id and email.
29. Submit profile setup twice: one row, no error.
30. Sign out: you land on `/`; Back does not reveal dashboard data; `/dashboard` redirects to `/sign-in`.
31. Every form shows its loading state while submitting and cannot be submitted twice.
32. No screen or email in this spec says "ASCRM" or names a CRM.

## User Stories

1. As a visitor, I want to sign up with my email and a password, so that I can have an account without a Google account.
2. As a visitor, I want to give my first and last name when I sign up, so that I am not asked again after confirming.
3. As a visitor, I want a confirmation link by email, so that nobody can register my address without me.
4. As a visitor, I want the "check your email" screen to name the address it used, so that I can spot a typo.
5. As a visitor who mistyped my address, I want to correct it without retyping my name, so that I can fix the mistake quickly.
6. As a visitor who did not get the email, I want to resend it, so that I am not stuck.
7. As a visitor pressing resend, I want to see when I can press it again, so that I do not think it is broken.
8. As a visitor who hit a sending limit, I want to be told to wait, so that I know it is not my fault.
9. As a visitor, I want a hint about spam folders and other ways in, so that I can help myself if no email comes.
10. As a new user, I want the confirmation link to take me straight into the app, so that I do not have to sign in again.
11. As a new user, I want to confirm on my phone even though I signed up on my laptop, so that I can use whichever device has my mail.
12. As a new user whose link expired, I want to be told plainly and offered a new one, so that I can still get in.
13. As a new user who clicked the link twice, I want to be told to just sign in, so that I am not alarmed.
14. As a person with an unconfirmed account, I want sign-in to tell me to confirm rather than "wrong password", so that I know why I cannot get in.
15. As a person with an unconfirmed account, I want to resend the link from the sign-in screen, so that I do not have to sign up again.
16. As a person with an unconfirmed account, I want protected pages to send me to sign in, so that it is clear I am not in yet.
17. As a person who forgot they already have an account, I want signing up again to be harmless, so that my existing account is untouched.
18. As a visitor, I want to sign up with Google, so that I do not need another password.
19. As a Google user, I do not want a confirmation email, so that I am not asked to prove an address Google already verified.
20. As a first-time Google user, I want to check my name before my profile is created, so that it is right from the start.
21. As a first-time Google user, I want my name prefilled, so that setup takes one click.
22. As a returning Google user, I want to skip setup, so that I am not asked for what I already gave.
23. As a person who signed up with a password and later uses Google with the same address, I want to reach the same account, so that I do not end up with two.
24. As a user, I want to sign in with my email and password, so that I can get back to my work.
25. As a user who forgot my password, I want a reset link by email, so that I can regain access.
26. As a user resetting my password, I want the link to open the new-password form directly, so that there are no extra steps.
27. As a user resetting my password, I want to be signed in once I set it, so that I can carry on.
28. As a user with an expired or used reset link, I want to be told and offered a new one, so that I know what to do.
29. As a user, I want to sign out, so that nobody else at my computer can use my account.
30. As a user, I want to return to the page I asked for after signing in, so that links to a lead still work.
31. As a signed-in user, I want sign-in and sign-up pages to send me to the dashboard, so that I am not shown forms I do not need.
32. As a signed-in person with no profile, I want to be taken to profile setup wherever I go, so that I cannot end up in a half-working app.
33. As a person on the profile setup form, I want to be able to sign out, so that I can switch accounts.
34. As a user, I want my typed email kept when a submit fails, so that I do not retype it.
35. As a user, I want the button to show that something is happening, so that I do not submit twice.
36. As a user of assistive technology, I want errors announced and focus moved to the problem, so that I can correct it.
37. As an account holder, I want sign-up, sign-in and reset forms not to reveal whether my address is registered, so that my use of the product is private.
38. As the project lead, I want sign-up open to anyone, so that the product can grow without invites.
39. As the project lead, I want emails to carry the product's public name, so that people recognise who wrote to them.
40. As a developer, I want every emailed link to land on one route in our app, so that confirmation and reset are verified in one place.
41. As a developer, I want links to return to the environment that sent them, so that previews and local work can be tested.
42. As a developer, I want the User id to equal the auth user id, so that resolving the current user is one read.
43. As a developer, I want one place that decides "signed in" and "has a profile", so that every page and API route agrees.
44. As a developer, I want the id and email taken only from the session, so that a client cannot create a profile for someone else.
45. As a developer, I want unverified Supabase behaviours listed, so that I check them before release instead of trusting a guess.

## Implementation Decisions

- **Identity provider.** Supabase Auth, with the email provider (password sign-in, "confirm email" on) and the Google provider enabled. Magic link is not offered. The Supabase client is used for auth only (ADR-0002). The installed versions are `@supabase/ssr` 0.12 and `@supabase/supabase-js` 2.x, which use the publishable key already present in the environment configuration.
- **Emailed links: token hash verified by our route.** Decision: the confirmation and reset emails each carry a link to `/auth/confirm` with a token hash and a type, and that route verifies the token hash with Supabase on the server to obtain the session. The alternative, a link that returns a one-time code which our route exchanges, was not chosen: that exchange depends on a secret stored in the browser that started the flow, so it fails when the link is opened in another browser or on another device, which is common for email. The token-hash mechanism is the one Supabase documents for server-side rendering.
- **Google: code exchanged by our route.** Google returns to `/auth/callback` with a one-time code, which the route exchanges on the server for a session. The code is short-lived, single-use and tied to the browser that started the sign-in.
- **Two return routes, not one**, because the two mechanisms differ: `/auth/confirm` for emailed links (token hash and type) and `/auth/callback` for Google (code). Both are Route Handlers that accept GET, set the session cookies and redirect; neither renders a page.
- **`/auth/confirm` behaviour.** Requires a token hash and a type of "email" (confirmation) or "recovery" (reset); anything else is treated as an invalid link. On success: recovery goes to `/reset-password/update`; confirmation goes to the remembered in-app destination or `/dashboard`. On any failure: recovery goes to `/reset-password`, everything else to `/sign-in`, each with the notice code.
- **Links return to the environment that sent them.** Sign-up, resend and reset requests each pass a redirect address built from the current environment's own origin and pointing at `/auth/confirm`. The email templates build their link from that redirect address rather than from the project's single site URL, as the Supabase redirect documentation advises when a redirect address is supplied.
- **Supabase project configuration** required outside the code:
  - **Email templates.** "Confirm signup" and "Reset password" are changed from Supabase's default link to a link to `/auth/confirm` carrying the token hash and the type ("email" and "recovery" respectively). Both templates use the name Dealwright.
  - **Site URL** is the production address.
  - **Redirect allow-list**, one entry per environment: local (`http://localhost:3000/**`), preview (a wildcard pattern for the Vercel preview addresses of this team) and production. A redirect address not on the list is rejected by Supabase.
  - **Google provider** credentials, with Supabase's own callback address registered at Google.
  - **Confirm email** on; minimum password length 8; link lifetime reviewed.
  - **Custom SMTP** before real users (see Assumptions).
- **User id.** The User row's id is the Supabase auth user id (ADR-0005). The schema's generated default for User.id is removed; the id is always supplied from the verified session. No separate auth-id column is added. Email stays unique.
- **Names at email sign-up** are stored on the auth user as sign-up metadata, under keys of our own choosing that Google does not use, and read back at profile setup.
- **Current-user resolver.** One data-access function verifies the session with Supabase on the server and reads the User row by id. It returns one of three results: signed out, signed in without a profile, or the User. Every protected page, the profile setup page and every application data-access function use it. This is the "authenticated user" guard of ADR-0002; the ownership half of that guard has nothing to check yet (see Further Notes).
- **Profile creation.** One data-access function creates the User row from the session's id and email plus first and last name. It is safe to call twice. A unique-email conflict with a different id is reported as its own error.
- **Silent path.** Decided on the server when `/profile-setup` is requested: the session was not established through Google, both of our name keys are present on the auth user, and no User row exists. It calls the same profile creation function, then redirects to `/dashboard`. The rule lives in this one place; the return routes do not create profiles.
- **API routes** (ADR-0003), each validated by a shared zod schema:
  - `GET /api/me` returns the current User, or the "profile required" refusal, or the unauthenticated refusal.
  - `POST /api/profile` with `firstName` and `lastName` creates the User row. It accepts nothing else.
- **Refusal contract.** Application API routes answer unauthenticated requests with 401 and requests from a signed-in person without a profile with 403 and a machine-readable code meaning "profile required". Client hooks treat the first as "go to sign in" and the second as "go to profile setup".
- **Hooks.** Client calls live in custom TanStack Query hooks (ADR-0001): a current-user query, and mutations for sign up, resend confirmation, sign in with password, sign in with Google, request reset, update password, create profile and sign out. The auth mutations call Supabase Auth from the browser; the profile mutation and current-user query call our Route Handlers. No component calls Supabase or `fetch` directly.
- **Error mapping.** One function turns Supabase Auth's error codes into the messages in this spec: not confirmed, invalid credentials, email send rate limit, request rate limit, weak password, same password, and a generic fallback. Unknown codes never show raw text from Supabase.
- **Resend wait** is a 60-second countdown held in the page, started after sign-up and after each resend.
- **Session refresh.** Sessions are refreshed on each request using the framework's request-interception convention, which Supabase's guide calls a proxy. This convention differs from earlier versions of Next.js; read the installed Next.js documentation before building it (AGENTS.md). Identity is verified on the server on every request with the method Supabase's current guide recommends for protecting pages, never by trusting a client-sent id.
- **Redirect rules** in the table above are decided by one function of route and session state, and enforced on the server before any protected content is rendered.
- **Return destination.** Carried as a query parameter. Only same-app paths are honoured. No personal data is placed in any address.
- **Form validation.** One zod schema per form, shared by the form and, where a Route Handler exists, by the handler. Rules: names non-empty after trimming, at most 100 characters; email well-formed; password at least 8 characters (assumed).
- **Sign-out** clears the TanStack Query cache.
- **Dependencies.** `@tanstack/react-query` and `zod` are not installed yet and must be added at build time.
- **Styling** uses spec 03's components. The auth screens share one centred single-panel layout with the Dealwright wordmark linking to `/`.

## Testing Decisions

_Seams confirmed by the owner: data-access functions and Route Handlers through their public behaviour with Vitest; pages through Testing Library at page level; no end-to-end browser suite yet._

A good test exercises public behaviour: what a function returns for a given session and database state, what a route answers, what a person sees on a page. It does not assert on internals or re-test Supabase.

**Testable at the confirmed seams** (Supabase Auth is the one thing stubbed, at its client boundary):

- **Data-access functions** (current-user resolver, profile creation): signed out, signed in without a row, signed in with a row; creation uses the session's id and email and ignores any others; calling creation twice yields one row; email conflict is reported distinctly.
- **Route Handlers** `GET /api/me` and `POST /api/profile`: 401, 403 with the "profile required" code, success, rejection of invalid or extra input.
- **Route Handler `/auth/confirm`:** with Supabase's verification stubbed to succeed, a confirmation link redirects to `/dashboard` or the remembered in-app path and a recovery link to `/reset-password/update`; with it stubbed to fail, each redirects to the right page with the notice code; a missing token, missing type, unknown type and an outside destination are each handled as specified.
- **Route Handler `/auth/callback`:** success, failure and missing-code redirects, and the outside-destination case.
- **The redirect-decision function:** every cell of the "who is sent where" table.
- **The silent-path rule:** email session with both names creates the row; Google session never does; a missing name shows the form.
- **The error-mapping function:** each Supabase error code yields the specified message.
- **Pages, with Testing Library:** sign-up validation and the switch to "Check your email" naming the address; Resend's progress, countdown and rate-limit message (with timers faked); Use a different email restoring the fields; sign-in's "not confirmed" state with Resend and its single message for other failures; the reset request's neutral message; the update form's errors; profile setup prefilled and blank; notices shown from a redirect code; loading and disabled states.

**Only checkable by hand against a real Supabase project** (acceptance checks 1 to 23):

- That an email is actually sent, by whom, with the right name and link, in each environment.
- That the templates and the redirect allow-list are configured so links land on `/auth/confirm` in local, preview and production.
- That a real token verifies, expires and is single-use, and that it works in a different browser.
- Supabase's handling of already-registered addresses and of Google meeting an existing account, including every point marked unverified.
- The Google consent screen and round trip.
- Real rate limits.

Prior art: none in the repo.

## Out of Scope

- Roles, Workspaces, membership, invites, allowed email domains (spec 12).
- Matching a user to a CRM user (specs 11 and 12).
- Magic-link sign-in, typed one-time codes, other social providers, single sign-on, two-factor authentication.
- Editing a profile after setup, changing email, changing password while signed in, deleting an account.
- Cleaning up accounts that were never confirmed.
- An intermediate "press to confirm" page for mail scanners (see Assumptions).
- Choosing or configuring the SMTP provider.
- Custom-designed email layouts beyond the product name and the corrected link.
- Paywall or billing.
- Privacy policy and terms acceptance at sign-up (raised as open in spec 01).

## Further Notes

- **Mechanism decision and sources.** Emailed links carry a token hash verified by our route; Google returns a code exchanged by our route. Supabase documentation read on 7 October 2026:
  - Server-side auth for Next.js (proxy, verifying identity): https://supabase.com/docs/guides/auth/server-side/nextjs
  - Password-based auth (confirmation and reset links with token hash, `/auth/confirm`, built-in mailer limit): https://supabase.com/docs/guides/auth/passwords
  - Email templates (token hash for server-side endpoints, mail scanners consuming links): https://supabase.com/docs/guides/auth/auth-email-templates
  - PKCE flow (code tied to the starting browser, five-minute single-use code): https://supabase.com/docs/guides/auth/sessions/pkce-flow
  - Redirect URLs (site URL, allow-list, preview wildcards, redirect address in templates): https://supabase.com/docs/guides/auth/redirect-urls
  - Identity linking (Google meeting an existing account, unconfirmed identities removed, sign-up after Google): https://supabase.com/docs/guides/auth/auth-identity-linking
  - Custom SMTP (built-in mailer restrictions): https://supabase.com/docs/guides/auth/auth-smtp
  - Rate limits (60 seconds per user for confirmation and reset): https://supabase.com/docs/guides/auth/rate-limits
  - Error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
- **Not confirmed from those pages, to verify by hand:** that a token-hash link works in a different browser (it follows from the mechanism needing no browser-held secret, but no page states it outright); the default link lifetime; exactly what sign-up returns and sends for an already-confirmed and for an unconfirmed address; whether "not confirmed" is reported only when the password is right; whether sign-up names survive when Google links to an unconfirmed account; reset requests for unconfirmed addresses; and that building template links from the redirect address works for every environment with one project.
- **Conflict with ADR-0002 and AGENTS.md, recorded not resolved.** Both require an ownership check (membership of the owning tenant) after authentication. By owner decision there is no Workspace or membership yet, so the guard in this build is "authenticated and has a profile" only. That is safe only while the dashboard shows sample data (ADR-0004). The ownership check returns with spec 12.
- **Difference from the handoff.** The handoff proposed magic link or Google and no sign-up page. The owner's decision replaces magic link with email and password plus a confirmation link, and adds open sign-up. Confirmation preserves the handoff's intent that sign-in proves control of the mailbox.
- A Google-only account that completes a password reset gains a password. Accepted.
