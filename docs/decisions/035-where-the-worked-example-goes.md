# 035 — Where the worked example goes, and why the array is not it

## Context

[ADR 033](033-answering-locally.md) gave the local model a one-shot example, because rule 2 of
the system prompt — cite every claim inline as `[1]` — produced no markers at all from either
the 0.5B or the 1.5B. The example restored them, and it was delivered the obvious way: a
`user` turn and an `assistant` turn prepended to the question.

That is the defect. **A message is not an illustration to a model; it is something that was
said.**

Manual testing against a real CV found it. Asking `cite` returned:

> The passage [1] says the office closes at six.

which is the example's own _user_ turn, so the model was not echoing an answer — it was
answering _out of_ the example, treating it as retrieved material. Generation is
`do_sample: false`, so this reproduced on every attempt. The marker resolved, because a
passage had been retrieved, and the chip opened a paragraph of the reader's CV that had
nothing to do with any office.

A fabricated claim wearing a working citation is the precise failure
[ADR 011](011-retrieval-and-citation-strategy.md) exists to prevent, reachable by typing one
word.

## Decision

**The example moves into the system prompt, and is built from the retrieved passage.**

Two changes, addressing two different things.

**Out of the message array**, because nothing in that array can be marked as hypothetical
reliably enough to matter at this size. `generateLocally` now sends exactly two messages: the
system prompt, and the reader's question.

**Derived from `sources[0]`** rather than fixed, so the residual risk is defanged rather than
argued away. A model that parrots the example now quotes the reader's own document and cites
the passage it actually names. The failure mode degrades from fabrication to redundancy.

The first sentence that _starts_ a sentence is chosen, not the first substring: chunks are cut
on character offsets, so a chunk usually opens mid-clause, and demonstrating a fragment made
the model answer with a fragment.

## Measured

Same machine, same model, one document, `pnpm dev`:

| probe                            | before                           | after                                 |
| -------------------------------- | -------------------------------- | ------------------------------------- |
| `cite`, `citation`, `cite again` | "the office closes at six" `[1]` | a complete sentence from the document |
| a real question                  | cited                            | still cited, chips clickable          |

The second row is the one that could have sunk this. ADR 033 measured that the rules alone
produced no markers, so moving the example was a real risk of trading a fabrication bug for a
mode that cites nothing. It did not: answers still carry chips that open the panel.

Scope of that claim: two questions, one document, one machine. Enough to ship, not enough to
call it characterized.

## Consequences

**The test that was missing asserted shape, not content.** The original tests checked that the
example was present and that its marker looked right — they passed no matter how badly it
leaked, because they described what we sent rather than what it could be mistaken for. What
guards it now:

```ts
expect(messages).toHaveLength(2);
expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
```

Anything else in that array is transcript. That assertion cannot be satisfied by a leak.

**No automated check could have found the original.** The suite fakes the generator so CI does
not download 756 MB, so nothing in it ever sees a real model read a real prompt. `cite` is also
not a question anyone writing tests would think to write. The defect needed a person, a real
document, and an odd thing to type.

**Three guards were seen firing during the same session**, none by a test: an invented `[2]`
stayed inert text rather than becoming a link; markdown links the model reproduced out of the
document rendered through `InertLink` with no anchor; and the grounded example, when parroted,
quoted the reader instead of inventing. The structural properties hold outside the suite —
which is the only place it counts.
