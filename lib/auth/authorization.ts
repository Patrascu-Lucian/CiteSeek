/** Pure over plain data — no database, cookies or request — so every branch is
 * cheap to test and the rule lives in one place. */

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
 * The whole model: owners write their own workspaces; any *identified* actor
 * reads the demo; nobody writes it, or the next visitor sees what the last one
 * did; everything else is denied. Requiring an actor is what makes the guest
 * signature load-bearing — a forged token resolves to `null` and is refused here.
 * **Not** a rate-limit key: a valid cookie proves we issued it, not that its
 * holder has one (ADR 014).
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

/** A guard, not a boolean: `"write"` implies a signed-in owner, so write paths
 * need no guest branch. */
export function canWrite(
  actor: Actor,
  workspace: WorkspaceAccessSubject,
): actor is Extract<Actor, { type: "user" }> {
  return accessToWorkspace(actor, workspace) === "write";
}

export function isGuest(actor: Actor): actor is { type: "guest"; id: string } {
  return actor?.type === "guest";
}
