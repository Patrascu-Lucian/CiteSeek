# 025 — Paying for the model tier

## Context

The project's positioning is GDPR-first, and its own standing rule says the free tier is for
development and the portfolio demo only: before real users upload real documents, move to a paid
tier or a provider under a data-processing agreement.

**The application has been violating that rule since GitHub sign-in shipped.** Anyone with a
GitHub account can sign in and upload their own files, and those files' text reaches Google under
free-tier terms, which permit using submitted content to improve their products.

**That is a breach of this project's own rule, not necessarily of the GDPR, and the two are worth
keeping apart.** Transparency is satisfied: the warning sits at the upload control, not buried,
and it is specific about where the text goes and on what terms. What a disclosure cannot do is
two things. The people whose data is _inside_ an uploaded document — a client named in a
contract, a colleague in a CV — never saw the notice, and consent does not transfer from the
uploader to them. And Article 28 asks for a processor contract with mandatory terms; a provider
free to use submitted content for its own improvement is not acting purely on instruction, and no
notice to _our_ users changes what _they_ may do. “Please don’t upload anything confidential”
is a request, not a measure under Article 32.

So the honest status is not a current breach. It is an unmitigated risk whose only control is a
polite request, and it materializes the first time someone uploads a document containing
another person’s data — the ordinary case for a document assistant. Uploads so far are the
author’s own
and the demo fixture is fictional. That is a narrower claim than the first draft of this ADR
made, and it is the one that survives scrutiny.

Two things kept it open. The privacy caveat made it feel handled, because it was honest. And the
paid tier was believed to cost $250 to enter, which made "later" the obvious answer.

## Options

**Keep the free tier and disable uploads for everyone but the demo.** Honors the rule and costs
nothing. It also removes the only reason to sign in, which turns a working product into a
read-only exhibit.

**Keep the free tier and disclose harder.** What is happening now. The disclosure is accurate,
so this is defensible right up until someone uploads something they should not have — at which
point "we told you" is not much of a position.

**Attach billing to the Google project.** Content submitted under paid terms is not used to
improve Google's products, which is exactly what the rule asks for.

**Split the tiers: the demo on free, signed-in uploads on paid.** The standing rule permits this —
“free tier is for dev + portfolio demo ONLY” is a ceiling on where the free tier may be used, not
a requirement that the demo sit there, and its trigger is real users uploading real documents.
Rejected on engineering grounds rather than compliance ones.

The free tier’s binding constraint is requests per day, shared across the key. The demo is the
surface most likely to see a burst, and Milestone 5’s exit criterion is a stranger reaching a
cited answer — so this arranges for the demo to be the first thing that breaks, at the moment
traffic finally arrives. The fixture is fictional but the _question_ is user-supplied text, which
would put the most casual visitors on the weakest terms. And it costs two Google projects, two
keys, two quota pools, and an actor argument threaded into `lib/ai/provider.ts`, which currently
knows nothing about auth. The saving is cents against a balance that is already capped.

## Decision

Attach billing.

**The $250 was a misreading and it is worth writing down, because it drove the delay.** Google's
Tier 1, Tier 2 and Tier 3 are *rate-limit* tiers, not price plans. Tier 1 needs only a billing
account attached; the $250 is the cumulative spend that later qualifies a project for Tier 2's
higher limits. Nothing is charged up front, and usage is per token from the first request.

Sized against this project's own caps rather than a guess — `globalRequestsPerDay: 800`, on
`gemini-3.5-flash-lite`, the cheapest model in the family:

| Per day, if every day hit the global cap | Tokens |
| ---------------------------------------- | ------ |
| Input (~1.5k per answer)                 | ~1.2M  |
| Output (~300 per answer)                 | ~240k  |

At Flash-Lite's order of magnitude — roughly $0.10 per million input and $0.40 per million
output — that is about **$0.22 a day at the absolute ceiling**, so under $7 a month if the cap
were saturated every single day. Portfolio traffic of twenty to fifty questions a day costs
cents. The rate limiter that already exists is what makes this bounded rather than open-ended:
the worst case is a number, not an unknown.

**There may be nothing to buy.** Google grants paid-service data terms — no training on prompts
or uploaded files — to customers in the EEA, Switzerland and the UK _even on unpaid quota_,
following the account's billing region rather than its plan. If this account is EEA-billed, the
rule is already satisfied and only the wording needs to change. That check comes first, because
it decides whether this is a billing change or a copy change.

## What was done

Billing attached to the Gemini project on 6 August 2026, from a Romanian — therefore EEA —
account. **Prepaid credits, $15, auto-reload declined.**

That combination is the point, and it is worth stating separately from the tier itself. Prepaid
without auto-reload _is_ the spending cap: the worst case, including a leaked key used directly
against the API, is $15 and a stop. Auto-reload would have removed exactly that bound while
appearing to be a convenience.

**It also preserves the failure mode this project was designed around.** An earlier draft of this
ADR warned that attaching a card replaces quota exhaustion with a bill, which would have
undercut ADR 014's premise. With prepaid credits that is wrong: an exhausted balance returns the
same `429` as an exhausted quota, and `route.ts:218` already maps that to the
`capacity_reached` refusal — a state with its own copy, its own tests and its own E2E coverage,
written for the free tier and inherited unchanged. Paid-tier data terms, bounded failure, no new
code.

A monthly spend cap is set on the API as well. It overlaps the prepaid balance rather than
duplicating it: credits bound the _total_ loss, a monthly cap bounds the _rate_, so a key that
leaks quietly cannot drain a year of balance in an afternoon. Two controls, two different
questions.

The $300 Google Cloud welcome credit excludes the Gemini API and offsets none of this.

## Consequences

**Nothing in the application changes, and that is the point.** `lib/ai/provider.ts` names the
model in one place and reads the key from the environment; the tier is a property of the Google
project, not of this code. No migration, no new dependency, no failure mode.

**The privacy page must be updated in the same change as the tier, never before it.** It
currently tells a reader to treat uploads as content they would share with a third party, and a
test pins that sentence — deliberately, so the page cannot quietly start promising more than the
deployment delivers. When billing is attached, that sentence and its test change together.

The spend cap on the Google account is the backstop the rate limiter cannot be: the limiter
counts requests this application admits, and says nothing about a key that leaks.
