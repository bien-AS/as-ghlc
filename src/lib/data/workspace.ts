import { buildSampleWorkspace } from "@/lib/data/fixtures/workspace";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { requireCapability } from "@/lib/data/viewer";
import type {
  DomainInput,
  UpdateWorkspaceInput,
  Workspace,
} from "@/lib/workspace/schemas";

/*
 * Data access for the Workspace (spec 09's Workspace row; spec 12 for the
 * allowed email domains; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard
 * (`requireCapability("manage_workspace")`: the current user, then their role)
 * and then reads or changes the sample store. Going live means replacing the
 * bodies of the exported functions below with queries on the viewer's own
 * Workspace row (resolved from their membership, never from the client) and
 * deleting `fixtures/workspace.ts`. Schemas, Route Handlers, query options,
 * hooks and the screen do not change.
 *
 * This is the only module, with its tests, that imports the fixture. Input is
 * already validated and normalised by the shared zod schemas (the Route
 * Handlers parse before calling), so a domain arrives in lower case.
 */

const workspace = sampleStore<Workspace>("workspace", buildSampleWorkspace);

/** A copy, so a caller can never change the store through what it was given. */
const read = () => structuredClone(workspace());

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** The viewer's Workspace. */
export async function getWorkspace(): Promise<Workspace> {
  await requireCapability("manage_workspace");
  return read();
}

/** Changes the name and the branding. */
export async function updateWorkspace(
  input: UpdateWorkspaceInput,
): Promise<Workspace> {
  await requireCapability("manage_workspace");
  const record = workspace();
  record.name = input.name;
  record.branding = {
    displayName: input.displayName,
    logoInitials: input.logoInitials,
  };
  return read();
}

/** Allows one more email domain. A domain already allowed is a conflict. */
export async function addAllowedDomain(input: DomainInput): Promise<Workspace> {
  await requireCapability("manage_workspace");
  const record = workspace();
  if (record.allowedDomains.includes(input.domain)) {
    throw new AccessError("conflict");
  }
  record.allowedDomains.push(input.domain);
  return read();
}

/**
 * Stops allowing a domain. People who already joined keep their access: spec
 * 12 does not say a removed domain removes anyone.
 */
export async function removeAllowedDomain(
  input: DomainInput,
): Promise<Workspace> {
  await requireCapability("manage_workspace");
  const record = workspace();
  if (!record.allowedDomains.includes(input.domain)) {
    throw new AccessError("not_found");
  }
  record.allowedDomains = record.allowedDomains.filter(
    (domain) => domain !== input.domain,
  );
  return read();
}
