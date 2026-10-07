---
title: Notifications
status: ready
blocked_by: []
owner_to_ask: []
build_now: false
---

# 08. Notifications

**Purpose:** tell a user what needs them, with a link straight to the lead. It serves reps, who otherwise have to look for work in the Pipeline.

> **In the current build this screen is a placeholder** (spec 04). The spec is ready, but notifications are raised by parts of the product that do not exist yet (validation, proposals, invoices) and belong to real users and real leads. It is built when the lead store (spec 09) exists.
>
> **Decided (owner):** notifications arrive in real time through Supabase Realtime Broadcast. No other realtime, pub/sub or queue service is used. Details are under Implementation Decisions.

## Problem Statement

Things happen to a rep's leads while they are looking elsewhere: the AI flags a suspect, a lead signs a proposal, an invoice draft is ready. Without notifications the rep learns of them only by rereading the Pipeline, and a signed proposal can sit unnoticed.

## Solution

- A **Notifications** screen at `/dashboard/notifications`: the user's notifications, newest first. Each shows what happened, the lead's name and company, and when. Unread ones are visibly distinct.
- **Open:** selecting a notification opens its lead (spec 06) and marks the notification read.
- **Mark read:** each unread notification can be marked read without opening it.
- An **unread count** on the Notifications item in the shell's navigation.
- New notifications appear, and the count rises, without the user reloading the page.

A notification belongs to one user and links to one lead.

### Notification types

Named in the source documents:

| Type                | Raised when                               | Raised by  | For              |
| ------------------- | ----------------------------------------- | ---------- | ---------------- |
| Suspect to review   | The AI returns a suspect verdict          | Validation | The lead's owner |
| Proposal signed     | A lead signs its proposal                 | Proposals  | The lead's owner |
| Invoice draft ready | An invoice draft is created after signing | Invoices   | The lead's owner |

The architecture review says "and others as they are agreed". No other type is specified here; adding one is a small, separate change.

## States

| State                    | What the user sees                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| First load               | The list on first paint (prefetched).                                                                                    |
| Loading                  | Skeleton rows.                                                                                                           |
| Empty                    | "Nothing needs you right now", with one sentence saying what will appear here.                                           |
| All read                 | The list with no unread styling; the navigation shows no count.                                                          |
| Error loading            | Error state with Try again.                                                                                              |
| New notification arrives | It appears at the top and the count rises, without a reload and without moving what the user is reading.                 |
| Marking read             | The row changes at once; if the request fails it returns to unread with a brief message.                                 |
| Live connection down     | Nothing is shown to the user. The list and count catch up when the user returns to the window or the connection resumes. |
| Lead no longer available | The notification stays in the list; opening it shows the lead's not-found panel (spec 06).                               |
| Long list                | Loads a page at a time and more on request.                                                                              |
| Narrow screens           | One column; each row stacks what happened, the lead, then the time.                                                      |

## Data

| Entity       | Read                               | Written                                                                     |
| ------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| Notification | user, lead, type, read state, time | read state, by its own user. Created by other blocks, never by this screen. |
| Lead         | name, company (for display)        | Nothing                                                                     |
| User         | Current user                       | Nothing                                                                     |

## Assumptions

- **Question 7:** a notification goes to the lead's owner. Whether admins and owners also receive notifications for leads they do not own is part of what each role sees, and is not decided.
- **Question 4:** "Suspect to review" presumes a rep reviews suspects (assumed).
- **Question 3:** "Invoice draft ready" presumes invoicing stops at a draft (assumed).
- **Question 6:** "Proposal signed" depends on how the app learns of a signature (assumed: by polling).
- The Notification entity's fields in the data model sketch are assumed.
- No "mark all read" and no deleting; the handoff lists only open and mark read.

## Acceptance checks

1. A user sees only their own notifications, newest first, each with what happened, the lead and the time.
2. Opening a notification lands on its lead and the notification is then read.
3. Marking one read lowers the navigation count by one without leaving the page.
4. With no notifications, the empty state shows.
5. Creating a notification for a user who has the app open makes it appear, and the count rise, without a reload.
6. With the live connection blocked, creating a notification and then returning focus to the window makes it appear.
7. The live signal carries no notification content: inspecting the realtime message shows no lead name, type or text.
8. A signed-in user cannot subscribe to another user's channel, and a browser cannot publish to any channel.
9. Requesting another user's notification by id, or marking it read, is refused.
10. No notification text names a CRM or a third-party service.

## User Stories

1. As a rep, I want a list of what needs me, so that I do not hunt through the Pipeline.
2. As a rep, I want the newest notification first, so that I see what just happened.
3. As a rep, I want each notification to open its lead, so that I can act at once.
4. As a rep, I want to be told when the AI flags a suspect, so that I can review it promptly.
5. As a rep, I want to be told when a proposal is signed, so that I can follow up while it is fresh.
6. As a rep, I want to be told when an invoice draft is ready, so that I can check it.
7. As a rep, I want unread notifications to stand out, so that I know what is new.
8. As a rep, I want a count in the navigation, so that I notice new items from any screen.
9. As a rep, I want to mark a notification read without opening it, so that I can clear ones I have already handled.
10. As a rep, I want opening a notification to mark it read, so that I do not do it twice.
11. As a rep, I want new notifications to appear without reloading, so that I can leave the app open all day.
12. As a rep, I want the list to catch up when I come back to the tab, so that a dropped connection does not hide anything.
13. As a rep, I want to see only my own notifications, so that I am not distracted by others'.
14. As a rep, I want a calm empty state, so that I know nothing is waiting.
15. As a rep, I never want a notification to name the CRM.
16. As a developer, I want the live channel to carry no data, so that access to notification content has one gate.

## Implementation Decisions

- **Routes** (ADR-0003), each with a shared zod schema: list the current user's notifications (paged, newest first), get the unread count, and mark one notification read. All go through data-access functions that resolve the current user first and return only that user's notifications (ADR-0002).
- **Hooks** (ADR-0001): a notifications list query, an unread count query and a mark-read mutation that updates both. The list is prefetched on the server for the Notifications screen; the count is prefetched for the shell.
- **Real-time transport: Supabase Realtime Broadcast.** Chosen because Supabase is already in the stack. No other realtime, pub/sub or queue service.
- **The broadcast is only a "refetch now" signal.** The message carries no notification content. On receiving it, the client invalidates the notifications queries, and the data arrives through the normal Route Handler and data-access guard. Authorization of notification data therefore stays in the data-access layer, consistent with ADR-0002.
- **One private channel per user**, keyed on the user's id. User.id equals the Supabase auth user id (ADR-0005), so no mapping is needed. Public channel access is turned off.
- **One read policy** on Supabase's own realtime messages table lets an authenticated user join only their own topic. There is no policy that lets browsers publish. No row-level security is added to application tables, and Postgres Changes is not used.
- **The server sends the signal after it writes a Notification.** How it sends is an implementation choice: a REST broadcast call from the server, or a database trigger. **Unverified:** it is not confirmed whether a server key on the REST broadcast endpoint bypasses the channel policy. A database trigger avoids the question.
- **Fallback.** Refetch on window focus stays on for the notifications queries, so the list and count recover when the socket is down.
- **Subscription lifetime.** The shell subscribes once per signed-in session and unsubscribes on sign-out. This is the one use of the Supabase client beyond auth; it reads no application data.
- **No job queue for now.** Inbound webhooks are handled inline: verify, write idempotently, insert the Notification. Polling a third-party API runs from a scheduled job that calls a Route Handler. A queue is out of scope until retries with backoff or fan-out are needed.
- **Creating notifications** is a data-access function called by the blocks that raise them (validation, proposals, invoices). This spec defines that function's interface (user, lead, type); those blocks' specs decide when to call it.
- **Text** for each type is produced in one place from the type and the lead, so wording cannot drift and never includes a CRM's name.
- Marking read is idempotent. Marking read is the only optimistic update, because it is a single field with an obvious rollback.

## Testing Decisions

_Seams confirmed by the owner._

- A good test checks what a user can read and change: only their own notifications, in order, with correct read state and count.
- **Data-access functions**, with Vitest: list returns only the caller's notifications newest first; unread count; mark read is idempotent and refuses another user's notification; create writes the row and triggers the signal.
- **Route Handlers**, with Vitest: refusals for signed-out and profile-less callers; validation; not found for another user's notification.
- **Screen**, with Testing Library at page level: rows, unread styling, open and mark read, the empty and error states, and that a received signal causes a refetch.
- The channel policy (own topic only, no browser publish) is verified by hand against the Supabase project using acceptance checks 7 and 8.
- No end-to-end browser suite yet.

## As built (mockup)

> **This is a mockup.** It runs on sample data, connects to nothing outside the app, and is built on the assumptions listed here. This spec's status and its open questions are unchanged.

**What the mockup shows**

- The Notifications screen at `/dashboard/notifications`: the list, newest first, ten at a time with "Load more". Each row says what happened, the lead's name and company, and when. Unread rows are heavier and say "Unread".
- Selecting a row opens its lead and marks it read. "Mark read" marks one read without opening it; the row changes at once and returns to unread with a brief message if the request fails.
- The unread count on the bell in the navbar and on the Notifications item in the sidebar (spec 04). No count is shown at zero or when it is unavailable.
- The three agreed types only. The wording for each comes from one function (`notificationText` in `src/lib/notifications/rules.ts`) and names no CRM or service.
- Signing a proposal in the proposal builder mockup (spec 14) raises "Proposal signed" and "Invoice draft ready" for that lead, through `createNotification`.
- The states in the table above, except "New notification arrives" and "Live connection down", which need the live channel.

**Assumptions and mock choices**

| Where                                                                          | Question           | What is assumed                                                                                                                             |
| ------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMINS_AND_OWNERS_NOTIFIED_FOR_EVERY_LEAD` in `src/lib/data/notifications.ts` | 7 (assumed)        | Staff see notifications for the leads they own; admins and owners see every lead's. The other answer is this one value.                     |
| The "Suspect to review" type                                                   | 4 (assumed)        | A rep reviews suspects.                                                                                                                     |
| The "Invoice draft ready" type                                                 | 3 (assumed)        | Invoicing stops at a draft.                                                                                                                 |
| The "Proposal signed" type                                                     | 6 (assumed)        | The app learns of a signature by polling; in the mockup a "simulate" action stands in for it (spec 14).                                     |
| `mutedNotificationTypes` in `src/lib/data/account.ts`                          | None (mock choice) | A user can switch a type off in Account settings; it is then left out of their list and count. This spec lists preferences as out of scope. |
| `NOTIFICATIONS_PAGE_SIZE` in `src/lib/notifications/schemas.ts`                | None (mock choice) | Ten to a page, so "Load more" shows on the sample.                                                                                          |

**What is faked**

- The notifications. They are derived from the sample leads (a suspect awaiting review, a won lead with a signed proposal, a lead with an invoice draft), timed from each lead's timeline. Two in three start unread.
- **There is no realtime channel.** The decided transport, Supabase Realtime Broadcast, stays as written under Implementation Decisions and is not built. The list and the count are read again when the person returns to the window. The screen says so in one line.
- Read state is one flag per notification, held in server memory. Every role in the role preview is the same signed-in person, so a notification marked read as Owner is read as Staff.
- No channel policy exists, so acceptance checks 5 to 8 cannot be run yet.

**To go live** (function bodies only): in `src/lib/data/notifications.ts`, `listNotifications`, `getUnreadCount`, `markNotificationRead` and `createNotification`, which then also sends the broadcast; in `src/lib/data/account.ts`, `getAccountPreferences` and `updateAccountPreferences`. Add the channel subscription to `src/hooks/use-notifications.ts`, where a comment marks the place.

### Account settings (new screen)

A person's own settings, at `/dashboard/account`, reached from **Settings** in the user menu and never from the sidebar (owner decision). It is recorded here because its one mocked part is notification preferences.

| Panel                    | What it does                                                        | Real or sample                                                                               |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Profile                  | First name and last name; the email is shown and cannot be changed. | **Real.** It updates the signed-in person's User row, the one real table. The panel says so. |
| Theme                    | System, Light or Dark (spec 03).                                    | Real, kept in the browser.                                                                   |
| Notification preferences | One switch per notification type, in the app only.                  | Sample: kept in server memory, reset on restart. A mock addition, not in any spec.           |

## Out of Scope

- Email, SMS, push or desktop notifications.
- Notification preferences, muting, snoozing, "mark all read", deleting.
- Notification types beyond the three listed.
- A job queue, retries with backoff, fan-out to many users.
- Using the realtime channel to carry data or to update other screens.
- Building any of this in the current build, where the screen is a placeholder and the shell shows no unread count.

## Further Notes

- Neither source document names a real-time service; the transport above is the owner's decision made after the handoff.
- Going from placeholder to built needs: the Notification model in the lead store (spec 09), at least one block that raises notifications, and the Supabase Realtime settings described above.
- The handoff's architecture table lists Notifications as talking to the lead store only, which this design keeps: the realtime channel is a doorbell, not a second source of data.
