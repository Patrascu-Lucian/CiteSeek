import type { EmailConfig, EmailUserConfig } from "next-auth/providers/email";

const SEND_URL =
  "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails";

/** The verified subdomain, not the apex: SPF and DKIM authorise
 * `mail.citeseek.app`, and a deliverability problem there never reaches the
 * reputation of the domain the app itself is served from. */
const FROM = { name: "CiteSeek", email: "no-reply@mail.citeseek.app" };

/** Fifteen minutes, against Auth.js's 24-hour default. A sign-in link is a
 * bearer credential sitting in an inbox, and nobody needs a day to click it. */
const MAX_AGE_SECONDS = 15 * 60;

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
    `<p>Sign in to ${host}:</p>`,
    `<p><a href="${url}">Sign in</a></p>`,
    "<p>The link works once and expires in 15 minutes.</p>",
    "<p>If you did not ask to sign in, nothing has happened — ignore this email.</p>",
  ].join(""),
  project_id: process.env.SCALEWAY_PROJECT_ID,
});

/**
 * Ours rather than Auth.js's bundled Resend provider, because Resend stores
 * message content in the US whichever region it sends from (docs/backlog.md).
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

    async sendVerificationRequest({ identifier, url, provider }) {
      if (!process.env.SCALEWAY_PROJECT_ID) {
        throw new Error("SCALEWAY_PROJECT_ID is not set; no email was sent.");
      }

      const response = await fetch(SEND_URL, {
        method: "POST",
        headers: {
          "X-Auth-Token": provider.apiKey ?? "",
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
