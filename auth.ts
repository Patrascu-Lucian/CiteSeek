import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

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
  providers: [
    // Reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET from the environment by
    // convention -- Auth.js v5 looks them up rather than taking arguments.
    GitHub,
  ],
  // Database sessions rather than JWT: a session can then be revoked server-side
  // by deleting a row, which a stateless token cannot offer. The cost is one
  // query per request, which is acceptable when the app is already hitting the
  // same database to load the workspace.
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  // Vercel preview deployments serve from a different host per deployment;
  // without this Auth.js rejects them as untrusted.
  trustHost: true,
});
