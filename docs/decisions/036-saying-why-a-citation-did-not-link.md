# 036 — Saying why a citation did not link

## Context

[ADR 011](011-retrieval-and-citation-strategy.md) makes an invented marker unlinkable:
`linkCitationMarkers` rewrites `[n]` as a chip only when `n` names a passage that was actually
retrieved, and leaves anything else as literal text. The property held in production, on a real
document, against a 0.5B model that wrote `[2]` when one passage had been found.

Then the reader typed **"that citation is not clickable"** — and the reader was the person who
wrote the rule making it unclickable.

That is the whole context. A dead number is indistinguishable from a broken button. The one
moment the system catches a model inventing a source is the moment the page looks most broken,
and a safety property that reads as a defect eventually gets "fixed" by someone who does not
know what it was for.

## Decision

**Name the invented numbers under the answer, and say what they mean.**

`unresolvedMarkers(text, sources)` reports the distinct markers the model wrote that no
retrieved passage backs. When there are any, `Answer` renders one line beneath the prose:

> ⚠ **[7]** is not one of the passages found, so it is not a link. Treat that claim as
> unsupported.

Three things it deliberately does:

**It names the number**, so the reader can match the note to the sentence carrying it rather
than hunting.

**It says "unsupported", not "error".** Nothing failed. The model referred to a source that does
not exist, which is information about the answer — and it is the reader's cue to distrust that
sentence specifically rather than the feature generally.

**It stays quiet when every marker resolves**, which is nearly always on the cloud path. A
warning in front of every reader for something that is working is how warnings stop being read.

## Consequences

**Two functions, one regex.** `unresolvedMarkers` shares `GROUPED_MARKER` and `MARKER_NUMBER`
with `linkCitationMarkers` rather than re-deriving what a marker looks like. If those disagreed,
the note would describe a different set of markers than the one the linker refused — the worst
possible outcome for a message whose entire job is explaining the linker.

**The all-or-nothing rule stays.** A run like `[1][9]` is left wholly literal, so `[1]` does not
link either; the note names `[9]`, the number that does not exist. Linking the valid half would
quietly launder a half-invented citation, which is why that rule exists.

**Only the marker case is covered, and it is not the worst one.** During the same testing, the
model answered "you can upload up to 2 files" — false, specific, confident, and carrying **no
marker at all**. Rule 2 requires a citation on every factual claim, so an uncited answer is a
rule violation the reader cannot see, and it leaves no artifact for this note to hang on.

Detecting it is easy — count the resolvable markers. Acting on it is not: a model-written
refusal ("the documents do not cover that") is correctly uncited under rule 4, so a naive "this
answer cites nothing" warning would fire on the honest case as often as the dishonest one. That
needs a decision about telling those apart, and is in `docs/backlog.md` rather than guessed at
here.
