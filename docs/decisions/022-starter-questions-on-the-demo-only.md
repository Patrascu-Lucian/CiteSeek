# 022 — Starter questions on the demo, and nowhere else

## Context

The first cold reader — a senior frontend engineer, given only the URL — found the demo
workspace immediately and then stopped. She clicked the document row repeatedly, trying to open
the handbook. Not to read it: to find out what it was about, **so she would know what to ask**.

An earlier change made the document openable, which was the direct fix. This decision is about
the other half: there was nothing on the screen telling her what the workspace could answer.
The empty chat state offered two sentences and a composer. The refusal path (ADR 017) lists the
document filenames and suggests reusing the document's own wording, but it is reached only by
first asking something that fails — behind the exact step she could not take.

The empty state also said "Ask a question about **your** documents", on a workspace that is
shared, read-only, and seeded. The composer's label and placeholder said the same, and the
screen-reader status said "Searching your documents."

## Options

**Do nothing; the document is openable now.** Cheapest, and it addresses what she did rather
than what she wanted. Reading a handbook to work out what to ask it is a lot of work for a
first minute, and the exit criterion budgets two.

**Generate questions per document at ingest.** Works for every workspace, including uploaded
ones. Costs a model call per upload, adds a failure mode to ingestion, and would need its own
storage and its own answer to "what if the generated question is not actually answerable".
Solving the general problem before the demo problem.

**Hand-author questions for the seeded demo only.** No generation, no per-upload cost, no
ingestion change. Covers the workspace the exit criterion actually tests. Leaves uploaded
workspaces untouched — which is defensible, because someone who uploaded the documents knows
what is in them, and that is exactly the knowledge the reader lacked.

## Decision

Hand-authored questions, shown only when `workspaces.is_demo` is true, in
`lib/demo/example-questions.ts`. Clicking one asks it. The "your documents" wording becomes
"the handbook" on the demo, in the empty state, the composer label, the placeholder, and the
live-region status.

**The three questions were chosen by measurement, not taste.** Each was embedded with the real
`gemini-embedding-001` and scored against the chunked fixture, checking two things: does the
nearest passage clear the relevance floor, and does the passage that actually contains the
answer come back at a useful rank.

| Question                                                  | Top distance | Answer at |
| --------------------------------------------------------- | ------------ | --------- |
| How many days of annual leave do employees get?           | 0.300        | rank 1    |
| How many hours a day do I have to overlap with my team?   | 0.295        | rank 1    |
| Can I put company documents in my personal cloud storage? | 0.275        | rank 2    |

The floor is 0.40 (ADR 020), so all three clear it comfortably. They were picked from three
different sections of the handbook, so the demo shows citations landing in different places
rather than three variations on one paragraph. The third is deliberately worded unlike the
document — it says "personal cloud storage" where the handbook says "Personal accounts may not
be used for company work, including cloud storage" — because a starter question that only works
by keyword match would demonstrate the wrong thing.

**This measurement also disqualified the obvious candidate.** "When is reimbursement paid?" is
what `e2e/chat.spec.ts` has used as its answerable question since Milestone 2, and reusing it
would have removed a duplicated string. With the real embedder the passage containing "within
30 days of an approved claim" comes back at **rank 6**. It is inside `RETRIEVAL_LIMIT` (8) so
the answer is correct, but it is the weakest question in the set and would have been the first
thing a stranger clicked.

## Consequences

Suggested questions can make a demo read as a scripted tour, where only the sanctioned
questions work. That risk is real and is accepted for one reason: the refusal path is already
good. A reader who ignores the chips and asks something else gets a written refusal naming what
the documents do cover — so going off-script demonstrates the product's actual claim rather
than hitting a wall. The chips are labeled "Or start with one of these", not "Try asking".

The questions are coupled to the fixture. Changing the handbook means re-running the check;
`lib/demo/example-questions.ts` says so, and it is the only place they are written down —
`e2e/chat.spec.ts` imports the constant rather than repeating a string, so a question that
stops being offered fails a test rather than silently drifting.

Uploaded workspaces still open on an empty composer. That is the smaller problem — the person
who uploaded the file knows what is in it — and per-document generation stays in
`docs/backlog.md` until someone has real documents to test it against.
