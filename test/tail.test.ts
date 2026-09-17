import assert from "node:assert/strict";
import { test } from "node:test";
import { tailBlock } from "../src/blocks/tail.ts";
import { evaluateCommand } from "../src/index.ts";

for (const command of [
  "tail -n 40 app.log",
  "cat app.log | tail -n 40",
  "printf ok && /usr/bin/tail -n 1 app.log",
  "sudo tail -f app.log",
  "command tail -n 1 app.log",
  "env LC_ALL=C tail -n 1 app.log",
  "timeout 5s tail -n 1 app.log",
  "'tail' -n 1 app.log",
  'env LC_ALL=C "/usr/bin/tail" -n 1 app.log',
  "bash -c 'tail -n 1 app.log'",
  "sudo env MODE=test bash -c 'tail -n 1 app.log'",
  'sh -lc "cat app.log | /usr/bin/tail -n 1"',
  "xargs tail -n 1",
  "find logs -type f -exec tail -n 1 {} +",
  "x=`tail -n5 f`",
  'echo "$(tail -n5 f)"',
  'printf "%s" "$(sudo tail -f app.log)"',
  "if true; then tail -n 1 app.log; fi",
  "while false; do tail -n 1 app.log; done",
  'LABEL="some text" tail -n 1 app.log',
  "`tail -n 1 app.log`",
]) {
  test(`detects tail invocation: ${command}`, () => {
    assert.match(
      evaluateCommand(command, [tailBlock]) ?? "",
      /`tail` not allowed/,
    );
  });
}

for (const command of [
  "printf '%s\\n' tail",
  "echo 'tail -n 40 app.log'",
  "cat detail.txt",
  "git show --format='%(trailers)'",
  "# tail -n 40 app.log\nprintf ok",
  "printf ok # tail -n 40 app.log",
  "printf ok # ignored; 'tail' -n 40 app.log",
  "retail --version",
  'echo "no tail here just prose about tailoring"',
  "echo 'literal $(tail -n5 f) never runs'",
  "bash -c 'printf ok' tail -n 1 app.log",
  "echo 'example; \"tail\" -n 1 app.log'",
  "cat <<'DOC'\ntail -n 1 app.log\nDOC\nprintf ok",
  "# bash -c 'tail -n 1 app.log'\nprintf ok",
  "echo bash -c 'tail -n 1 app.log'",
]) {
  test(`allows non-invocation: ${command}`, () => {
    assert.equal(evaluateCommand(command, [tailBlock]), undefined);
  });
}

test("declares the executable pattern and infers its exception comment", () => {
  assert.deepEqual(tailBlock.pattern, { command: "tail" });
  assert.equal(tailBlock.exception?.comment, undefined);
});

test("accepts a reason in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# fixture query\n\n # allow tail: last lines are the query\ntail -n 40 app.log",
      [tailBlock],
    ),
    undefined,
  );
});

test("feedback explains bounded output, streaming, and the exception", () => {
  const reason = evaluateCommand("tail -n 1 app.log", [tailBlock]) ?? "";
  assert.match(reason, /bounds model-visible output/);
  assert.match(reason, /let the output stream/i);
  assert.match(reason, /# allow tail: <specific reason>/);
});
