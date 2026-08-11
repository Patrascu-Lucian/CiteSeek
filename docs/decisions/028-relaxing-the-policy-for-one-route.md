# 028 — Relaxing the content security policy for one route

## Context

Milestone 6 shipped a nonce-based CSP with `strict-dynamic`, no `unsafe-inline` in
`script-src`, and `connect-src 'self'`. It is one of the better things in the
project, and local mode cannot run under it.

In-browser inference needs three things the policy refuses:

- **WebAssembly compilation.** `script-src` has no `'wasm-unsafe-eval'`, so
  `WebAssembly.compile` throws — and `'strict-dynamic'` does not rescue it, since
  that keyword ignores host allowlists but not this one.
- **A worker from a blob URL.** `worker-src` is absent, so it falls back to
  `default-src 'self'` and a blob worker is blocked. Both transformers.js and
  WebLLM construct workers this way.
- **A remote host for the weights.** A chat model is hundreds of megabytes.

The first two are what block the next slice. The third is the one worth being
careful about, because it is the only remote host that would exist in the entire
policy.

## Options

**Relax globally.** One line, and it undoes the milestone. Every route that
renders untrusted document text would gain WebAssembly and a blob worker, which
are exactly the primitives an injected script wants. The cost lands on the routes
that carry the risk, and the benefit lands on one route that does not.

**Give local mode its own origin** — `local.citeseek.app`, with its own policy.
This is the textbook answer and it genuinely isolates the relaxation: a hole in
that origin cannot reach the app's cookies at all. Rejected for cost, not for
correctness — it means a second deployment, a second certificate, and a split
that has to be explained on the landing page. Worth revisiting if local mode ever
loads third-party model code rather than a library we pin.

**Scope by path in the policy itself.** `proxy.ts` already computes `path` for
its `GUARDED` check, so the plumbing exists.

## Decision

**Scope by path, and keep the decision inside the module that owns the policy.**
`contentSecurityPolicy` takes the path and returns the loosened directives only
for `/local` and below. The route list lives beside the policy, not in `proxy.ts`
— which routes are permitted to run WebAssembly is a property of the policy.

The loosened policy is **derived from the tight one** rather than written out a
second time. A directive added to the baseline is inherited automatically; the
alternative is two lists that agree until someone edits one of them.

**`'wasm-unsafe-eval'` is not a weaker `'unsafe-eval'`.** It permits WebAssembly
compilation and instantiation, and no JavaScript evaluation whatsoever — a
`eval("...")` call on `/local` still throws. The two are independent keywords, and
reading the first as a synonym of the second is what would make this decision look
like a much bigger concession than it is. Production still refuses `'unsafe-eval'`
everywhere, `/local` included.

**The weights host is deliberately not in this policy yet.** The download that
would name it has not been run. Allowlisting a CDN before observing a single
request to it means guessing, and the guess is likely to be wrong in a specific
way: a weights URL on `huggingface.co` redirects to a separate CDN host, and a
redirect is subject to `connect-src` in its own right — so the host you type is
not necessarily the host the transfer touches. The value gets written when a real
download names it, in the slice that performs one.

## Consequences

**The relaxation is asserted, not assumed.** A unit test pins the difference
between the two policies to exactly two directives, by set comparison rather than
by name, so a relaxation that also widened `connect-src` or `img-src` fails. A
second test pins `connect-src` to `'self'` on `/local`, which fails the day a host
is added — the intended prompt to revisit this document.

**A unit test cannot prove the seam.** It exercises a pure function; the wiring
through `proxy.ts` is where a path never threaded through would leave `/local`
unable to compile a module with every unit test still green. An E2E test reads the
real header off both `/local` and `/demo`.

**The route pattern is anchored.** `/localhost` and `/localised` are not `/local`,
and a substring match would have relaxed the policy for any path that happens to
start with those six letters.

**`img-src` stays `'self' data:`.** The comment attached to it — a model-authored
image cannot phone home — is unaffected by any of this, and is the reason the
relaxation is expressed as a whitelist of two directives rather than as "loosen
the policy on this route".
