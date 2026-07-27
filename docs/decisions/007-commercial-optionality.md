# 007 — Keeping commercial optionality without building for it

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0

## Context

CiteSeek is a portfolio project. It may also become a commercial product if it gains
traction — but that is a possibility, not a plan, and the two goals pull in different
directions if handled carelessly. Building billing, terms of service and a compliance
program for a product with no users is the fastest way to ship nothing.

The useful question is therefore narrow: **which decisions taken now would be expensive or
impossible to reverse later, and which are merely a settings change?** Only the first group
deserves attention today.

## Decision

**Optimize for the portfolio. Protect the one-way doors. Defer everything else until there
is revenue to justify it.**

### One-way doors — get these right now

**Tenant isolation.** Already mandated in CLAUDE.md: every query helper in `lib/db` and
`lib/rag` takes a workspace scope, and unscoped query functions must not exist. Retrofitting
isolation into a codebase that assumed a single tenant means auditing every query ever
written. With paying customers a cross-tenant leak stops being a bug report and becomes a
breach notification. This is the single most important line in the project's conventions.

**Data residency.** Neon and the Vercel functions are both in Frankfurt (`eu-central-1` /
`fra1`), chosen in ADR 006 for latency. It also happens to keep customer data in the EU,
which is the easy answer to the first question any European customer asks. Moving a
populated database between regions later is a migration; choosing the region now is free.

**Not training third parties on customer documents.** Gemini's terms grant paid-service
data protections to customers in the EEA, Switzerland and the UK _even on free tiers_ — so
prompts and uploaded documents are not used to improve Google's products. This is a
consequence of where the account is billed, not of the plan, and it should be re-verified
before any claim is made to a user. See the correction in ADR 002.

**License.** The repository is public with no license file, which under default copyright
means all rights reserved. Adding MIT or Apache "because that is what repositories have"
would grant anyone the right to commercialize the code. Revisit only if revenue appears.

### Reversible — ignore until it matters

- **Vercel Hobby → Pro.** Hobby is restricted to non-commercial personal use, so the first
  paying customer requires Pro at $20/month. This is a billing page, not a migration.
- **Neon free → paid.** Same shape: a limit, not a lock-in.
- **Gemini free tier → paid.** Rate limits are the binding constraint long before cost is.
- **Billing, subscription tiers, invoicing.** None of this should exist yet.
- **Terms of service, privacy policy, sub-processor list, DPA.** Required before taking
  money from customers in the EU; worthless before that, and easier to write once the
  product's actual data flows are settled.

## Consequences

- **The roadmap does not change.** Milestones 1–6 are the same whether or not this ever
  earns anything, because a product good enough to charge for and a project good enough to
  interview on are largely the same artifact.
- **The repository is public**, which resolves two earlier open questions: GitHub branch
  protection is free on public repositories, and Actions minutes are unlimited. The advice
  to consider GitHub Pro no longer applies.
- **Guest mode stays.** It exists so an interviewer can evaluate the product in thirty
  seconds; it is also, coincidentally, a frictionless trial. The abuse controls it needs are
  the same in both readings.
- If commercial intent ever hardens, the first three items to revisit are a privacy policy,
  Vercel Pro, and a cross-tenant leakage test in CI. Not billing.

## What this ADR is not

An argument that the project should be commercialized. It is a record of which doors were
deliberately left open, so that a future decision is not foreclosed by an accident today.
