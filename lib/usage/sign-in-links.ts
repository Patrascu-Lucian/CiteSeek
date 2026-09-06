import { countSignInLinksSince, recordUsage } from "./queries";

/** The one caller with no session and no workspace. `usage_events.actor_type`
 * and `actor_id` are both `notNull`, and the hash is the only identity such a
 * caller has — the same value the count is keyed on. */
const ANONYMOUS = "anonymous";

export const SIGN_IN_LINK_WINDOW_SECONDS = 60 * 60;

/** A reader needs one, and two more if the first went to spam. A script needs
 * thousands. Shared egress — an office, a mobile carrier — is the case this
 * number is unfair to, and the trade is deliberate (ADR 053). */
export const SIGN_IN_LINKS_PER_HOUR = 5;

/**
 * Keyed on the caller, never on the address asked for. Counting per recipient
 * would let anyone lock a chosen person out of their account by spending their
 * allowance for them.
 */
export async function signInLinksExhausted(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - SIGN_IN_LINK_WINDOW_SECONDS * 1000);

  return (await countSignInLinksSince(ipHash, since)) >= SIGN_IN_LINKS_PER_HOUR;
}

/** Recorded before the send, not after: a provider that is slow or failing must
 * not be a way to send more than the allowance. */
export async function recordSignInLink(ipHash: string): Promise<void> {
  await recordUsage({
    actorType: ANONYMOUS,
    actorId: ipHash,
    ipHash,
    workspaceId: null,
    kind: "sign_in_link",
  });
}
