/*
 * The three choices the Workspace settings screen is built on, each behind one
 * name so the answer to its question is a change here. Client-safe.
 */

/**
 * Question 9 (ASSUMED): one shared app with a Workspace per customer. The
 * other answer (a deployment per customer) turns the Workspace into a single
 * settings record, and the wording about "every other customer" goes.
 */
export const ONE_SHARED_APP_WORKSPACE_PER_CUSTOMER = true;

/**
 * Spec 12 (part of question 9, not decided): no self-serve creation of a
 * Workspace in the first version. MOCK CHOICE: the screen neither creates nor
 * deletes one, and says so in one line.
 */
export const WORKSPACE_SELF_SERVE = false;

/**
 * Question 7 (PROPOSED): who may join. The handoff says an allowed domain OR
 * an invite; the architecture review says an allowed domain PLUS an invite.
 * Spec 12 follows the handoff, and so does this.
 */
export const JOIN_RULE: "domain_or_invite" | "domain_plus_invite" =
  "domain_or_invite";

/** The join rule in one sentence, for the "Who can join" panel. */
export const joinRuleText = () =>
  JOIN_RULE === "domain_or_invite"
    ? "People whose email is on an allowed domain, or who have an invite, may join this Workspace."
    : "People whose email is on an allowed domain may join this Workspace once they also have an invite.";

/** What a Workspace is, in one sentence, for the Workspace panel. */
export const workspaceScopeText = () =>
  ONE_SHARED_APP_WORKSPACE_PER_CUSTOMER
    ? "This Workspace holds your team's users, leads and connections, apart from every other customer's."
    : "This Workspace holds your team's users, leads and connections.";
