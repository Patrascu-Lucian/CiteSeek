# 054 — Cookie notices rather than a consent banner

## Context

Nothing here sets an analytics, advertising or third-party cookie, so the usual reason for a consent
banner never arises. What is set, read from the code and from `@auth/core` 0.41.3:

- `authjs.session-token` — the key to a database session. 30 days, counted from the last visit:
  Auth.js's default, now named as `SESSION_MAX_AGE_SECONDS`.
- `authjs.csrf-token` and `authjs.callback-url` — set during sign-in with no `maxAge`, so they end
  with the browser session.
- `authjs.pkce.code_verifier` — set when a GitHub or Google sign-in starts, for 15 minutes. Neither
  provider declares checks, so Auth.js applies its default of PKCE alone. The `state` and `nonce`
  cookies it can also set are never set here; the backlog entry that raised this listed both.
- `citeseek.guest` — the demo session, for a day.
- `citeseek_theme` — the chosen color theme, for a year, and only once someone picks one.

The privacy page named one of these, and said how long none of them lasted.

Article 29 Working Party Opinion 04/2012 (WP194) exempts authentication, security and preference
cookies from consent, with limits three of ours exceed:

- §3.2: _"Persistent login cookies which store an authentication token across browser sessions are
  not exempted"_. The remedy it describes is a _"remember me (uses cookies)"_ note beside the form.
- §3.6: a preference cookie is exempt for a session _"or no more than a few additional hours"_,
  unless a _"uses cookies"_ note sits beside the control.
- User-input cookies are exempt for a session, _"or persistent cookies limited to a few hours in some
  cases"_.

## Options

**A consent banner.** Rejected. It asks a question with no answer a reader can act on: declining the
session cookie means not signing in, and the flow cookies are what make signing in safe. A banner
that cannot change what is set is decoration on every page, covering three cookies the opinion says
a note can cover.

**Shorten the lifetimes into the exempt ranges.** Rejected. A session-only login signs everyone out
when the browser closes, a session-only theme forgets the choice between visits, and a guest session
of a few hours ends a demo partway through. Each gives up something a reader wants.

**Notices where the cookies are set, and a complete list.** Chosen.

## Decision

- Under the sign-in form: _"Signing in sets a cookie that keeps you signed in until you go 30 days
  without a visit"_, beside the acknowledgement line linking the privacy policy. The demo link above
  it says the demo uses a cookie that lasts a day.
- On the theme toggle: an accessible description, _"Remembered in a cookie for a year"_, and a
  **Cookies** link in the site footer.
- On `/privacy`: a `#cookies` section naming every cookie, what it is for and how long it lasts.

Every lifetime is rendered from the constant the cookie is set with, through `formatLifetime`, which
uses whole units only. The exception is the PKCE cookie's 15 minutes: Auth.js's own value, with no
exported constant to render.

## Consequences

- **The theme notice is the weak part.** "Beside the control" is met for a screen reader and not for
  a sighted reader, who has the footer link instead: three icon buttons in a header row leave no room
  for a caption. If it is ever read strictly, a visible caption belongs inside the mobile sheet.
- **The list cannot fall behind quietly.** An E2E test enters the demo, changes the theme and signs in
  through Auth.js's own callback, collecting cookie names after each step, and fails if any is missing
  from `#cookies`. It covers what CI can drive. The PKCE cookie needs provider keys CI does not have,
  so its entry rests on reading the source.
- **This is a reading, not a ruling.** WP194 is a 2012 ePrivacy opinion that predates GDPR, and
  national regulators apply it differently. Any analytics, advertising or third-party cookie reopens
  this decision rather than extending the list.
