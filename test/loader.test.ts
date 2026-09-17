import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionPath = resolve(root, "extension.ts");

test("the pi loader registers the default tool_call path", async () => {
  const loaded = await discoverAndLoadExtensions([extensionPath], root);
  assert.deepEqual(loaded.errors, []);
  const extension = loaded.extensions.find(
    (candidate) => candidate.resolvedPath === extensionPath,
  );
  assert.ok(extension);

  const handlers = extension.handlers.get("tool_call") ?? [];
  assert.equal(handlers.length, 1);
  const handler = handlers[0];
  assert.ok(handler);

  const blocked = await handler(
    {
      type: "tool_call",
      toolCallId: "smoke-block",
      toolName: "bash",
      input: { command: "tail -n 1 harmless.log" },
    },
    {},
  );
  assert.deepEqual(blocked, {
    block: true,
    reason:
      "Command blocked (not executed): `tail` not allowed.\nPi already bounds model-visible output and preserves the full result when it truncates, so hiding ordinary output with `tail` loses useful evidence.\nInstead: Re-run the same command without the `tail` segment and let the output stream. Use a producer's own filters when the query itself is narrow.\nException: put `# allow tail: <specific reason>` in the leading comment block.",
  });

  const headReason =
    "Command blocked (not executed): `head` not allowed.\nPi already bounds model-visible output and preserves the full result when it truncates, so hiding ordinary output with `head` loses useful evidence. `head` also waits for N lines or EOF; a live producer that emits fewer lines while keeping stdout open can wait indefinitely.\nInstead: Let the full output stream and rely on pi's bounds. For live streams, use producer-native bounds or a timeout; use `head` only when the initial lines are the actual query.\nException: put `# allow head: <specific reason>` in the leading comment block.";

  for (const toolName of ["bash", "cmux_open_terminal"]) {
    const headBlocked = await handler(
      {
        type: "tool_call",
        toolCallId: `smoke-head-${toolName}`,
        toolName,
        input: { command: "head -n 1 harmless.log" },
      },
      {},
    );
    assert.deepEqual(headBlocked, { block: true, reason: headReason });

    const allowed = await handler(
      {
        type: "tool_call",
        toolCallId: `smoke-allow-${toolName}`,
        toolName,
        input: {
          command:
            "# allow head: inspect first two lines; finite fixture\n# allow tail: select last of those\nprintf '%s\\n' one two three | head -n 2 | tail -n 1",
        },
      },
      {},
    );
    assert.equal(allowed, undefined);

    for (const [fixture, command] of [
      ["quoted", "printf '%s\\n' '# allow head: quoted string' | head -n 1"],
      [
        "inline",
        "printf '%s\\n' one two | head -n 1 # allow head: inline comment",
      ],
      [
        "later",
        "printf ready\n# allow head: later comment\nhead -n 1 harmless.log",
      ],
    ]) {
      const inert = await handler(
        {
          type: "tool_call",
          toolCallId: `smoke-inert-${fixture}-${toolName}`,
          toolName,
          input: { command },
        },
        {},
      );
      assert.deepEqual(inert, { block: true, reason: headReason });
    }

    const harmless = await handler(
      {
        type: "tool_call",
        toolCallId: `smoke-harmless-${toolName}`,
        toolName,
        input: { command: "printf '%s\\n' 'head -n 1 harmless.log'" },
      },
      {},
    );
    assert.equal(harmless, undefined);
  }
});
