# 042 — One rule for destroying something, and why undo is not it

**Status**: accepted · **Date**: 2026-08-21 · **Milestone**: 8

## Context

Deleting a turn is the fourth destructive action in the product, and `docs/backlog.md` had an
entry saying the three that existed did not agree: an account needs a typed word, a conversation
opens a dialog naming it, and a document "happens on the first click".

The third was false, and had been for some time. `components/documents/document-list.tsx` opens a
full dialog naming the file and exactly what goes with it — "the document, its extracted text and
every passage indexed from it". A comment in `components/chat/conversation-list.tsx` repeated the
same false claim and pointed at the backlog, so the two agreed with each other rather than with
the code.

So there were never three rules. There was one rule, implemented twice, one deliberate escalation,
and two written claims that outlived what they described.

## The rule

**Confirmation scales with what cannot be recovered.**

| Action       | What is lost                                                                | Confirmation                    |
| ------------ | --------------------------------------------------------------------------- | ------------------------------- |
| Account      | Everything, cascading                                                       | A typed word                    |
| Document     | Extracted text and every passage; the file itself is already gone (ADR 009) | A dialog naming it and its cost |
| Conversation | A transcript that cannot be reconstructed                                   | A dialog naming it and its cost |
| Exchange     | One question and the answer grounded in it                                  | A dialog naming it and its cost |

The typed word is the escalation, not the norm, and it is reserved for the case where nothing
survives to undo it with. Everything else names the object and what goes with it, because the
failure being defended against is a misclick landing on the _wrong one_ — which naming fixes and
typing does not.

An exchange joins the middle tier rather than earning a lighter one. The deletion is real: it is a
question, its answer and that answer's stored citations, and no part of it can be regenerated
identically.

## Undo was designed and rejected

The milestone plan proposed undo for this tier, on the grounds that a per-turn delete is frequent
and small enough that a dialog would train the reader to click through it — the argument
`conversation-list.tsx` already makes one level up about typing through a typed word. Both shapes
were designed and neither pays for itself.

**Delete immediately, restore on undo.** Needs an endpoint that accepts message content from the
client, since the server keeps nothing once the rows are gone. That would let a reader write
assistant text carrying citation markers that resolve to real passages — a claim wearing a source
it does not have, which is exactly the failure
[ADR 035](035-where-the-worked-example-goes.md) exists to prevent, arrived at from the inside. It
would also bypass the saved-message cap.

**Defer the delete, commit when the window expires.** Avoids that, and introduces two costs.
Closing the tab inside the window loses the delete — safe, since the data survives, but
surprising. And it holds the cap shut for the length of the window at the exact moment a reader is
deleting to make room, which is the flow the cap's copy now sends them into.

**The frequency premise was also weaker than assumed.** The cap is 40 saved messages, so a
conversation holds at most 20 exchanges. This is not an action anyone performs dozens of times a
day, which is the case that makes a dialog turn into muscle memory.

**Revisit if** deleting turns turns out to be frequent in real use, or if the server comes to hold
deleted rows itself for some other reason — a soft-delete window would make restore safe, because
the content would never round-trip through the client.

## Consequences

**The cap notice can finally name a second way through.** ADR 039's rule is that a stock limit must
say what to delete, and the saved-message cap could not: nothing was deletable inside a
conversation, so it could only offer "start a new conversation". Both branches of that copy changed
in the same commit as the feature.

**Two false statements are gone** — the comment and the backlog entry. Neither was caught by a
test, because neither described behavior a test could reach; they described _other code_, which is
the class of claim this project has now corrected four times.

**The control is revealed rather than always shown**, and that needed three paths rather than one.
Tailwind gates `hover:` behind `@media (hover: hover)`, so a touch screen never receives it — the
gap that made the document row's hover-only affordance invisible on a phone, twice. A hold is the
touch path and focus is the keyboard's, and the button stays mounted and focusable while hidden, so
a screen reader reaches it with no gesture at all. Hidden means `opacity-0` **and**
`pointer-events-none`: invisible but tappable would put an unseen delete under a stray tap.

The hold deliberately does not `preventDefault`. Suppressing the browser's own long-press would
take text selection with it, and quoting an answer is something this product invites — so the two
gestures coexist rather than one winning. Whether that reads well on a real phone is the open
question, and the kind only a device answers.

**Roving tabindex was considered for the transcript and rejected**, recorded in `docs/backlog.md`
so it is not re-raised as new. It is a composite-widget pattern, it does nothing for screen-reader
users whose browse mode intercepts arrow keys before a handler sees them, and it would not remove
the citation chips' tab stops, which are the majority. A skip link to the question box is what
shipped instead, matching the one `app/layout.tsx` already carries — and whose own comment names
this surface as the reason it exists.
