# 027 — Detecting WebGPU before offering local mode

## Context

Milestone 7 adds a **local** mode: documents parsed, indexed and answered in the
reader's own browser, with nothing uploaded. It needs WebGPU, which a large share
of visitors do not have — Firefox is still rolling it out, and a machine with no
supported adapter fails even where the API exists.

So the first question local mode has to answer is not "how do we run a model"
but "can this browser run one at all, and what does the reader see when it
cannot".

## Options

**Feature-detect on the server.** Impossible: WebGPU is a browser capability and
nothing in the request reveals it. A `User-Agent` guess would be wrong in both
directions — the same browser version succeeds on one machine and fails on
another.

**Assume support and fail when the model loads.** The failure would arrive after a
model download, minutes in, as an error from a library. The reader learns their
browser is unsuitable at the most expensive possible moment.

**Probe `navigator.gpu` and render accordingly.** Cheap, honest, and the answer
arrives before anything is downloaded.

## Decision

**Probe, in two steps, and treat the second as the real one.**

```ts
if (!navigator.gpu) return { status: "unavailable", reason: "no-api" };
const adapter = await navigator.gpu.requestAdapter();
```

`navigator.gpu` exists in browsers that will not give you a device — behind a
disabled flag, on hardware with no supported adapter, or in a context WebGPU is
not exposed to. Checking only for the API's presence reports success on machines
where local mode cannot run, which is the failure this ADR exists to prevent.

The three unavailable reasons are kept apart because **their remedies differ**:
no API means "use a different browser", no adapter means "check a flag or your
hardware", and an error means neither. One message covering all three would be
wrong for two of them.

`WebGpuGate` renders a checking state rather than nothing. Asking for an adapter
is asynchronous and can be slow on a cold GPU, and local mode's first act being
an invisible pause is how a reader concludes the page is broken.

## Consequences

**The unavailable screen is a first-class state**, not a `console.warn`. It is
what a meaningful share of visitors will see, and it names cloud mode as the
working alternative — a dead end here strands someone who followed a link.

**The mode preference is not part of this decision.** A cookie recording "prefer
local" was drafted and cut: until generation runs locally there is nothing to
switch to, and a stored preference that changes nothing is the same defect
[ADR 016](016-workspace-membership-deferred.md) rejected in the roles table — a
branch no user can reach. It arrives with the toggle that honors it.

**The probe result is not cached.** A reader who enables a flag and returns
should not be told the old answer, and the cost is one adapter request per visit
to `/local`.

**`/local` sits outside `/w/[workspaceId]`.** Every other document surface is
backed by Postgres rows and a workspace scope; this one has neither and makes no
server query. `proxy.ts`'s `GUARDED` list does not match it, so it needs no
credential — deliberately, since local mode has no account to belong to.

↳ **2026-08-12.** For one release this gate guarded nothing: the chat model shipped without a
`device`, so it ran on wasm and would have worked for the readers this screen was turning
away. [ADR 034](034-answering-on-the-gpu.md) sets `device: "webgpu"`, which makes the check
above load-bearing rather than decorative. The reasoning here did not change; what changed is
that it became true. A capability check is only as good as the line that consumes the
capability, and nothing in this ADR pointed at that line — `local-workspace.tsx` now names it.
