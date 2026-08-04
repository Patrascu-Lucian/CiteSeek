# Retrieval evaluation

Run 2026-08-04 against `gemini-embedding-001`,
3 documents, 45 questions
(35 answerable, 10 not).

Questions are written against what the documents mean rather than from their
headings, and expected passages are recorded as quotes so re-chunking moves
the mapping instead of invalidating it.

## Ranking, over the answerable questions

| k   | recall | precision | MRR  |
| --- | ------ | --------- | ---- |
| 1   | 0.70   | 0.71      | 0.71 |
| 3   | 0.97   | 0.35      | 0.83 |
| 8   | 1.00   | 0.14      | 0.84 |

## The relevance floor

The two errors move in opposite directions, so no threshold minimizes both.
A false refusal is a question the corpus could answer and did not; a false
accept is an ungrounded question reaching the model.

### Closest chunk per question

Where a floor could ever sit. The two ranges overlap, which is the finding:
no single distance separates them cleanly.

|              | min   | median | max   |
| ------------ | ----- | ------ | ----- |
| answerable   | 0.284 | 0.325  | 0.411 |
| unanswerable | 0.332 | 0.422  | 0.494 |

| max distance | false refusals | false accepts |
| ------------ | -------------- | ------------- |
| 0.15         | 35/35          | 0/10          |
| 0.20         | 35/35          | 0/10          |
| 0.25         | 35/35          | 0/10          |
| 0.30         | 29/35          | 0/10          |
| 0.35         | 8/35           | 3/10          |
| 0.40         | 1/35           | 5/10          |
| 0.45         | 0/35           | 7/10          |
| 0.50         | 0/35           | 10/10         |
| 0.60         | 0/35           | 10/10         |
| 0.70         | 0/35           | 10/10         |
| 0.80         | 0/35           | 10/10         |
