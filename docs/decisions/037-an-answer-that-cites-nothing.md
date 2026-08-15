# 037 — An answer that cites nothing

## Context

[ADR 036](036-saying-why-a-citation-did-not-link.md) explained the marker a model
_invented_. This is the case it left open, and it is the worse one.

Asked "how many files can i upload?", the local model answered:

> you can upload up to 2 files

False, specific, confident, and carrying **no marker at all**. Rule 2 of the system prompt
requires a citation on every factual claim, so an uncited answer is a rule violation — but it
leaves no artifact. Nothing renders oddly, nothing is inert, and the reader has no signal. The
inert marker ADR 036 explains is the _detectable_ case; this one is invisible.

Counting citations is trivial. The reason this sat in the backlog is that **an uncited answer is
sometimes correct**: rule 4 says never attach a marker to a refusal, so a model that writes "the
documents do not cover that" is behaving exactly as told. A "this answer is unsupported" warning
would fire on the honest case as often as the fabricated one, and a warning that cries wolf on
correct behavior is worse than none — which is the lesson the inert marker had already taught.

## Decision

**State the fact; name both readings; judge neither.**

When passages were retrieved and the finished answer cites none of them:

> ⚠ **Nothing here is cited.** A refusal is expected to cite nothing — anything else is the
> model's own words rather than your documents.

The deadlock was self-inflicted. Every wording tried before said something about the answer's
_quality_, which requires knowing whether a sentence is a claim or a refusal — and nothing on
this side of the model can know that. The sentence above says only what happened, which is true
in both cases, and hands the reader the one distinction they can make instantly and we cannot.

## Consequences

**Three conditions, and each removes a false positive.**

`sources.length > 0` — the refusal the route writes has no passages at all, so citing none is
the only possible outcome and there is nothing to report. That path already announces itself
through `data-refusal`.

`text.trim().length > 0` — an answer that failed mid-stream is an error, not an uncited claim.

`settled` — every answer cites nothing before its first marker arrives. Without this the note
flashes on every reply in the moment before it earns a chip, which would have made it furniture
within a day. `ChatPanel` already knows `status === "streaming"`; the flag rides down through
`MessageList` to the last message, the only one that can be mid-stream.

**It applies to cloud mode too, deliberately.** Gemini follows rule 2 far more reliably, so the
note will be rare there — but an ungrounded answer is exactly as dangerous whichever model wrote
it, and scoping the check to the mode we currently distrust would be an assumption rather than a
guarantee. If it turns out to fire on Gemini's own refusals often enough to be noise, that is a
measurement worth having rather than a risk worth pre-empting.

**What it still does not do.** It cannot tell a fabricated sentence from an honest one, and it
does not try. A model that cites a real passage for a claim that passage does not support
produces no signal here at all — the marker resolves, the chip opens, and the answer looks
perfectly sourced. That gap is the subject of the note in `docs/backlog.md` about what a
resolving citation does and does not prove, and closing it needs an entailment check rather than
a count.
