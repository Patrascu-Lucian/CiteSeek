# 031 — The local embedding model, and the floor it needs

## Context

Local mode has to turn passages into vectors in the reader's browser. That rules
out `gemini-embedding-001`, which is an API call, and it rules out its floor:
[ADR 020](020-measuring-the-relevance-floor.md) established that a relevance
threshold belongs to the **embedding model**, because cosine distance only means
something relative to the vectors that produced it.

`MAX_DISTANCE_BY_PROVIDER` is a `Record<EmbeddingsProviderName, number>`, so
adding `"local"` to that union made the project fail to compile until a number
existed. That is the constraint working: the alternative is copying Google's 0.4
onto a different model and discovering later that it refuses nothing.

## Measuring it

**`pnpm eval:retrieval` cannot do this.** That harness ingests through Postgres,
and `chunks.embedding` is `vector(768)`; a browser-sized model is 384-wide, so
the insert fails before any number is produced. `pnpm eval:local` measures
without a database — passages and questions embedded in memory, ranked by
`cosineSimilarity`, which is exactly what local retrieval will do. The
measurement matches the mechanism rather than proxying it.

Same golden set as ADR 020: 51 questions over three fixture documents, 41
answerable and 10 the corpus cannot answer.

| Model                      | Dimensions | recall@8 | Best trade                          |
| -------------------------- | ---------- | -------- | ----------------------------------- |
| `Xenova/bge-small-en-v1.5` | 384        | **100%** | 0.50 → 38/41 answered, 6/10 refused |
| `Xenova/all-MiniLM-L6-v2`  | 384        | 95%      | 0.70 → 27/41 answered, 7/10 refused |

MiniLM is the more familiar name and it lost on both axes. Its distances also sit
higher and wider (answerable 0.451–0.861 against bge's 0.313–0.546), which leaves
less room between "relevant" and "unrelated" to put a threshold in.

## Decision

**`Xenova/bge-small-en-v1.5`, with a floor of 0.50.**

The model is **pinned, not a floor version range**: stored vectors are only
comparable to vectors from the same model, so changing it invalidates every
embedding already in a reader's browser.

**bge is asymmetric through an instruction rather than a parameter** — the query
is prefixed with "Represent this sentence for searching relevant passages: " and
the passage is not. That is what keeps the `taskType` argument in the `Embedder`
seam meaningful; MiniLM would have made it decorative, since it treats both sides
identically. Dropping the instruction costs recall and fails nothing, which is the
kind of defect that survives a green suite, so the two task types are asserted
separately in `lib/local/embedder.test.ts`.

**0.50 rather than 0.55.** At 0.55 every answerable question is answered, but only
3 of 10 unanswerable ones are refused. At 0.50, three answerable questions are
wrongly refused and 6 of 10 are correctly refused. The distributions overlap —
answerable 0.313–0.546, unanswerable 0.367–0.655 — so no value separates them and
this is a trade, exactly as ADR 020 found for Google. The project's claim is that
a refusal is honest, so refusing too little is the worse failure.

## Consequences

**The floor is higher than Google's 0.4 and that is not a quality signal.**
recall@8 is 100%: retrieval finds the right passage every time. A 384-wide model
spreads its mass over fewer dimensions, so its distances are simply arranged
differently. Comparing the two numbers to each other would be meaningless, which
is the whole argument for the per-provider table.

**`pnpm eval:local` calls the shipping embedder**, not a copy of it. An earlier
draft duplicated the pipeline and the query instruction in the script; the two
would drift, and the measurement would report a floor for something nobody runs.

**`onnxruntime-node`'s install script is denied in `pnpm-workspace.yaml`.**
transformers.js pulls it in for Node inference.

↳ _Corrected 12 August 2026._ This first said the native binary "is never
loaded". It is: the package ships prebuilt binaries for every platform, so
denying the script skips a postinstall rather than the dependency, and
`pnpm eval:local` runs on it. What is true is that the **browser** never touches
it — that path is `onnxruntime-web`, self-hosted per ADR 032. Declared rather
than left unanswered because pnpm 11 exits non-zero on _every_ command until an
unapproved build script is resolved, which would have failed CI rather than
warned.
