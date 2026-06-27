import { test } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertSeam } from "@bounded-systems/seam-check";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// @bounded-systems/github-budget: classifies each gh call into a budget bucket,
// gates it before spending, and records an audit trail. Prod files touch
// node:fs/os/path, zod, and the audit-context / env / proc seams only. The
// harness proves that edge set and the no-ambient thesis.
test("@bounded-systems/github-budget upholds its seam claim", () => {
  assertSeam({
    root: SRC,
    prod: [
      "node:fs",
      "node:os",
      "node:path",
      "zod",
      "@bounded-systems/audit-context",
      "@bounded-systems/env",
      "@bounded-systems/proc",
    ],
    test: ["@bounded-systems/github-budget", "@bounded-systems/seam-check"],
  });
});
