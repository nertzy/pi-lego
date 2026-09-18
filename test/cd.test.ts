import assert from "node:assert/strict";
import { test } from "node:test";

import { cdBlock } from "../src/blocks/cd.ts";
import { evaluateCommand } from "../src/index.ts";

// A cd with no consumer later in the same call is discarded when the call ends.
for (const command of [
  "cd /tmp",
  "cd sub",
  "cd sub;",
  "cd sub\n# nothing else needs the directory",
  "cd sub &",
  "ls && cd ..",
  "make || cd ..",
  "sudo cd /root",
  "command cd /tmp",
  "env HOME=/tmp cd",
  "timeout 10 cd /tmp",
  "bash -c 'cd /tmp'",
  "bash -c 'ls && cd /tmp'",
]) {
  test(`detects discarded cd: ${command}`, () => {
    assert.match(evaluateCommand(command, [cdBlock]) ?? "", /`cd` not allowed/);
  });
}

// A cd chained to its consumer in the same call stays visible next to it.
for (const command of [
  "cd sub && make test",
  "cd dashboard && mise x -- bin/dev",
  "cd /tmp && ls",
  "cd sub; make test",
  "bash -c 'cd /tmp && ls'",
  "(cd sub && make)",
  "if true; then cd sub && make; fi",
  "cd foo | cat",
  "printf '%s\\n' cd",
  "echo 'cd /tmp'",
  "cdk deploy",
  "git -C sub status",
  "# cd /tmp\nprintf ok",
  "printf ok # cd /tmp",
]) {
  test(`allows consumed cd or non-invocation: ${command}`, () => {
    assert.equal(evaluateCommand(command, [cdBlock]), undefined);
  });
}

test("accepts a reason in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# allow cd: smoke test asserts only that the directory is enterable\ncd vendor/installer",
      [cdBlock],
    ),
    undefined,
  );
});

test("feedback explains the discarded change, the alternative, and the exception", () => {
  const reason = evaluateCommand("cd /tmp", [cdBlock]) ?? "";
  assert.match(reason, /starts fresh in the session working directory/);
  assert.match(reason, /cd dashboard && mise x -- bin\/dev/);
  assert.match(reason, /# allow cd: <why this directory change stands alone>/);
});
