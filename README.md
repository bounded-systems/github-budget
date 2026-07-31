# @bounded-systems/github-budget

A rate-limit-aware wrapper around `gh`: it classifies each call into a budget
bucket, gates it before spending, and records an audit trail.

GitHub's API has several distinct rate limits (core, search, GraphQL, …). This
package classifies a call into its bucket, checks the remaining budget *before*
making it, and logs what was spent and why.

## Coverage — read this first

**This package gates `gh` invocations. It does not gate anything else.**

| Route | Used by | Gated & audited here? |
|---|---|---|
| `gh` CLI | scripts, workflows | **Yes** |
| GitHub MCP server | agent tool calls — often the majority of session traffic | **No** — its own HTTP client |
| raw `curl` / `fetch` | agent fallback, cloud sessions without `gh` | **No** |
| GitHub Actions with `GITHUB_TOKEN` | CI jobs | **No** — the platform injects the credential |

This is stated up front because the boundary is not obvious and has been
inferred away twice. On 2026-07-30 two agent sessions spent 10,104 GraphQL
points against a 5,000 limit and discovered it by hitting it; the same failure
recurred within the hour. Neither session's traffic passed through this package
— it was correct, published, and not in the path. See
[github-budget#9](https://github.com/bounded-systems/github-budget/issues/9).

A gate only covers what routes through it. Coverage that depends on each caller
opting in is not coverage; the durable fix is credential custody at a single
egress point, tracked as
[prx#1034](https://github.com/bounded-systems/prx/issues/1034). Until that
lands, `preflight()` below narrows the window.

**The probe shells out to `gh` too.** `refreshBudget()` — and therefore
`preflight()` — runs `gh api rate_limit`. An environment without `gh` (a cloud
agent session, which is exactly where both incidents happened) must inject
`rawRunner` via `RateLimitDeps` to point at its own transport.

## Install

```sh
npm install @bounded-systems/github-budget @bounded-systems/audit-context @bounded-systems/env @bounded-systems/proc zod
```

`zod` is a peer dependency (`^3.25 || ^4`).

## Usage

```ts
// Classify, gate, and audit a gh call before it spends from its bucket.
// The pre-call gate consults the remaining budget for the call's bucket;
// the audit trail records the spend with attribution from audit-context.
```

### Pre-flight — check headroom before expensive work

```ts
import { preflight, estimateSweepCost } from "@bounded-systems/github-budget";

const report = preflight();
if (report === null) {
  // Budget unknown — reported as unknown, never as healthy.
} else if (!report.ok) {
  console.warn(report.text);
  // → GitHub budget — graphql LOW:
  //     core:    13385/15000 (resets 23:45:31 UTC)
  //     graphql: 0/5000 (resets 23:48:29 UTC)  ⚠ low
  //     search:  30/30 (resets 23:19:54 UTC)
  //     (buckets are isolated — the others above are unaffected and still usable)
}

// Before a sweep, ask the sharper question: is there enough for THIS work?
const strict = preflight({ needed: estimateSweepCost().perBucket });
```

"Low" is **proportional** by default (under 10% of a bucket's own limit), not a
flat point count — `search` has a limit of 30 against `core`'s 15,000, so a flat
threshold would mark an untouched `search` bucket low on every call.

`rate_limit` is exempt from rate limiting, so this is free to call as often as
is useful.

**It is not a gate, and must not be read as one.** Buckets are shared across
sessions and this is a snapshot, not a reservation — another session can spend
the headroom between this call and yours. It narrows the window; it cannot close
it.

## Design

- **Gate before spend.** Bucket classification + a pre-call check keep usage
  inside the limit rather than discovering the limit by hitting it — *for calls
  that route through this package* (see [Coverage](#coverage--read-this-first)).
- **Buckets are isolated.** `core`, `graphql` and `search` are independent pools,
  so one at zero says nothing about the others. Exhaustion errors name the
  remaining headroom in the *other* buckets, because "one bucket is spent, route
  around it" and "GitHub is unavailable" need telling apart at a glance.
- **Attributed audit.** Spends are recorded with the verb/actor attribution from
  `@bounded-systems/audit-context`. An extractability test enforces that
  `audit-context`, `env`, and `proc` are the only repo dependencies.

## License

[MIT](./LICENSE) © Bounded Systems
