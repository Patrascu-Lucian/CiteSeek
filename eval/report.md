# Retrieval evaluation

Run 2026-08-28 against `gemini-embedding-001`,
3 documents, 51 questions
(41 answerable, 10 not).

Questions are written against what the documents mean rather than from their
headings, and expected passages are recorded as quotes so re-chunking moves
the mapping instead of invalidating it.

## Ranking, over the answerable questions

Reciprocal rank fusion compares positions rather than scores, because a cosine
distance and a `ts_rank_cd` are not the same kind of number. The weight below is
the lexical list's, against a vector weight of 1 — so **hybrid 0 is vector
alone**, on the same sweep rather than beside it.

| strategy | k | recall | precision | MRR |
| -------- | - | ------ | --------- | --- |
| lexical | 1 | 0.41 | 0.41 | 0.41 |
| lexical | 3 | 0.66 | 0.25 | 0.52 |
| lexical | 8 | 0.73 | 0.20 | 0.53 |
| hybrid 0 | 1 | 0.67 | 0.68 | 0.68 |
| hybrid 0 | 3 | 0.95 | 0.34 | 0.81 |
| hybrid 0 | 8 | 1.00 | 0.14 | 0.82 |
| hybrid 0.25 | 1 | 0.62 | 0.63 | 0.63 |
| hybrid 0.25 | 3 | 0.85 | 0.29 | 0.74 |
| hybrid 0.25 | 8 | 1.00 | 0.13 | 0.78 |
| hybrid 0.5 | 1 | 0.61 | 0.61 | 0.61 |
| hybrid 0.5 | 3 | 0.85 | 0.29 | 0.73 |
| hybrid 0.5 | 8 | 1.00 | 0.13 | 0.76 |
| hybrid 0.75 | 1 | 0.59 | 0.59 | 0.59 |
| hybrid 0.75 | 3 | 0.85 | 0.29 | 0.71 |
| hybrid 0.75 | 8 | 1.00 | 0.13 | 0.75 |
| hybrid 1 | 1 | 0.59 | 0.59 | 0.59 |
| hybrid 1 | 3 | 0.85 | 0.29 | 0.71 |
| hybrid 1 | 8 | 1.00 | 0.13 | 0.75 |

## Follow-up questions

Only the last message is embedded, so a follow-up carries nothing to retrieve
against. Each row is one information need asked three ways — as typed, written
by hand to stand alone, and put through the shipped rewrite (ADR 044).

**Standalone is the ceiling; rewritten is the distance traveled to it.** The
hand-written column is what a perfect rewrite would produce, so it is evidence
about the idea; the rewritten column is evidence about the prompt.

**Every row is rewritten here; production rewrites almost none of them.** The
route only calls the rewrite when retrieval returned nothing past the 0.40
floor, and `distances.json` puts one of these ten above it. So this column
measures how good the rewrite is when it runs, not how often it runs — which
is what tuning the prompt needs, and is not a claim about recall in the
product.

Vector alone, and the floor is off as it is everywhere above — so a row
scoring 1.00 here can still be refused in the product, where the floor is
0.40. The closest distance for the typed form is in `distances.json`.

| follow-up | as asked | rewritten | standalone | the rewrite |
| --------- | -------- | --------- | ---------- | ----------- |
| and the fault code? | 1.00 | 1.00 | 1.00 | What is the fault code? |
| on premier? | 1.00 | 1.00 | 1.00 | Is support covered at the weekend on premier? |
| how often? | 1.00 | 1.00 | 1.00 | how often does the press take oil? |
| and the filter? | 1.00 | 1.00 | 1.00 | What oil does the press take and the filter? |
| what about the deposit? | 1.00 | 1.00 | 1.00 | What about the deposit for a cat? |
| in writing? | 0.00 | 1.00 | 1.00 | How much notice must I give to leave in writing? |
| how much is it? | 1.00 | 1.00 | 1.00 | How much is the deposit? |
| why? | 0.00 | 1.00 | 1.00 | Why are resolution times guaranteed for a Severity 3 defect? |
| who handles it then? | 1.00 | 1.00 | 1.00 | _declined_ |
| and outside them? | 0.00 | 1.00 | 1.00 | What are the coverage hours outside them? |

Mean **0.70 as asked**, **1.00 rewritten**, **1.00 standalone**. Recall@3 throughout.

## The relevance floor

The two errors move in opposite directions, so no threshold minimizes both.
A false refusal is a question the corpus could answer and did not; a false
accept is an ungrounded question reaching the model.

### Closest chunk per question

Where a floor could ever sit. The two ranges overlap, which is the finding:
no single distance separates them cleanly.

| | min | median | max |
| - | --- | ------ | --- |
| answerable | 0.276 | 0.325 | 0.411 |
| unanswerable | 0.332 | 0.422 | 0.494 |

| max distance | false refusals | false accepts |
| ------------ | -------------- | ------------- |
| 0.15 | 41/41 | 0/10 |
| 0.20 | 41/41 | 0/10 |
| 0.25 | 41/41 | 0/10 |
| 0.30 | 33/41 | 0/10 |
| 0.35 | 9/41 | 3/10 |
| 0.40 | 1/41 | 5/10 |
| 0.45 | 0/41 | 7/10 |
| 0.50 | 0/41 | 10/10 |
| 0.60 | 0/41 | 10/10 |
| 0.70 | 0/41 | 10/10 |
| 0.80 | 0/41 | 10/10 |
