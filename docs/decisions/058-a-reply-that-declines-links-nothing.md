# 058 — A reply that declines links nothing

## Context

When retrieval finds nothing relevant, the refusal is written by CiteSeek and the model never runs
([ADR 017](017-answering-questions-the-documents-cannot-answer.md)). When the floor admits a
question the documents cannot answer, the model writes the refusal, and rule 4 of the system prompt
forbids it to carry a marker. It carries one anyway: `eval/refusals.md` measures 2 of the 5 golden
refusals and 9 to 11 of the 15 uncovered ones per run with a marker
([ADR 055](055-a-second-signal-measured-and-not-shipped.md)).

Rewording rule 4 cannot be shown to help. Three wordings measured within each other's range, and
telling a rate near 0.3 from 0.1 takes about 62 leaked questions per variant against the five the
golden set has (`docs/backlog.md`, 12 September 2026). A rule enforced in code can be shown to work,
which is the argument the rest of this project makes.

What makes that buildable is that the declining form is now fixed. Rule 7 asks for "The documents do
not cover X", and 59 of the 60 committed replies open with exactly that.

The marked refusals come in two shapes, both in the committed runs:

- **A partial answer.** _"The documents do not cover the warranty period on the hydraulic pump; they
  only mention that defeating the guard interlock voids the warranty for the press [7]."_ The `[7]`
  points at a passage that does say something relevant.
- **A table of contents.** _"The documents do not cover whether the press comes in a wider bed size;
  they cover the Harbourline HL-90 Bench Press (serial range 4400–5200), detailing its safety
  requirements, … and daily checks [1][2][3][4][5][6]."_ Six markers on a list of topics: the shape
  rule 4 exists to stop.

## Options

- **Link no marker in a reply that opens by declining.** The markers stay in the text, rendered plain,
  with one note saying why. The partial answer loses a link to a relevant passage.
- **Keep the links.** The reader keeps a sourced "here is what the documents do have", and the
  measured gap stays a behavior the prompt discourages and nothing enforces.
- **Unlink only the declining sentence.** Rejected: in both shapes the markers sit in the same
  sentence as the decline, after a semicolon, so there is nothing to split. Telling the two shapes
  apart needs a reading of the clause after the decline, which is a heuristic guarding a guarantee.

## Decision

**A reply that opens with "The documents do not cover" renders none of its markers as links.** They
stay plain text, and one note follows the reply, in the same register as the note for an invented
marker ([ADR 036](036-saying-why-a-citation-did-not-link.md)): the reply declines the question, so its
markers are not links. When this note shows, the invented-marker and nothing-cited notes do not, as
the answer already avoids two warnings for one situation.

**The detector matches the exact opener, and nothing looser.** One of the 60 committed replies
declined as "The documents do not specify…", with a marker, and an exact match misses it. Widening to
"The documents do not" would also catch a true answer such as "The documents do not require a
certificate for absences of seven days or fewer [3]", and unlinking a correct citation is worse than
missing a decline. The opener is one constant, which rule 7 is written from and the detector reads,
so the instruction and the check cannot drift apart. It lives beside the detector in
`lib/ai/citations.ts` rather than in the prompt module, because the page loads the detector and has
no use for the system prompt's text.

**The clipboard follows the screen.** A copied reply lists only the markers that rendered as links,
and carries the same note the screen shows, so a paste cannot read better sourced than the page. This
folds in the finding deferred from the 1.9.0 review: today a pasted invented `[7]` loses its warning.

**Stored text does not change.** Replies are kept verbatim and only rendering derives from them, the
way invented markers already work, so restoring an older conversation applies the rule with no
migration.

## Consequences

- The guarantee is scoped to the form, and says so: **a reply in the declining form links nothing.**
  How often the model declines without that form is measured beside it in `pnpm eval:refusals`, as
  its own column, rather than folded into a "0 linked" that would hide it.
- The partial answer is the price. The warranty reply's `[7]` was relevant and is no longer a link,
  and a chip is the only thing on the page that opens a passage, so that passage cannot be reached
  from that reply at all. `pnpm eval:refusals` counts those losses by reading the verbatim replies, so
  the price is a number. **Measured on 14 October 2026, across three runs: 35 declining replies had
  their markers unlinked, and 10 of them had cited a specific fact bearing on the question** — the
  warranty clause, the downgrade rule asked about an upgrade, the corrosion-inhibitor instruction, the
  Severity 1 response target. The other 25 cited a list of what the documents cover. The reading's
  rule: a cited clause that states a fact the question was reaching for counts as a loss, and one
  that names topics does not.
- Both replies measured so far that declined in another wording opened "The documents do not
  specify". Unlike "do not require", that phrasing is a decline in every use, so it is the candidate
  if the detector ever widens; it stays exact until a run shows the miss costs more than one reply in
  sixty.
- The model's rate is unchanged, and the README and the landing page say that: what changes is that a
  marker on a declining reply no longer presents itself as a source.
- Local mode sends the same system prompt (`buildSystemPrompt`), so the rule reaches it through the
  same rendering. Whether the 0.5B model uses the opener is not measured; where it does not, its
  markers keep their links, and that is recorded rather than claimed away.
