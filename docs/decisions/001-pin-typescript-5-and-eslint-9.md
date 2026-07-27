# 001 — Pin TypeScript to 5.x and ESLint to 9.x

**Status**: accepted · **Date**: 2026-07-27 · **Milestone**: 0

## Context

At scaffold time the newest published versions were TypeScript **7.0.2** (the Go-native
compiler) and ESLint **10.8.0**. Both are genuinely stable releases, and taking the
newest of everything is the default instinct on a greenfield portfolio project.

The roadmap's standing rule is _CI green from day one_, and quality bar #7 requires
type-aware linting with `no-explicit-any` enforced. Those two commitments turn out to
constrain the version choice more than "newest is best" does.

## Options considered

1. **Everything at latest** — TypeScript 7 + ESLint 10.
2. **Pin the compiler and linter one major back**, take latest everywhere else.
3. **Conservative across the board** — Next 15 line, older AI SDK.

## Decision

Option 2. Specifically `typescript@5.9.3` and `eslint@9.39.5`, while Next (16.2.12),
React (19.2.8), Tailwind (4.3.3) and Vitest (4.1.10) all stay current.

The deciding factor was not taste — it was published peer ranges:

- **`typescript-eslint@8.65.0` declares `typescript: ">=4.8.4 <6.1.0"`.** TypeScript 7
  is outside that range, so adopting it means giving up type-aware linting entirely.
- **`eslint-plugin-react@7.37.5` — the latest release — declares `eslint: "^3 || … || ^9.7"`.**
  It has no ESLint 10 support. `eslint-config-next@16.2.12` depends on it while
  optimistically declaring `eslint: ">=9.0.0"` itself, so the incompatibility is not
  visible until runtime.

That second one was confirmed the hard way rather than predicted: ESLint 10 was installed
first, and `pnpm lint` crashed with
`TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`
— ESLint 10 removed the deprecated `context.getFilename()` that the plugin still calls.

## Consequences

- Type-aware linting works, and `no-explicit-any` is enforced as an error. Verified by
  probe: a file containing `function probe(input: any)` fails `pnpm lint` with both
  `no-explicit-any` and `no-unsafe-return`.
- We forgo TypeScript 7's compile-speed win. On a codebase this size that is worth ~seconds.
- **Revisit trigger**: when `eslint-plugin-react` ships ESLint 10 support and
  `typescript-eslint` widens its peer range past TS 7. Both are upstream-driven; neither
  requires changes to our code.

## Note for the reader

The general lesson, and the reason this is written down: a package being on `latest` says
nothing about whether _its ecosystem_ can consume it. Top-level tools ship majors faster
than their plugin authors follow. Checking `peerDependencies` before upgrading is cheaper
than debugging the crash it causes.
