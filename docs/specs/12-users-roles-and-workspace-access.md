---
title: Users, roles and workspace access
status: needs-clarification
blocked_by:
  - question 7
  - question 9
owner_to_ask:
  - Zach
  - Mitchell
build_now: false
---

# 12. Users, roles and workspace access

**Purpose:** decide who belongs to a Workspace, what each role sees and can do, and who may join. It serves admins and owners who manage access, and every user whose view depends on their role.

> **Needs clarification: questions 7 and 9.**
>
> - **Question 7:** what does each role see, and what is the sign-in rule? **Assumed: the roles table and the sign-in rule below.** The three role names are Zach's, from the 5 October meeting. What each role sees is **proposed**. Who answers: Zach.
> - **Question 9:** one shared app with a Workspace per customer, or a deployment per customer? **Assumed: shared app, Workspace per customer.** Who answers: Zach, Mitchell.
>
> **This spec holds the deferred sign-in restriction.** The handoff proposed no public sign-up, with access by allowed domain or invite. The owner has since decided sign-up is open for now (ADR-0004), so the current build has no Workspace, no membership and no roles: every authenticated user sees everything (specs 02 and 04). The proposed rule is kept here as a future restriction, not dropped. Nothing in this spec is built in the current build; the Users and roles screen is a placeholder.

## Problem Statement

In the current build, anyone who signs up sees every lead. That is acceptable only while the leads are samples. Before real leads are connected, a customer's leads must be visible only to that customer's people, a rep must see their own leads, and someone must be able to grant and remove access. There is no way to do any of that today.

## Solution

### Roles (proposed)

| Role  | Sees                                              | Can do                                                                                             |
| ----- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Staff | Leads assigned to them                            | Review suspects, present decks, qualify, build and send proposals, mark lost, check invoice drafts |
| Admin | Every lead in the Workspace, with a filter by rep | Everything staff can, plus manage users and connect the CRM                                        |
| Owner | Everything in the Workspace                       | Everything an admin can. Owner-only settings are not defined.                                      |

### Who may join a Workspace (proposed, deferred)

1. The user's email is on an allowed domain for the Workspace (for Authority Solutions, authoritysolutions.com) **or** has an invite.
2. Sign-in proves the user controls the mailbox. The handoff proposed a magic link or Google sign-in. The current build meets the same intent with Google sign-in or email and password with a confirmation link (spec 02).
3. Where the CRM has users, the app matches the user's email to a CRM user and stores that ID, so leads can be filtered by owner. For Authority Solutions this check repeats at each sign-in, so removing someone in the CRM removes them here.

How this rule meets open sign-up is not decided. Assumed: sign-up stays open, and what the rule governs is **joining a Workspace**, not creating an account. A person who signs up and matches no Workspace has an account and sees no customer's data.

### Lead ownership

For Authority Solutions, the CRM assigns each lead to a rep by round-robin and the app stores the owner it is given. Whether the app ever assigns leads itself is to be scoped.

### Users and roles screen

At `/dashboard/users`, for admins and owners only.

- **Shows:** who has access to the Workspace and their role.
- **Actions:** invite, change role, remove.

### Effect on other screens

- Pipeline (spec 05): staff see only their own leads; the rep filter is offered to admins and owners.
- Lead detail and Suspect review (specs 06, 07): staff can open and act on only their own leads.
- Notifications (spec 08): whether admins and owners are notified about leads they do not own is not decided.
- Shell (spec 04): Users and roles, and Settings and integrations, appear only for admins and owners.

## States

| State                   | Behaviour                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Loading                 | Skeleton rows in the users list.                                                                                                   |
| Empty                   | Cannot be fully empty: the viewer is always listed. With no one else: "You are the only person here", with Invite.                 |
| Error                   | Error state with Try again.                                                                                                        |
| Invite pending          | Listed with the invited address and a pending mark; can be revoked or sent again.                                                  |
| Invite failed           | The address is kept and an error says the invite could not be sent.                                                                |
| Signed in, no Workspace | The person has an account but belongs to no Workspace. They see a screen saying so, and no customer's data.                        |
| Not allowed             | A staff user who opens the Users and roles address is told they do not have access. The API refuses, independently of the screen.  |
| Removed while signed in | Their next request is refused and they land on the "no Workspace" screen.                                                          |
| Last owner              | The only owner cannot be removed or demoted.                                                                                       |
| No matching CRM user    | Assumed: the user can sign in but owns no leads. For Authority Solutions the proposed rule would instead deny access. Not decided. |

## Data

| Entity     | Read                                                | Written                                                           |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Workspace  | name, allowed email domains                         | allowed email domains                                             |
| User       | workspace, email, names, role, external CRM user ID | workspace, role, external CRM user ID; removal from the Workspace |
| Lead       | owner (to decide what a staff user may see)         | Nothing                                                           |
| Connection | The CRM Connection, to look up CRM users            | Nothing                                                           |

Invites need somewhere to live. The data model sketch has no invite entity; one is implied and is not specified here.

## Assumptions

- **Question 7:** the roles table. Role names are decided (Zach); what each role sees and can do is proposed.
- **Question 7:** the three-part join rule is proposed. The architecture review words part 1 as an allowed domain "plus an invite"; the handoff says "or". This spec follows the handoff.
- **Question 7:** whether sign-in still requires a matching CRM user is open.
- **Question 9:** shared app, Workspace per customer; a User belongs to exactly one Workspace.
- **Question 9:** how a Workspace comes to exist, and who its first owner is, is not decided. No self-serve Workspace creation in the first version.
- Open sign-up (ADR-0004) continues alongside this rule, as described above. Not confirmed.
- The handoff's Users and roles page lists "Invite, change role, remove"; the architecture review lists only "Change a role, remove access". This spec follows the handoff.
- Owner-only settings are not defined.
- What happens to a removed user's leads is not stated.

## Acceptance checks

To run when this spec is built.

1. A staff user's Pipeline lists only leads they own, and requesting another rep's lead by address or by API is refused.
2. An admin sees every lead in their Workspace and can filter by rep.
3. No user of Workspace A can see or change anything in Workspace B, including by guessing an id.
4. A staff user does not see Users and roles or Settings in the navigation, and the API behind them refuses a staff caller.
5. A person on an allowed domain joins that Workspace after proving control of the mailbox.
6. A person off the allowed domain joins only with an invite.
7. A person with neither has an account and sees no customer's data.
8. An admin can invite, change a role and remove a user; a removed user's next request is refused.
9. The last owner cannot be removed or demoted.
10. For Authority Solutions, a user removed in the CRM loses access at their next sign-in.
11. Every one of these checks holds when the request is sent straight to the API, not only through the screens.

## User Stories

1. As a rep, I want to see only my leads, so that I am not distracted by others'.
2. As an admin, I want to see every lead in my Workspace, so that I can oversee the team.
3. As an admin, I want to filter by rep, so that I can look at one person's pipeline.
4. As an owner, I want to see everything in my Workspace, so that nothing is hidden from me.
5. As a customer, I want only my people to see my leads, so that my data stays mine.
6. As an admin, I want to invite a colleague, so that they can start working leads.
7. As an admin, I want to see pending invites, so that I know who has not joined.
8. As an admin, I want to revoke or resend an invite, so that I can fix a mistake.
9. As an admin, I want to change someone's role, so that their access matches their job.
10. As an admin, I want to remove someone, so that leavers lose access at once.
11. As a new employee on the company domain, I want to join without waiting for an invite, so that I can start on day one.
12. As an owner, I want protection from removing the last owner, so that the Workspace is never left without one.
13. As an admin at Authority Solutions, I want removing someone in the CRM to remove them here, so that I manage access in one place.
14. As a rep, I want my account matched to my CRM user, so that the leads assigned to me there are mine here.
15. As a person who signed up without belonging to any Workspace, I want to be told so plainly, so that I know what to do next.
16. As a staff user, I do not want admin screens in my navigation, so that the app stays simple.
17. As a developer, I want role and Workspace checks in the data-access layer, so that no screen can leak data by forgetting a filter.
18. As the project lead, I want the deferred sign-in rule written down, so that it is not lost while sign-up is open.

## Implementation Decisions

- **User gains** workspace, role and external CRM user ID (spec 09). User.id stays the Supabase auth user id (ADR-0005).
- **Authorization lives in the data-access layer** (ADR-0002): authenticated user with a profile, then membership of the owning Workspace, then the role rule for the resource. This restores the ownership check that ADR-0002 and AGENTS.md require and that the current build omits. The checks are added inside the existing data-access functions when their bodies are replaced (ADR-0006).
- **Role rules** are one function of (role, user, resource) used by every data-access function, so "what staff may see" is defined once.
- **The interface hides** what a role cannot use, but hiding is never the control; the server refuses independently.
- **Joining** is decided at profile setup and re-checked at sign-in: allowed domain, or a valid invite, or neither. Where a CRM Connection exists, the adapter's user lookup (spec 11) supplies the external CRM user ID.
- **Invites** are single-use, expire, and are tied to an email address. Their storage is to be designed with the answers to questions 7 and 9.
- **Routes** (ADR-0003) for the screen: list users and invites, invite, change role, remove, revoke invite. Each validated with a shared zod schema; hooks per ADR-0001.
- **Open sign-up is not changed by this spec.** Reversing it is ADR-0004's question.

## Testing Decisions

_Seams confirmed by the owner._

- A good test asks, for a given role and Workspace, what a caller can read and change, through the data-access functions and Route Handlers.
- **Data-access functions**, with Vitest: a matrix of role by resource by Workspace for every lead function from specs 04 to 07; the join rule's three outcomes; last-owner protection; removal taking effect on the next request.
- **Route Handlers**, with Vitest: staff refused on admin routes; cross-Workspace ids refused.
- **Screen**, with Testing Library at page level: list, invite, change role, remove, pending invites, the not-allowed and no-Workspace states.
- The suites from specs 04 to 07 gain role and Workspace cases; their existing cases still pass.
- No end-to-end browser suite yet.

## Out of Scope

- Anything in the current build, where there are no roles and the screen is a placeholder.
- Self-serve creation of a Workspace; billing; a paywall.
- A user belonging to several Workspaces.
- Custom roles or per-user permissions beyond the three roles.
- Owner-only settings.
- The app assigning leads to reps.
- Single sign-on and directory sync.
- Reversing open sign-up (ADR-0004).

## Further Notes

- The handoff's work order calls this spec "Sign-in, users and roles" and places it after the next meeting. Sign-in itself has moved to spec 02 by owner decision and is ready; what remains here is everything that depends on questions 7 and 9.
- The architecture review lists as settled that sign-in is role-based and that reps see a different view from admins. The current build's single shared view is a deliberate temporary departure from that (owner decision).
- **Real lead data must not be connected before this spec is built** (ADR-0004).
