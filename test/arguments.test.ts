import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type ArgumentBlock,
  evaluateArguments,
  registerArgumentBlocks,
  stringArguments,
} from "../src/index.ts";

const shout: ArgumentBlock = {
  id: "shout",
  detect: ({ value }) => /[A-Z]{4,}/.test(value),
  rationale: "Shouting hides the signal.",
  alternative: "Write it in lowercase.",
};

const secret: ArgumentBlock = {
  id: "secret",
  tools: ["write"],
  detect: ({ path, value }) => path === "content" && value.includes("hunter2"),
  rationale: "A secret does not belong in a file.",
  alternative: "Reference it from the secret store.",
};

test("stringArguments lists every string leaf with its dotted path", () => {
  assert.deepEqual(
    stringArguments("edit", {
      path: "a.rb",
      edits: [{ oldText: "x", newText: "y" }],
      count: 1,
      nested: { flag: true, note: null, inner: ["z"] },
    }),
    [
      { toolName: "edit", path: "path", value: "a.rb" },
      { toolName: "edit", path: "edits.0.oldText", value: "x" },
      { toolName: "edit", path: "edits.0.newText", value: "y" },
      { toolName: "edit", path: "nested.inner.0", value: "z" },
    ],
  );
  assert.deepEqual(stringArguments("bash", "raw"), [
    { toolName: "bash", path: "", value: "raw" },
  ]);
  assert.deepEqual(stringArguments("bash", undefined), []);
});

test("reports every matching block and names the offending arguments", () => {
  const reason =
    evaluateArguments(
      "write",
      { path: "NOTES.md", content: "PASSWORD hunter2" },
      [shout, secret],
    ) ?? "";
  assert.match(
    reason,
    /`shout` not allowed in `write` arguments `path`, `content`/,
  );
  assert.match(reason, /Shouting hides the signal/);
  assert.match(reason, /Instead: Write it in lowercase/);
  assert.match(reason, /`secret` not allowed in `write` argument `content`/);
  assert.match(reason, /Tool call blocked \(not executed\)/);
});

test("a block with a tools list ignores other tools", () => {
  assert.equal(
    evaluateArguments("bash", { command: "echo hunter2" }, [secret]),
    undefined,
  );
  assert.match(
    evaluateArguments("write", { content: "hunter2" }, [secret]) ?? "",
    /`secret` not allowed/,
  );
});

test("allows a call when no block matches", () => {
  assert.equal(
    evaluateArguments("write", { path: "a.md", content: "quiet" }, [
      shout,
      secret,
    ]),
    undefined,
  );
});

function capture(): {
  pi: ExtensionAPI;
  handler: () => (event: unknown, ctx?: { cwd?: string }) => unknown;
} {
  let handler:
    | ((event: unknown, ctx?: { cwd?: string }) => unknown)
    | undefined;
  const pi = {
    on(event: string, candidate: typeof handler) {
      assert.equal(event, "tool_call");
      handler = candidate;
    },
  } as unknown as ExtensionAPI;
  return {
    pi,
    handler: () => {
      assert.ok(handler);
      return handler;
    },
  };
}

test("registers one tool_call hook over every tool's input", () => {
  const { pi, handler } = capture();
  registerArgumentBlocks(pi, [shout]);
  const on = handler();
  assert.deepEqual(on({ toolName: "write", input: { content: "LOUD" } }), {
    block: true,
    reason: evaluateArguments("write", { content: "LOUD" }, [shout]),
  });
  assert.deepEqual(on({ toolName: "custom_tool", input: { any: "LOUD" } }), {
    block: true,
    reason: evaluateArguments("custom_tool", { any: "LOUD" }, [shout]),
  });
  assert.equal(
    on({ toolName: "write", input: { content: "quiet" } }),
    undefined,
  );
  assert.equal(on({ toolName: "bash", input: {} }), undefined);
});

test("an appliesTo predicate scopes which tool calls blocks evaluate", () => {
  const { pi, handler } = capture();
  registerArgumentBlocks(pi, [shout], {
    appliesTo: (scope) =>
      scope.toolName === "write" && (scope.cwd?.startsWith("/work/") ?? false),
  });
  const on = handler();
  const event = { toolName: "write", input: { content: "LOUD" } };
  assert.equal(on(event, { cwd: "/elsewhere" }), undefined);
  assert.equal(on(event, undefined), undefined);
  assert.equal(
    on({ toolName: "bash", input: { command: "LOUD" } }, { cwd: "/work/x" }),
    undefined,
  );
  assert.deepEqual(on(event, { cwd: "/work/repo" }), {
    block: true,
    reason: evaluateArguments("write", { content: "LOUD" }, [shout]),
  });
});
