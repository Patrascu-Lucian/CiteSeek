/**
 * Who may do what to a workspace.
 *
 * Kept as a pure function over plain data -- no database, no cookies, no request
 * -- so every branch is cheap to test and the rule lives in exactly one place.
 * Route handlers and Server Components ask this; none of them re-derive it.
 */

export type Actor =
  | {
      type: "user";
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    }
  | { type: "guest"; id: string }
  | null;

/** The subset of a workspace needed to make an access decision. */
export type WorkspaceAccessSubject = {
  id: string;
  ownerId: string | null;
  isDemo: boolean;
};

export type Access = "none" | "read" | "write";

/**
 * The whole authorization model:
 *
 * - Owners get write on their own workspaces.
 * - Any *identified* actor -- a signed-in user or a valid guest -- may read the
 *   demo workspace.
 * - Nobody may write the demo workspace, including signed-in users. It is shared
 *   seeded state; letting any visitor mutate it means the next visitor sees
 *   whatever the last one did.
 * - Everything else is denied, including anonymous requests.
 *
 * Requiring an actor for the demo rather than making it world-readable is
 * deliberate. It is what makes the guest cookie's signature load-bearing: a
 * forged or expired token resolves to `null` and is refused here, so access is
 * something the visitor cannot grant themselves.
 *
 * It does *not* make the guest id trustworthy as a rate-limit key, which an
 * earlier version of this comment claimed. A valid cookie proves we issued it,
 * not that its holder has only one — `/demo` issues a new one on every visit.
 * Limiting counts the client address instead (ADR 014).
 */
export function accessToWorkspace(
  actor: Actor,
  workspace: WorkspaceAccessSubject,
): Access {
  if (!actor) return "none";

  if (workspace.isDemo) {
    // Read-only for everyone, including signed-in users.
    return "read";
  }

  if (actor.type === "user" && workspace.ownerId === actor.id) {
    return "write";
  }

  return "none";
}

export function canRead(
  actor: Actor,
  workspace: WorkspaceAccessSubject,
): boolean {
  return accessToWorkspace(actor, workspace) !== "none";
}

export function canWrite(
  actor: Actor,
  workspace: WorkspaceAccessSubject,
): boolean {
  return accessToWorkspace(actor, workspace) === "write";
}

export function isGuest(actor: Actor): actor is { type: "guest"; id: string } {
  return actor?.type === "guest";
}
