// Internal zod schemas — the source of truth for runtime validation.
//
// These are NOT exported from the package index. Exposing a zod schema (or a
// `z.infer` of one) forfeits JSR fast-types: zod's inferred types are too
// generic for JSR's fast analyzer. Instead, `scripts/gen-schema-types.ts`
// projects each schema to an explicit type in `src/types.generated.ts`, which
// the index re-exports. Author here; validate with these; expose the generated
// type. See ../../.github-private/docs/schema-types-strategy.md.
import { z } from "zod";

/** Typed reasons a residual gh call is load-bearing (GH-1602). */
export const GH_TRUTH_REASONS = [
  "forward-orphan-detection",
  "drift-comparator",
  "stale-comparator",
] as const;

/** Schema for one `rate-limit.jsonl` audit row. Internal — the public type is the generated `RateLimitAuditEntry`. */
export const auditEntrySchema = z.object({
  ts: z.string().describe("ISO-8601 timestamp the row was written."),
  argv: z.array(z.string()).describe("The gh argv that produced the row."),
  bucket: z.enum(["core", "graphql", "search"]).describe("The rate-limit bucket the call drew from."),
  remaining_before: z.number().nullable().describe("Bucket points remaining before the call."),
  remaining_after: z.number().nullable().describe("Bucket points remaining after the call."),
  exit_code: z.number().describe("The gh process exit code."),
  threw: z.enum(["BUDGET_EXHAUSTED", "RUNTIME_ERROR"]).nullable().describe("Why the gated call threw, or null."),
  cost_delta: z.number().nullable().default(null).describe("Cache-derived cost estimate kept for estimateSweepCost."),
  api: z.enum(["graphql", "rest"]).optional().describe("graphql (incl. --json) or rest; null when not derivable."),
  verb: z.string().nullable().optional().describe("prx verb that issued the call; null outside runCli."),
  actor: z.string().optional().describe("Process identity (claude-code, a test harness, …)."),
  operation: z.string().nullable().optional().describe("GraphQL/REST operation name; null when not derivable."),
  cost: z.number().nullable().optional().describe("Exact/measured GraphQL cost, else null."),
  remaining: z.number().nullable().optional().describe("Bucket points remaining after the call."),
  limit: z.number().nullable().optional().describe("The bucket's point limit."),
  reset_at: z.string().nullable().optional().describe("Bucket reset time, ISO-8601."),
  duration_ms: z.number().nonnegative().optional().describe("Wall time in the gh spawn (0 for a gated-out call)."),
  gh_truth_reason: z
    .enum(GH_TRUTH_REASONS)
    .nullable()
    .optional()
    .describe("Why a residual gh call is load-bearing (GH-1602); null when incidental."),
}).describe("One parsed `rate-limit.jsonl` audit row: the gh call, its bucket cost, and GH-1533 attribution.");
