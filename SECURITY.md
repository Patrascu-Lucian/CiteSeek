# Security policy

CiteSeek is a personal project, offered free and without warranty. There is no company behind it,
no bounty, and no service level. Reports are read and acted on in good faith, usually within a few
days — that is a description of how it works, not a commitment.

## Reporting a vulnerability

Use GitHub's
[**private vulnerability reporting**](https://github.com/Patrascu-Lucian/CiteSeek/security/advisories/new)
— it opens a thread visible only to you and the maintainer.

Please don't open a public issue for a security problem. Issues are disabled on this repository, so
private reporting is the route in.

A useful report says what you did, what happened, and what you expected. A proof of concept helps;
a scanner's raw output usually does not.

## What is in scope

- The deployed application at [citeseek.app](https://citeseek.app)
- This repository

**Please do not** run automated scanners or load tests against the live site. Usage is capped per
address and globally, so a scan mostly denies the demo to everyone else — including whoever is
reading this next. If you need volume to demonstrate something, say so in the report and it can be
arranged against a local instance.

## What is out of scope

- **The providers this runs on** — Google (Gemini API), Vercel, Neon, GitHub. Each has its own
  disclosure program, and reports about their infrastructure belong there rather than here. They
  are named on the [privacy page](https://citeseek.app/privacy).
- **Dependency CVEs with no reachable path in this application.** Dependabot alerts are triaged
  already; a report that a transitive package has a published advisory is not by itself a finding.

## Known and accepted

These are recorded decisions rather than oversights, so a report about them will be closed with a
link here:

- **Document text is sent to Google's Gemini API**, on the paid tier, where it is not used to train
  their models. That flow is the product working; it is stated on the privacy page and beside the
  upload control ([ADR 025](docs/decisions/025-paying-for-the-model-tier.md)).
- **The demo can be denied for a day by an attacker with rotating addresses.** Guest limits are
  keyed on a hash of the client address, and the global cap is the only backstop. Cost is bounded
  three separate ways; a day of demo availability is knowingly at risk. See `docs/backlog.md`.
- **Guest conversations are not persisted**, so they are not recoverable. That is deliberate
  ([ADR 013](docs/decisions/013-chat-persistence.md)).
- **Advisories in packages this app never executes** are pinned forward anyway, in
  `pnpm-workspace.yaml`. `sharp` and `adm-zip` arrive through `@huggingface/transformers`, and
  neither is on the path local mode ships: images are never decoded here, and `adm-zip` comes via
  `onnxruntime-node`, while the browser loads `onnxruntime-web`. Pinned rather than argued away,
  because "we do not call it" is a claim that quietly expires.

## Handling of your report

A confirmed vulnerability gets a fix, a note in
[`docs/code-review-notes.md`](docs/code-review-notes.md), and credit in the advisory unless you
would rather not be named. There is no embargo policy beyond the obvious: the fix ships before the
detail does.
