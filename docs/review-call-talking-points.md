# Build packet review call: what Bien says

Written 14 October 2026 for the rescheduled review call. Short enough to read from.

## 1. Where I stand

- I have read the whole packet: product doc, screen registry, build plan, GHL workstream, onboarding.
- I am following the packet's product: an internal AS tool on top of GHL, one workspace, admin and rep, 36 screens, 18 sessions. The earlier "Dealwright" multi-CRM idea is dropped.
- The app is being reskinned to the Vantage design system.

## 2. Hours and dates

- **20 hours a week** on this build, alongside TopicVane. The packet assumed 30.
- The packet estimates 59 session-hours to M1 and 47 more to M2. At 20 hours a week:
  - **M1 Demoable: about 3 weeks after the build clock starts.**
  - **M2 Internal GA: about 6 weeks after the clock starts. I am committing to 7**, because Fathom matching and the
    invoice date logic are both unproven.
- If the clock starts the day after this call, count the weeks from there. Mitchell: plan rep hiring against the
  7-week date, not the 6.
- These dates hold only if the inputs in section 4 arrive on time.

## 3. Where I differ from the packet, and why (needs Zachery's yes)

| Packet says                        | I propose                                                                               | Why                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New repo from vantage-next-starter | Keep the existing repo and transfer it to `Authority-Solutions/as-sales-app`            | Auth, shell and three screens already work. The starter is on Next 14; I would rather stay on a current Next.                                            |
| Next 14, React 18, Tailwind 3      | Next 16, React 19, Tailwind 4                                                           | Same reason. Tested on 14 October: the design system's sidebar, top bar, table and tiles build and render here in both themes.                           |
| npm                                | pnpm                                                                                    | Already set up; no effect on anyone else.                                                                                                                |
| RLS policies are the access model  | RLS on and default-deny on every table, but access is enforced in the server data layer | Drizzle's connection bypasses RLS, so policies would not actually protect the queries. I keep the isolation test: a rep cannot read another rep's leads. |
| Design system v6.11.0              | Whatever tag Zachery confirms                                                           | The newest tag in the repo is v6.7.6. v6.11.0 does not exist yet.                                                                                        |

Everything else is as the packet says: Drizzle, Inngest, OpenRouter, Google sign-in for `@authoritysolutions.com`
with admin-provisioned users only, the screen registry as the source of truth, the registry routes.

## 4. What I need, and from whom

- **Zachery:** approval of section 3. Rights to transfer the repo into the org. Membership of the john.smith Supabase
  org and the Vercel AS team. The correct design system tag. OpenRouter, Fathom and Inngest keys. SPT credentials
  before S12. The Invoice Ninja date-logic verdict.
- **Zachery, on tooling:** the onboarding assumes Mac or Linux. My machine is Windows: no `python3` command and no
  Bun yet. Does gstack support Windows, or should I run it under WSL?
- **Lee:** the private integration token, scopes and dev-location webhooks before S6. The exact list of webhook
  events and their payloads. The calendar embed code before S10.
- **Mitchell and Zachery:** the Presenton templates. Who hosts the Presenton service.
- **Whoever owns Typeform:** access, so I can make the historical export by S8.

## 5. On the caching question Mitchell raised

It is already in the design. Leads are stored in our own Supabase database. GHL sends changes by webhook, and no
screen waits on GHL when a rep clicks. I am adding a nightly job that re-reads GHL and fixes anything a webhook
missed, so the two never drift apart silently.

## 6. Questions I still need answered

1. Lee: when a suspect lead already has a booking, is it kept until a rep reviews it?
2. Lee: which workflow fires when the app writes a stage, so a client never gets two emails?
3. Zachery: does Smart Pricing Table's API actually send a signature webhook, or do we poll?
4. Mitchell: what separates the one-time invoice from the recurring one, and what are the date rules?
5. Zachery: which six notification types ship, and who receives each?
6. Zachery: does a rep see "GoHighLevel" named in the sync log, or is that admin-only?
