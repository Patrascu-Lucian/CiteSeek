# 051 — Linking a second provider, from a session rather than an email

## Context

Sign-in is GitHub only. GitHub is a developer credential, which is the right signal for a project
read by engineers and the wrong one for anyone else, so a second provider has been planned since
the first week. Google is the one that costs no new subprocessor — it is already named on the
privacy page for Gemini.

Adding the provider is four lines. What needed deciding is what happens when the same person
arrives twice.

Auth.js with a database adapter will not attach a second OAuth account to an existing user on its
own. `users.email` is unique, so a Google sign-in carrying an email GitHub already registered
cannot create a second row, and the callback throws `OAuthAccountNotLinked`. The sign-in page has
mapped that to _"That email is already registered with a different sign-in method"_ since the error
map shipped: accurate, and it leaves the reader with no way through except remembering which button
they pressed last time.

## Decision

**A second provider is linked from an already-authenticated session, on the account page.** Not
adopted automatically at sign-in, and not by loosening the email constraint.

Signing in with a provider while a session exists links it to the current user. `@auth/core@0.41.3`
does this with no configuration flag, and its own comment is the justification:

> If the user is already signed in and the OAuth account isn't already associated with another user
> account then we can go ahead and link the accounts safely.

The linking branch also returns before `events.createUser`, so linking provisions no second
workspace. That is a property of the library, not of our code, and the integration test in the
linking slice pins it.

## Why not link on a verified email

This was the obvious design and it is refuted by the code, not by preference. Under it, a Google
sign-in whose email is verified adopts the existing user. It trusts a provider's verification
claim — and the claim that matters is the weaker one, because the risk is not what Google asserts
but what any other configured provider asserts.

The shipped GitHub provider does not check verification at all. `@auth/core`'s
`providers/github.ts` resolves the address as:

```ts
profile.email = (emails.find((e) => e.primary) ?? emails[0]).email;
```

Its own `GitHubEmail` type declares `verified: boolean`, and nothing reads it. Falling through to
`emails[0]` means an unverified address can become the profile email. A design premised on
verification would therefore be resting on a flag this codebase never consults, and the fix would
be to patch a provider rather than to choose a safer shape.

There is a second cost that the option's description does not suggest. With
`allowDangerousEmailAccountLinking`, `events.createUser` still fires when an existing user is
adopted, because it sits outside the branch that adopts. `getOrCreatePersonalWorkspace` is
idempotent, so no second workspace appears — but the event runs for an account that is not new, and
nobody reading the flag's name would expect that.

## Why not drop the unique constraint

Letting one person hold two accounts removes the takeover question by removing linking, at the cost
of two workspaces and two document sets: whoever signs in the "wrong" way sees an empty app they had
documents in yesterday.

It also closes a door the next milestone needs open. `getUserByEmail` is how a magic-link token
resolves an identifier to an account. Without the constraint it resolves to an arbitrary one of
several, so choosing this would trade a rare confusion now for an unfixable one later.

## Consequences

**A reader who picks the wrong provider cold still takes two attempts.** They are told which method
owns the address, sign in with it, and add the second from the account page. Linking on a verified
email would have taken one. That is the price, and it buys never trusting a third party's word
about who someone is.

**The refusal gains an action.** The chat refusal already ends in one — `Affordance` in
`components/chat/refusal.tsx` exists so that a reader who cannot upload is never told to. The
sign-in error is the refusal that has only ever explained.

**`OAuthAccountNotLinked` covers two situations**, thrown from two places with one code: an account
belonging to someone else, and an email already registered. Because linking returns to `/account`
and cold sign-in returns to `/sign-in`, each page can state the meaning that is true where it is,
without parsing anything Auth.js does not distinguish.

**No migration.** `accounts` is keyed on `(provider, provider_account_id)` with `user_id` a plain
cascading foreign key, so one user row already holds many providers. `listSignInMethods` and
`PROVIDER_LABELS` already read them, and the label map already contains Google.

**What would change this decision.** If Auth.js ever checked verification on every configured
provider, option 1 becomes defensible and costs one round trip less. The evidence to re-examine is
`providers/*.ts`, not our own code.
