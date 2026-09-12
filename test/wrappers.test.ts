import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defineWrapper,
  evaluateCommand,
  type ConventionBlock,
  type WrapperDefinition,
} from "../src/index.ts";

const block: ConventionBlock = {
  id: "target",
  pattern: { command: "target" },
  rationale: "Target is blocked.",
  alternative: "Use another command.",
};

const blocked = (command: string, wrappers: readonly WrapperDefinition[] = []): boolean =>
  evaluateCommand(command, [block], { wrappers }) !== undefined;

for (const command of [
  "op run -- target arg",
  "op run --env-file=.env -- target arg",
  "op plugin run -- target arg",
  "mise exec -- target arg",
  "mise x -- target arg",
  "mise exec node@22 -- target arg",
  "mise x -C elsewhere node@22 -- op run -- target arg",
  "sudo -u somebody env MODE=test op plugin run -- mise x -- target arg",
]) {
  test(`detects through built-in wrapper: ${command}`, () => {
    assert.equal(blocked(command), true);
  });
}

for (const command of [
  "printf '%s' 'op run -- target arg'",
  "op run -- printf '%s' 'target arg'",
  "mise x -- printf '%s' target",
  "echo target",
]) {
  test(`does not treat wrapper argument text as execution: ${command}`, () => {
    assert.equal(blocked(command), false);
  });
}

test("custom declarative wrappers compose with built-ins", () => {
  const wrappers = [defineWrapper({ prefix: "launcher start --" })];
  assert.equal(blocked("op run -- launcher start -- target arg", wrappers), true);
});

test("string and token-array prefixes have equivalent matching", () => {
  const stringWrapper = defineWrapper({ prefix: "launcher start --" });
  const arrayWrapper = defineWrapper({ prefix: ["launcher", "start", "--"] });
  assert.equal(blocked("launcher start -- target", [stringWrapper]), true);
  assert.equal(blocked("launcher start -- target", [arrayWrapper]), true);
});

test("quoted words in a string prefix are parsed as one token", () => {
  const wrapper = defineWrapper({ prefix: "launcher 'special mode' --" });
  assert.equal(blocked("launcher 'special mode' -- target", [wrapper]), true);
  assert.equal(blocked("launcher special mode -- target", [wrapper]), false);
});

for (const prefix of [
  "launcher && other --",
  "launcher $(mode) --",
  "launcher `mode` --",
  "launcher $MODE --",
  "launcher > output --",
  "",
]) {
  test(`rejects unsafe string prefix: ${JSON.stringify(prefix)}`, () => {
    assert.throws(() => defineWrapper({ prefix }), /single static command prefix/i);
  });
}

test("a custom resolver handles unusual wrapper arguments", () => {
  const wrapper = defineWrapper({
    command: "launcher",
    resolve(args) {
      const marker = args.indexOf("execute:");
      return marker < 0 ? undefined : { words: args.slice(marker + 1) };
    },
  });
  assert.equal(blocked("launcher --mode unusual execute: target arg", [wrapper]), true);
});

test("malformed shell is parsed best-effort without throwing", () => {
  assert.doesNotThrow(() => blocked("if true; then target"));
  assert.equal(blocked("if true; then target"), true);
});
