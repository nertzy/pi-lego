import assert from "node:assert/strict";
import { test } from "node:test";

import { recursiveSearchBlock } from "../src/blocks/recursive-search.ts";
import { evaluateCommand } from "../src/index.ts";

for (const command of [
  "find / -name config",
  "find ~ -name '*.log'",
  "find $HOME -type f",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal shell form is under test
  "find ${HOME} -type f",
  "find ~/ -mtime -1",
  "sudo find / -perm -4000",
  "rg pattern /",
  "rg pattern ~",
  "rg pattern $HOME",
  "rg --hidden pattern ~/",
  "rg pattern src ~",
  "bash -c 'rg pattern ~'",
  "grep -r pattern /",
  "grep -rn pattern ~",
  "grep -R --include='*.ts' pattern $HOME",
  "command rg pattern /",
  "env LC_ALL=C find / -name x",
  "rg pattern -- ~",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal shell form is under test
  "timeout 10 rg pattern ${HOME}",
]) {
  test(`detects recursive search from root or home: ${command}`, () => {
    assert.match(
      evaluateCommand(command, [recursiveSearchBlock]) ?? "",
      /`recursive-search` not allowed/,
    );
  });
}

for (const command of [
  "find . -name config",
  "find src -name '*.ts'",
  "find ~/code -name config",
  "rg pattern",
  "rg pattern src/",
  "rg pattern ~/code",
  "rg -e ~ pattern src",
  "rg -g '~' --files src",
  "rg --glob ~ pattern src",
  "grep pattern file.txt",
  "grep -r pattern src/",
  "grep -rn '~' src/",
  "echo 'find / -name x'",
  "printf '%s\\n' 'rg pattern ~'",
  "cat ~/notes.txt",
  "# find / -name x\nprintf ok",
  "printf ok # rg pattern ~",
  "echo searching $HOME is fine in prose",
]) {
  test(`allows scoped or non-search command: ${command}`, () => {
    assert.equal(evaluateCommand(command, [recursiveSearchBlock]), undefined);
  });
}

test("accepts a reason in the leading comment block", () => {
  assert.equal(
    evaluateCommand(
      "# allow recursive-search: locating a misplaced ssh key across home\nrg --files ~ | grep '\\.pem$'",
      [recursiveSearchBlock],
    ),
    undefined,
  );
});

test("feedback explains the risk, the alternative, and the exception", () => {
  const reason = evaluateCommand("rg pattern ~", [recursiveSearchBlock]) ?? "";
  assert.match(reason, /whole filesystem or home directory/);
  assert.match(reason, /Scope the search to a specific relevant directory/);
  assert.match(reason, /# allow recursive-search: /);
});
