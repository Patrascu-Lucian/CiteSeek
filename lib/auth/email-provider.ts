import { AuthError } from "next-auth";
import type { EmailConfig, EmailUserConfig } from "next-auth/providers/email";

import { pruneVerificationTokens } from "@/lib/auth/verification-tokens";
import { pruneExpiredTokens } from "@/lib/sweeps";
import { clientIpHash } from "@/lib/usage/client-ip";
import { admitSignInLink } from "@/lib/usage/sign-in-links";

const SEND_URL =
  "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails";

/** The verified subdomain, not the apex: SPF and DKIM authorise
 * `mail.citeseek.app`, and a deliverability problem there never reaches the
 * reputation of the domain the app itself is served from. */
const FROM = { name: "CiteSeek", email: "no-reply@mail.citeseek.app" };

/** Fifteen minutes, against Auth.js's 24-hour default. A sign-in link is a
 * bearer credential sitting in an inbox, and nobody needs a day to click it. */
const MAX_AGE_SECONDS = 15 * 60;

/** Subclassed for the `type`, which is what `isClientError` reads. `@auth/core`
 * is not a direct dependency and next-auth re-exports only the base class, so
 * the code is set rather than imported. Any other error becomes `Configuration`
 * — "this is a problem on our side" — which is a lie told to a throttled
 * reader, and hides real outages from the operator among ordinary throttling. */
class TooManyLinks extends AuthError {
  static type = "AccessDenied";
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

const body = (to: string, url: string, host: string) => ({
  from: FROM,
  to: [{ email: to }],
  subject: `Sign in to ${host}`,
  text: [
    `Sign in to ${host}:`,
    url,
    "",
    "The link works once and expires in 15 minutes.",
    "If you did not ask to sign in, nothing has happened — ignore this email.",
  ].join("\n"),
  html: [
    `<p>Sign in to ${escapeHtml(host)}:</p>`,
    `<p><a href="${escapeHtml(url)}">Sign in</a></p>`,
    "<p>The link works once and expires in 15 minutes.</p>",
    "<p>If you did not ask to sign in, nothing has happened — ignore this email.</p>",
  ].join(""),
  project_id: process.env.SCALEWAY_PROJECT_ID,
});

/**
 * Ours rather than Auth.js's bundled Resend provider, because Resend stores
 * message content in the US whichever region it sends from (ADR 052).
 * Scaleway has no bundled provider, and its send is one POST.
 */
export function scalewayEmail(config: EmailUserConfig = {}): EmailConfig {
  return {
    // `AUTH_SCALEWAY_KEY` reaches `apiKey` from this id by convention, resolved
    // per request — so nothing here reads the environment at import.
    id: "scaleway",
    type: "email",
    name: "Email",
    maxAge: MAX_AGE_SECONDS,

    async sendVerificationRequest({ identifier, url, provider, request }) {
      if (!process.env.SCALEWAY_PROJECT_ID) {
        throw new Error("SCALEWAY_PROJECT_ID is not set; no email was sent.");
      }

      // Guarded here beside the project id, not at the send: an unset key would
      // otherwise charge the caller's allowance and then collect a 401.
      if (!provider.apiKey) {
        throw new Error("AUTH_SCALEWAY_KEY is not set; no email was sent.");
      }

      // Before the throttle, because a refused request still writes a token row
      // — Auth.js starts the adapter write and the send together — so the
      // callers who fill that table are exactly the ones this must run for.
      // Swallowed: housekeeping must never refuse somebody's sign-in.
      await pruneExpiredTokens(pruneVerificationTokens).catch(() => undefined);

      // Here rather than in a route: Auth.js owns `/api/auth/*`, and this is
      // the line that spends money. A limit anywhere else has another way in.
      const ipHash = clientIpHash(request.headers);

      // Counts and records together, so two requests arriving at once cannot
      // both be admitted against the same count.
      if (!(await admitSignInLink(ipHash))) {
        // The reader is not told the threshold, only that it was reached.
        throw new TooManyLinks("Too many sign-in links requested.");
      }

      const response = await fetch(SEND_URL, {
        method: "POST",
        headers: {
          "X-Auth-Token": provider.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body(identifier, url, new URL(url).host)),
      });

      // Status and Scaleway's own message only. The address is personal data
      // and the URL is a live credential; neither belongs in a log line.
      if (!response.ok) {
        throw new Error(
          `Scaleway refused the send: ${String(response.status)} ${await response.text()}`,
        );
      }
    },

    options: config,
    ...config,
  };
}
