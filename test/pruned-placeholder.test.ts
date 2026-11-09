import assert from "node:assert/strict";
import { test } from "node:test";

import { prunedPlaceholderBlock } from "../src/blocks/pruned-placeholder.ts";
import { evaluateArguments } from "../src/index.ts";

const blocks = [prunedPlaceholderBlock];
const blocked = /`pruned-placeholder` not allowed/;

// Shapes recorded from real sessions: the model re-issued an earlier call
// and copied the pruner's stand-in as the whole argument.
for (const [toolName, input, path] of [
  [
    "bash",
    { command: '<purged-args size="900" ref="t323"/>', timeout: 60 },
    "command",
  ],
  ["bash", { command: '<purged-errored-args size="657"/>' }, "command"],
  ["codemode", { code: '<purged-args size="4547" ref="t159"/>' }, "code"],
  [
    "write",
    {
      path: "/tmp/description.md",
      content: '<purged-args size="644" ref="t881"/>',
    },
    "content",
  ],
  [
    "edit",
    {
      path: "spec/example_spec.rb",
      edits: [
        { oldText: "x", newText: '<purged-args size="672" ref="t815"/>' },
      ],
    },
    "edits.0.newText",
  ],
  [
    "cmux_open_terminal",
    { command: '\n<purged-args size="12" ref="t1"/>\n' },
    "command",
  ],
] as const) {
  test(`blocks a placeholder as the ${toolName} ${path} argument`, () => {
    const reason = evaluateArguments(toolName, input, blocks) ?? "";
    assert.match(reason, blocked);
    assert.match(reason, new RegExp(`\`${toolName}\` argument \`${path}\``));
    assert.match(reason, /context-pruning placeholder/);
    assert.match(reason, /context_tree_query/);
  });
}

test("names every argument that carries a placeholder", () => {
  const reason =
    evaluateArguments(
      "edit",
      {
        path: "a.rb",
        edits: [
          {
            oldText: '<purged-args size="1" ref="t1"/>',
            newText: '<purged-args size="2" ref="t2"/>',
          },
        ],
      },
      blocks,
    ) ?? "";
  assert.match(reason, /arguments `edits\.0\.oldText`, `edits\.0\.newText`/);
});

// Text that mentions a placeholder is not a placeholder; only a whole
// argument consisting of one is.
for (const [toolName, input] of [
  ["bash", { command: "rg -n '<purged-args' src/" }],
  ["bash", { command: "printf '%s' '<purged-args size=\"1\" ref=\"t1\"/>'" }],
  [
    "write",
    {
      path: "PRUNING.md",
      content: 'The marker looks like `<purged-args size="30000" ref="t6"/>`.',
    },
  ],
  ["edit", { path: "a.md", edits: [{ oldText: "a", newText: "b" }] }],
  ["bash", { command: '<purged-args size="1" ref="t1"/> && rspec' }],
  ["bash", { command: "<purged-results/>" }],
  ["read", { path: "/tmp/x", offset: null, limit: null }],
  ["bash", {}],
  ["bash", undefined],
] as const) {
  test(`allows ${toolName} ${JSON.stringify(input)}`, () => {
    assert.equal(evaluateArguments(toolName, input, blocks), undefined);
  });
}
