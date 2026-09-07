# 052 — A sender chosen on where the mail is stored, not where it is sent from

## Context

Magic-link sign-in needs something that sends email. That reads like a vendor-shopping exercise with
an obvious answer: `next-auth@5.0.0-beta.32` ships a first-class Resend provider, so the whole
sender would have been four lines of configuration and no code of ours.

One constraint governs, and it is older than this milestone. The privacy page claims Frankfurt for
the application and the database, "pinned in configuration rather than left to a default", and the
README is deliberately exact that **EU-hosted** describes _storage_ and says nothing about where the
model runs. A sign-in email carries an address and a live credential. Whatever sends it stores both.

So the question to ask a candidate is not where it sends from. It is **where message content,
delivery logs and account records are stored**, in writing, from a primary source.

## Decision

**Scaleway Transactional Email, region `fr-par`, through a provider we wrote.**

The check ran on 6 September 2026, before any account was opened, because the answer decided the
vendor rather than merely confirming it.

## Why not Resend

Resend's own documentation answers the question against itself:

> Region selection controls where your emails are routed and sent from. It does not control where
> customer data is stored. All account data, including email metadata, logs, and API records, is
> stored in the United States regardless of the sending region you select.

`eu-west-1` dispatches from Ireland while the stored half sits in the US. A pre-signed Article 28
DPA comes with every account and binds what the processor may do; it says nothing about where.

This is not a close call, and it is worth naming why it looked like one. Resend passes every test a
developer normally applies — first-class Auth.js support, a good API, an EU sending region on the
dashboard. "EU region" in a vendor's UI is a routing control until proven otherwise.

## Why not SMTP

`@auth/core` ships a generic `providers/nodemailer` and Scaleway offers SMTP, so configuration could
still have replaced hand-written code once the vendor changed. The reason against is dependency, not
effort: `nodemailer` is an _optional_ peer of `next-auth` and is not installed here, so the SMTP path
adds a runtime dependency where `fetch` adds none. Short-lived serverless functions are also a poor
place to hold an SMTP connection.

## What the DPA actually says

Article 11 of Scaleway's `DPA_2024_ENG`:

> 11.1. Scaleway Services are located within the European Union by default. When the Services are
> offered in several regions or availability zones, it is up to the Client to select the location of
> its choice during the order.
>
> 11.2.2. not to transmit, disseminate or store Personal Data in a country outside the European
> Union, without having expressly informed the Client in advance

**11.2.2 is a notification duty, not a prohibition.** Storage outside the EU is permitted with prior
notice. Read carelessly this clause reads as a guarantee, and it is not one.

The difference from Resend survives the careful reading, which is why the vendor changed: Resend
states unconditionally that data is stored in the US, while Scaleway defaults to the EU and cannot
move it without telling us first. Standard Contractual Clauses appear in 11.2.3 as a fallback for a
transfer that would have to be disclosed anyway, not as cover for routine storage abroad.

That precision is the whole reason to write it down. It is the difference between what the privacy
page may claim and what it may not: _"never leaves the EU"_ is not supportable, and nothing on the
page says it.

## What a link does to an address nothing verified

[ADR 051](051-linking-a-second-provider.md) records that `@auth/core`'s GitHub provider resolves the
profile email as `(emails.find((e) => e.primary) ?? emails[0]).email` and never reads `verified`. So
`users.email` can hold an address its owner never confirmed.

A sign-in link is the first thing in this system that proves control of an address: the token goes to
the inbox, and `users.email` is unique, so whoever reads that inbox signs into **that** account.

Said deliberately, because it cuts both ways. It is a repair, in that the person who actually holds
the address can now reach the account bearing it, where before only the GitHub credential could. It
is not a fix for the weakness underneath — the two then share one account — and the remedy for that
is the one ADR 051 already chose: never treat a provider's claim about an email as identity. Nothing
here hands the link user anything the provider user did not already have.

## Consequences

**The provider is ours.** `lib/auth/email-provider.ts` is one `fetch` against the REST API — the
shape Auth.js's bundled provider would have filled, at about the size the backlog estimated. The
"four lines" figure sometimes quoted for adding a provider belongs to
[ADR 051](051-linking-a-second-provider.md) and describes an **OAuth** provider, which is a
different job.

**Links live fifteen minutes, against the library's twenty-four hours.** The default is inherited
from Auth.js's bundled providers and is long for a bearer credential that sits in an inbox. Nobody
needs a day to click a link, and the cost of the shorter window is a second request from anyone who
does.

**Mail is sent from `mail.citeseek.app`, not the apex.** SPF and DKIM authorize the subdomain, so a
deliverability problem never reaches the reputation of the domain the app is served from.

**A fifth processor.** Scaleway joins Google, Vercel, Neon and GitHub on the privacy page, and the
page's Contact section is now the route by which someone asks about any of them.

**A verification failure appears at send time, not at boot.** A `from` on an unverified domain is
rejected by the API, so the first real signal is production behavior — which is why
`sendVerificationRequest` throws on a non-OK response with the status and Scaleway's own message,
and with neither the address nor the URL, since one is personal data and the other is a credential.

**The key has an expiry we chose.** Scaleway keys do not expire by default; the one-year ceiling
comes from an Organization-level maximum credential duration set on our own account. The key issued
on 6 September 2026 stops working on 6 September 2027 unless that setting is changed or the key
rotated. This is a calendar item, not a vendor limit.

**Two questions are open and neither blocks.** How long Scaleway retains delivery logs holding
recipient addresses — location was the disqualifying test and it passes, but retention is a claim
the privacy page will eventually want. And the sub-processor list was read from a summary rather
than directly; it should be read at the source before anything about it reaches the page.

**The same question is owed to Vercel and Neon.** `vercel.json` pins `"regions": ["fra1"]`, so that
half is verifiable in the repository. Neon's region lives in their console and is not. The privacy
page's "pinned in configuration" is therefore checkable for one of the two and taken on trust for
the other — the exact shape of claim this check just disqualified a vendor over.

**What would change this decision.** Scaleway giving the advance notice 11.2.2 requires, or the
retention answer coming back longer than the page can defend. Neither is a reason to prefer a vendor
that has already answered the question the wrong way.
