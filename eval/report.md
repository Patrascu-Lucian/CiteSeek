# Retrieval evaluation

Run 2026-08-07 against `gemini-embedding-001`,
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

| strategy    | k   | recall | precision | MRR  |
| ----------- | --- | ------ | --------- | ---- |
| lexical     | 1   | 0.39   | 0.39      | 0.39 |
| lexical     | 3   | 0.66   | 0.26      | 0.50 |
| lexical     | 8   | 0.76   | 0.21      | 0.52 |
| hybrid 0    | 1   | 0.67   | 0.68      | 0.68 |
| hybrid 0    | 3   | 0.95   | 0.34      | 0.81 |
| hybrid 0    | 8   | 1.00   | 0.14      | 0.82 |
| hybrid 0.25 | 1   | 0.65   | 0.66      | 0.66 |
| hybrid 0.25 | 3   | 0.85   | 0.29      | 0.76 |
| hybrid 0.25 | 8   | 1.00   | 0.13      | 0.79 |
| hybrid 0.5  | 1   | 0.60   | 0.61      | 0.61 |
| hybrid 0.5  | 3   | 0.85   | 0.29      | 0.73 |
| hybrid 0.5  | 8   | 1.00   | 0.13      | 0.77 |
| hybrid 0.75 | 1   | 0.61   | 0.61      | 0.61 |
| hybrid 0.75 | 3   | 0.85   | 0.29      | 0.73 |
| hybrid 0.75 | 8   | 1.00   | 0.13      | 0.77 |
| hybrid 1    | 1   | 0.61   | 0.61      | 0.61 |
| hybrid 1    | 3   | 0.85   | 0.29      | 0.73 |
| hybrid 1    | 8   | 1.00   | 0.13      | 0.77 |

## The relevance floor

The two errors move in opposite directions, so no threshold minimizes both.
A false refusal is a question the corpus could answer and did not; a false
accept is an ungrounded question reaching the model.

### Closest chunk per question

Where a floor could ever sit. The two ranges overlap, which is the finding:
no single distance separates them cleanly.

|              | min   | median | max   |
| ------------ | ----- | ------ | ----- |
| answerable   | 0.276 | 0.325  | 0.411 |
| unanswerable | 0.332 | 0.422  | 0.494 |

| max distance | false refusals | false accepts |
| ------------ | -------------- | ------------- |
| 0.15         | 41/41          | 0/10          |
| 0.20         | 41/41          | 0/10          |
| 0.25         | 41/41          | 0/10          |
| 0.30         | 33/41          | 0/10          |
| 0.35         | 9/41           | 3/10          |
| 0.40         | 1/41           | 5/10          |
| 0.45         | 0/41           | 7/10          |
| 0.50         | 0/41           | 10/10         |
| 0.60         | 0/41           | 10/10         |
| 0.70         | 0/41           | 10/10         |
| 0.80         | 0/41           | 10/10         |
