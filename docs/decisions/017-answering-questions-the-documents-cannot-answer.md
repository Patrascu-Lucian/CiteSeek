# 017 — Answering questions the documents cannot answer

**Status**: accepted · **Date**: 2026-08-02 · **Milestone**: 4

## Context

Grounding here is structural. When retrieval returns nothing above the relevance floor, the model
is **never called** — there is no prompt, no generation, and a fixed server-side sentence is
streamed instead. That is what makes "I don't know" a property of the system rather than an
instruction a model follows most of the time, and it is the guarantee the citation design rests
on: a marker cannot be fabricated because a marker with no matching source has nothing to render.

The cost of that design showed up in real use. Asked **"how do I upload a file?"**, the assistant
refuses. It is right to: the answer is not in anyone's documents. But the reader is shown a
sentence saying nothing relevant was found, with no way to tell whether they asked badly, whether
their upload failed, or whether the product is broken. The refusal was correct and useless.

Two adjacent observations sharpened it. Questions like "how are you?" and "test" **cleared** the
floor in production and reached the model, so the structural refusal is not the only path that
needs to decline well. And the model's own refusals read like a debugger — _"The provided passages
do not contain information to answer how I am"_ — which describes its inputs rather than
answering the person.

## Options

**Seed a document about the product.** Rejected, and it had already been tried and abandoned once
in this repo. Self-referential text in the corpus is retrievable and citable, so the assistant
would answer questions about itself with a chip pointing at a document the user never uploaded,
in a list beside documents they did. It also converts every product copy change into a re-indexing
job, and in a shared demo workspace it is text every visitor can retrieve.

**Add a second, ungrounded answering path** — detect a product question, answer it from a static
knowledge base or a separate prompt. Rejected. It gives the model somewhere to answer from that is
not the user's documents, which is the one thing the whole design exists to prevent. The
classifier deciding which path a question takes would itself be a model call that can be wrong, and
when it is wrong the failure is an ungrounded answer that looks exactly like a grounded one.

**Make the refusal say where the answer lives.** Chosen.

## Decision

The refusal carries a **reason** and the client renders the affordances.

The route emits a `data-refusal` part alongside the text, in the same shape as the existing
`data-sources` part, carrying one of two values: `no_relevant_passages` (there was something to
search and none of it matched) or `no_documents` (nothing is indexed at all). Telling those apart
costs one extra query, on the refusal branch only, because the alternative is telling someone to
upload a document they have already uploaded.

Everything the reader then sees is **written by us and rendered by the client** — what the
assistant can answer from, listed by filename; that its knowledge does not extend past those files,
including to this app; a suggestion to rephrase using the document's own wording; and one
affordance appropriate to the reader (upload here, go to your own workspace, or sign in). No model
is involved at any point. A turn that could not be grounded must not produce prose that reads as
though it had been.

The document list comes from the client's current props rather than from the stored part, so a
document uploaded _since_ the refusal appears in it — the list answers "what can I ask about now",
not "what was searchable a minute ago".

Separately, one rule is added to the system prompt about _how_ to decline, for the branch this does
not cover: the model reaches the floor-clearing cases, and its refusals must address the reader
rather than narrate its own context window.

## Consequences

**The refusal is now a UI surface with its own states**, and anything added to it is product copy
rather than retrievable text. That is the trade: it cannot be edited by uploading a file, and it
cannot be cited, but it also cannot be personalized or reasoned about. Adding to it means writing
a component, not indexing a document.

**A refusal must never render a citation.** The two parts are mutually exclusive by construction —
the branch that emits one is the branch where the other cannot exist — and this is asserted at
three levels: an integration test that a grounded answer carries no refusal part, a unit test that
the transcript draws no chip for a refusal, and an end-to-end test asking the product question
against the demo. A refusal that cites would be claiming a source for a claim it did not make.

**The reason must survive a reload.** A refused turn is persisted like any other, and rebuilding
it from the stored row needs the reason back. Deriving it by comparing the stored text against the
refusal string would break the moment that sentence is reworded, so it is stored: a nullable
`refusal_reason` column, added in the following slice.

**The relevance floor is untouched.** Loosening it would have made this particular symptom go away
by letting weak matches through, at the cost of the Milestone 2 guarantee. The floor is the reason
the refusal exists, not a bug in it.
