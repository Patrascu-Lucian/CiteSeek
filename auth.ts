import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";

import { scalewayEmail } from "@/lib/auth/email-provider";
import { AUTH_PROVIDERS } from "@/lib/auth/providers";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { getOrCreatePersonalWorkspace } from "@/lib/workspaces/personal";

/**
 * Auth.js owns real accounts only. Guest/demo access is deliberately handled
 * outside this file (see lib/auth/guest.ts) because a guest has no account to
 * persist -- see docs/decisions/005-guest-sessions-outside-auth-js.md.
 *
 * Everything the app consumes goes through lib/auth/actor.ts rather than
 * importing `auth()` directly, so swapping the auth library later means changing
 * this file and that one -- not every route. ADR 004 records why we accept a
 * beta dependency here.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Keys resolve per request, so CI builds with none set. Email stays outside
  // the list because that list also renders the account page's "Add" controls.
  providers: [
    ...AUTH_PROVIDERS.map(({ provider }) => provider),
    scalewayEmail(),
  ],
  // Database sessions rather than JWT: a session can then be revoked server-side
  // by deleting a row, which a stateless token cannot offer. The cost is one
  // query per request, which is acceptable when the app is already hitting the
  // same database to load the workspace.
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
    verifyRequest: "/check-your-email",
  },
  /*
    **Not blanket trust of a client-supplied Host.** Vercel's proxy terminates TLS
    and sets the forwarded host itself, and a preview's hostname changes per
    deploy. Gating this on `VERCEL_ENV` took production sign-in down on 6 August
    2026; `AUTH_URL` pins the URL Auth.js advertises, not the host it may read.
  */
  trustHost: true,
  events: {
    /**
     * The adapter creates a `users` row and stops there. Without a workspace to
     * go with it a new account has nowhere to land, so sign-in appears to do
     * nothing. Created here so the common path costs no extra round trip;
     * `/w` re-checks and creates on demand for accounts that predate this.
     */
    async createUser({ user }) {
      // The adapter always sets it; a bare `return` here would leave an account
      // with no workspace and say nothing, which is how the `/w` backfill came
      // to exist. It is the backstop, not the reason this can be quiet.
      if (!user.id) {
        console.error(
          "createUser fired without a user id — no workspace created. The account will get one from /w on first visit.",
        );
        return;
      }

      await getOrCreatePersonalWorkspace({
        id: user.id,
        name: user.name ?? null,
      });
    },
  },
});
