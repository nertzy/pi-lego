import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  evaluateCommand,
  registerBlocks,
  type ConventionBlock,
} from "../src/index.ts";

const alpha: ConventionBlock = {
  id: "alpha",
  detect: (command) => command.includes("alpha"),
  rationale: "Alpha hides useful evidence.",
  alternative: "Run beta instead.",
  exception: {
    comment: "allow-alpha",
    description: "why alpha is the actual query",
  },
};

const omega: ConventionBlock = {
  id: "omega",
  pattern: { command: "omega" },
  rationale: "Omega is too broad.",
  alternative: "Run the focused check.",
};

// @ts-expect-error a block must choose declarative pattern or custom detection
const ambiguous: ConventionBlock = {
  id: "ambiguous",
  pattern: { command: "ambiguous" },
  detect: () => true,
  rationale: "Ambiguous matching is unclear.",
  alternative: "Choose one matching strategy.",
};
void ambiguous;

const delta: ConventionBlock = {
  id: "delta",
  pattern: { command: "delta" },
  rationale: "Delta hides useful evidence.",
  alternative: "Inspect the source directly.",
  exception: {
    description: "why delta is necessary",
  },
};

test("returns corrective feedback for every matching block", () => {
  const reason = evaluateCommand("alpha && omega", [alpha, omega]);
  assert.match(reason ?? "", /Alpha hides useful evidence/);
  assert.match(reason ?? "", /Run beta instead/);
  assert.match(reason ?? "", /Omega is too broad/);
  assert.match(reason ?? "", /Run the focused check/);
});

test("a reason-bearing exception only bypasses its own block", () => {
  const reason = evaluateCommand(
    "\n  # allow-alpha: final lines diagnose this failure\nalpha && omega",
    [alpha, omega],
  );
  assert.doesNotMatch(reason ?? "", /Alpha hides useful evidence/);
  assert.match(reason ?? "", /Omega is too broad/);
});

test("each block accepts its own exception in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# allow-alpha: inspect first two lines; finite fixture\n\n# allow delta: select last of those\nalpha | delta",
      [alpha, delta],
    ),
    undefined,
  );
});

test("an exception reason accepts ordinary punctuation", () => {
  assert.equal(
    evaluateCommand(
      "# allow-alpha: inspect a&b; compare x|y, then `quote` (finite fixture)!\nalpha",
      [alpha],
    ),
    undefined,
  );
});

test("a partial set of exceptions still reports the other matching block", () => {
  const reason = evaluateCommand("# allow-alpha: focused query\nalpha | delta", [alpha, delta]);
  assert.doesNotMatch(reason ?? "", /Alpha hides useful evidence/);
  assert.match(reason ?? "", /Delta hides useful evidence/);
});

for (const command of [
  "# allow-alpha:\nalpha",
  "# allow-alpha:    \nalpha",
  "echo ready\n# allow-alpha: reason\nalpha",
  "echo '# allow-alpha: quoted string' && alpha",
  "alpha # allow-alpha: inline comment",
  "# allow-alpha-extra: wrong marker\nalpha",
  "# allow-alpha reason\nalpha",
]) {
  test(`rejects malformed or non-leading exception: ${JSON.stringify(command)}`, () => {
    assert.match(evaluateCommand(command, [alpha]) ?? "", /Alpha hides useful evidence/);
  });
}

test("infers an allow comment from the block id", () => {
  assert.equal(
    evaluateCommand("# allow delta: final artifact is the query\ndelta records", [delta]),
    undefined,
  );
  assert.match(evaluateCommand("delta records", [delta]) ?? "", /# allow delta:/);
});

test("a block without an exception cannot be overridden", () => {
  assert.match(
    evaluateCommand("# allow omega: attempted override\nomega records", [omega]) ?? "",
    /Omega is too broad/,
  );
});

test("allows a command when no block matches", () => {
  assert.equal(evaluateCommand("beta", [alpha, omega]), undefined);
});

test("registers one tool_call hook for bash and cmux_open_terminal", () => {
  let handler: ((event: unknown) => unknown) | undefined;
  const pi = {
    on(event: string, candidate: (event: unknown) => unknown) {
      assert.equal(event, "tool_call");
      handler = candidate;
    },
  } as unknown as ExtensionAPI;

  registerBlocks(pi, [alpha]);
  assert.ok(handler);
  assert.deepEqual(
    handler({ toolName: "bash", input: { command: "alpha" } }),
    { block: true, reason: evaluateCommand("alpha", [alpha]) },
  );
  assert.deepEqual(
    handler({ toolName: "cmux_open_terminal", input: { command: "alpha" } }),
    { block: true, reason: evaluateCommand("alpha", [alpha]) },
  );
  assert.equal(handler({ toolName: "read", input: { path: "alpha" } }), undefined);
  assert.equal(handler({ toolName: "cmux_open_terminal", input: {} }), undefined);
});
