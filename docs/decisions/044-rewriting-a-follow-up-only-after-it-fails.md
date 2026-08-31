# 044 — Rewriting a follow-up, only after it has already failed

Status: accepted, 23 August 2026.

## Context

Only the last message is embedded. `questionFrom` walks back to the newest user
turn and returns its text, so "how much?" reaches retrieval as those two words —
the subject is in the previous turn and nothing carries it forward. The refusal
that follows is correct and useless.

This was measured before it was built. `FOLLOW_UP_SET` in `eval/golden-set.ts` is
ten information needs written twice, as a reader types them after a previous turn
and as they would have to be written to stand alone:

**recall@3 is 0.70 as asked, against 1.00 standalone.** Three in ten fail, and the
standalone column being a clean 1.00 means a perfect rewrite recovers all three.
That is a ceiling, not an estimate. The full table is in `eval/report.md`.

↳ **Amended, 28 August 2026.** The ceiling is now reached rather than assumed: the
harness scores the shipped rewrite as a third column, and it reads 1.00. Getting
there took a one-word prompt change — asking for "a standalone question" rather
than "a standalone search query", which had been returning keyword bags that embed
nowhere near the passage answering them, and are also what the reader is shown
under "Searched for". The query form measured 0.90 and sent one row backwards.
The number remains a floor rather than a description: the eval's history holds
only the reader's own prior turns, where production also has the answers.

Two things the measurement changed about the plan. Carrying a discriminative term
does not predict success — `"in writing?"` holds a word straight out of the
passage it wants and still scores 0.00, while two follow-ups carrying nothing
score 1.00 — so the feature could not be scoped to "short questions". And
`eval/distances.json` shows only one of the ten sitting above the shipped 0.40
floor, so the floor is not what is refusing these.

## Decision

**Rewrite only when the first retrieval returned nothing.** Not before every
question. A rewrite is a model call, and putting one in front of every message
would add it to the published TTFT for the 70% of follow-ups that already work.
The empty branch is already the slow, already-failing path — it runs an extra
`countSearchableChunks` query for the same kind of reason.

**And only when the reason is `no_relevant_passages`.** An empty workspace has
nothing to search however the question is phrased, so `no_documents` never pays
for a model call.

**Show the reader what was searched.** Rendered above the answer as
"Searched for: …". The alternative — rewriting silently — was
rejected because the failure mode is an answer that is fluent, grounded, cited,
and about the wrong thing. Nothing else on screen would explain it. Screen
readers get "Your question was rephrased" rather than the bare label, because the
visual line reads as a caption and the announcement has to carry the fact.

**Persist it.** `messages.rewritten_question`, nullable, alongside
`refusal_reason` and for the same reason: a reloaded transcript is rebuilt from
rows, and a line that vanishes on refresh makes the stored turn and the streamed
turn disagree about what happened.

**Cloud path only.** Local mode keeps today's behavior. A rewrite there is a
second on-device generation in front of a reader who is already waiting on a
WebGPU model, and the cost lands exactly where the experience is worst. Revisit
if local generation gets fast enough that the second call is not felt.

↳ **Revisited 31 August 2026, on a condition this paragraph did not anticipate.**
Local generation is no faster. What was wrong is the assumption underneath —
that recovering a follow-up requires a model at all. Prepending the reader's
previous turn retrieves the answering passage 10 times in 10 where the follow-up
alone manages 3, matching the standalone ceiling for one embedding and no
generation ([ADR 048](048-a-follow-up-that-costs-no-generation.md)). The cost
this paragraph refused to pay is still refused.

## Message metadata, not a data part

It was a data part first, written beside `data-sources` before the model's first
token — which is the right order for sources, because a chip cannot resolve a
marker that arrives after the text mentioning it.

The stream that produces is `data-sources | data-searchedFor | start | text-…`.
Both parts land ahead of the `start` that opens the assistant message, so the
client builds one message from them and a second from `start`. With sources alone
the extra message renders nothing and nobody noticed. A line of visible text made
it obvious: the rewritten question appeared twice, once above an empty bubble.

`messageMetadata` on `toUIMessageStream` rides on the `start` chunk itself, so it
cannot be attached to anything but the message carrying the answer. A reloaded
turn sets the same metadata from `messages.rewritten_question`, which keeps
"streamed" and "restored" identical — the property `to-ui-messages` exists for.

## A failed rewrite must not cost the refusal

`rewriteQuestion` returns `null` on any provider error rather than throwing. The
turn it runs on has already failed to retrieve; letting an error escape converts
a refusal the reader can act on into a broken stream.

This is not hypothetical. The first version let it throw, and the fake chat model
implements only `doStream` — so in local development every follow-up produced
"the answer failed" instead of a refusal. The route's integration tests all
posted a single message, which never reaches the rewrite, so the suite stayed
green while the feature was unusable by hand.

## Consequences

- Two extra metered calls on the branch that takes them: the rewrite's tokens as
  `chat`, the second embedding as `embedding`. A reader cannot spend tokens off
  budget by asking vague follow-ups.
- A conversation of one message never reaches the model. There is no earlier
  turn to recover a subject from, so a rewrite could only invent one.
- The validator rejects a rewrite that merely echoes the question — nothing was
  gained, and the caller has already searched for exactly that string.
- The set this was measured against had to be rebuilt first: five of its ten
  cases expected the sentence that answers their own context turn, which scores
  1.00 whether or not the follow-up was understood.
