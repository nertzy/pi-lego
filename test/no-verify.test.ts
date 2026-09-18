import assert from "node:assert/strict";
import { test } from "node:test";

import { noVerifyBlock } from "../src/blocks/no-verify.ts";
import { evaluateCommand } from "../src/index.ts";

for (const command of [
  "git commit --no-verify -m msg",
  "git commit -n -m msg",
  "git commit -an",
  "git push --no-verify",
  "git -C repo commit --no-verify -m msg",
  "git --git-dir=x.git commit -n",
  "git -c user.name=x push --no-verify",
  "sudo git push --no-verify",
  "env GIT_EDITOR=true git commit --no-verify",
  "bash -c 'git commit --no-verify'",
  "git commit --no-verify -m msg && git push",
  "echo done | git commit --no-verify --file -",
]) {
  test(`detects hook bypass: ${command}`, () => {
    assert.match(
      evaluateCommand(command, [noVerifyBlock]) ?? "",
      /`no-verify` not allowed/,
    );
  });
}

for (const command of [
  "git commit -m msg",
  "git commit --amend -m msg",
  "git push",
  "git push -n",
  "git push --dry-run",
  "git -C repo log --oneline",
  "git commit",
  "echo 'git commit --no-verify'",
  "printf '%s\\n' --no-verify",
  "# git push --no-verify\nprintf ok",
  "git status # git commit --no-verify",
  "hg commit --no-verify",
]) {
  test(`allows verified or non-git command: ${command}`, () => {
    assert.equal(evaluateCommand(command, [noVerifyBlock]), undefined);
  });
}

test("accepts a reason in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# allow no-verify: pre-commit reformats generated fixtures already fixed upstream\ngit commit --no-verify -m msg",
      [noVerifyBlock],
    ),
    undefined,
  );
});

test("feedback explains hooks, the alternative, and the exception", () => {
  const reason = evaluateCommand("git push --no-verify", [noVerifyBlock]) ?? "";
  assert.match(reason, /bypasses the hooks/);
  assert.match(reason, /fix or reconfigure the hook/);
  assert.match(reason, /# allow no-verify: /);
});
