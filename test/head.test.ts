import assert from "node:assert/strict";
import { test } from "node:test";

import { headBlock } from "../src/blocks/head.ts";
import { evaluateCommand } from "../src/index.ts";

for (const command of [
  "head -n 40 app.log",
  "cat app.log | head -n 40",
  "printf ok && /usr/bin/head -n 1 app.log",
  "sudo head app.log",
  "command head -n 1 app.log",
  "env LC_ALL=C head -n 1 app.log",
  "timeout 5s head -n 1 app.log",
  "'head' -n 1 app.log",
  'env LC_ALL=C "/usr/bin/head" -n 1 app.log',
  "bash -c 'head -n 1 app.log'",
  "sudo env MODE=test bash -c 'head -n 1 app.log'",
  'sh -lc "cat app.log | /usr/bin/head -n 1"',
  "xargs head -n 1",
  "find logs -type f -exec head -n 1 {} +",
  "x=`head -n5 f`",
  'echo "$(head -n5 f)"',
  'printf "%s" "$(sudo head app.log)"',
  "if true; then head -n 1 app.log; fi",
  "while false; do head -n 1 app.log; done",
  'LABEL="some text" head -n 1 app.log',
  "`head -n 1 app.log`",
]) {
  test(`detects head invocation: ${command}`, () => {
    assert.match(
      evaluateCommand(command, [headBlock]) ?? "",
      /`head` not allowed/,
    );
  });
}

for (const command of [
  "printf '%s\\n' head",
  "echo 'head -n 40 app.log'",
  "cat ahead.txt",
  "git show --format='%h %s'",
  "# head -n 40 app.log\nprintf ok",
  "printf ok # head -n 40 app.log",
  "printf ok # ignored; 'head' -n 40 app.log",
  "headless --version",
  'echo "no head here just prose about headings"',
  "echo 'literal $(head -n5 f) never runs'",
  "bash -c 'printf ok' head -n 1 app.log",
  "echo 'example; \"head\" -n 1 app.log'",
  "cat <<'DOC'\nhead -n 1 app.log\nDOC\nprintf ok",
  "# bash -c 'head -n 1 app.log'\nprintf ok",
  "echo bash -c 'head -n 1 app.log'",
]) {
  test(`allows non-invocation: ${command}`, () => {
    assert.equal(evaluateCommand(command, [headBlock]), undefined);
  });
}

test("declares the executable pattern and infers its exception comment", () => {
  assert.deepEqual(headBlock.pattern, { command: "head" });
  assert.equal(headBlock.exception?.comment, undefined);
});

test("accepts a reason in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# fixture query\n\n # allow head: initial lines are the query\nhead -n 40 app.log",
      [headBlock],
    ),
    undefined,
  );
});

test("feedback explains bounded output, live-stream waits, and the exception", () => {
  const reason = evaluateCommand("head -n 1 app.log", [headBlock]) ?? "";
  assert.match(reason, /bounds model-visible output/);
  assert.match(reason, /waits for N lines or EOF/);
  assert.match(reason, /producer-native bounds or a timeout/);
  assert.match(reason, /# allow head: <specific reason>/);
});
