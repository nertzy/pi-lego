import { type Command, parse, type Word, type WordPart } from "unbash";

import type { ShellCommand } from "./shell.ts";

export interface WrapperInvocation {
  command: string;
  args: readonly string[];
}

export type WrapperTarget = { words: readonly string[] } | { script: string };

export interface WrapperDefinition {
  command: string;
  resolve(invocation: WrapperInvocation): WrapperTarget | undefined;
}

export type WrapperInput =
  | { prefix: string | readonly string[] }
  | {
      command: string;
      resolve(args: readonly string[]): WrapperTarget | undefined;
    };

const basename = (word: string): string => word.split("/").pop() ?? word;
const assignment = (word: string): boolean =>
  /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);

function staticPart(part: WordPart): boolean {
  switch (part.type) {
    case "Literal":
    case "SingleQuoted":
    case "AnsiCQuoted":
      return true;
    case "DoubleQuoted":
    case "LocaleString":
      return part.parts.every(staticPart);
    default:
      return false;
  }
}

function staticWord(word: Word): boolean {
  return (word.parts ?? []).every(staticPart);
}

function parsePrefix(prefix: string): string[] {
  const ast = parse(prefix);
  const statement = ast.commands[0];
  const node = statement?.command;
  if (
    prefix.trim() === "" ||
    ast.errors?.length ||
    ast.commands.length !== 1 ||
    !node ||
    node.type !== "Command" ||
    !node.name ||
    node.prefix.length > 0 ||
    node.redirects.length > 0
  ) {
    throw new TypeError(
      "Wrapper prefix must be a single static command prefix",
    );
  }

  const command = node as Command;
  const words: Word[] = [node.name, ...command.suffix];
  if (!words.every(staticWord)) {
    throw new TypeError(
      "Wrapper prefix must be a single static command prefix",
    );
  }
  return words.map((word) => word.value);
}

/** Normalize a declarative or custom wrapper once at its configuration boundary. */
export function defineWrapper(input: WrapperInput): WrapperDefinition {
  if ("prefix" in input) {
    const prefix =
      typeof input.prefix === "string"
        ? parsePrefix(input.prefix)
        : [...input.prefix];
    if (prefix.length === 0 || prefix.some((word) => word.length === 0)) {
      throw new TypeError(
        "Wrapper prefix must be a single static command prefix",
      );
    }
    const [command = "", ...expectedArgs] = prefix;
    return {
      command: basename(command),
      resolve({ args }) {
        if (!expectedArgs.every((word, index) => args[index] === word))
          return undefined;
        return { words: args.slice(expectedArgs.length) };
      },
    };
  }

  return {
    command: basename(input.command),
    resolve: ({ args }) => input.resolve(args),
  };
}

function skipFlags(
  args: readonly string[],
  valueFlags: readonly string[] = [],
  skipAssignments = false,
): number {
  let index = 0;
  while (index < args.length) {
    const arg = args[index] ?? "";
    if (skipAssignments && assignment(arg)) {
      index += 1;
    } else if (arg === "--") {
      return index + 1;
    } else if (!arg.startsWith("-")) {
      return index;
    } else if (
      !arg.includes("=") &&
      valueFlags.includes(arg) &&
      index + 1 < args.length
    ) {
      index += 2;
    } else {
      index += 1;
    }
  }
  return index;
}

const prefix = (value: string | readonly string[]): WrapperDefinition =>
  defineWrapper({ prefix: value });

const custom = (
  command: string,
  resolve: (args: readonly string[]) => WrapperTarget | undefined,
): WrapperDefinition => defineWrapper({ command, resolve });

export const builtInWrappers: readonly WrapperDefinition[] = [
  custom("command", (args) => ({ words: args.slice(skipFlags(args)) })),
  prefix(["nohup"]),
  custom("sudo", (args) => ({
    words: args.slice(
      skipFlags(args, [
        "-C",
        "-D",
        "-g",
        "-p",
        "-r",
        "-R",
        "-t",
        "-T",
        "-U",
        "-u",
      ]),
    ),
  })),
  custom("env", (args) => ({
    words: args.slice(skipFlags(args, ["-C", "-S", "-u"], true)),
  })),
  custom("timeout", (args) => {
    const boundary = skipFlags(args, ["-k", "--kill-after", "-s", "--signal"]);
    return { words: args.slice(boundary + 1) };
  }),
  custom("xargs", (args) => ({
    words: args.slice(
      skipFlags(args, [
        "-a",
        "-d",
        "-E",
        "-e",
        "-I",
        "-i",
        "-L",
        "-l",
        "-n",
        "-P",
        "-s",
      ]),
    ),
  })),
  custom("find", (args) => {
    const marker = args.findIndex(
      (arg) => arg === "-exec" || arg === "-execdir",
    );
    if (marker < 0) return undefined;
    const words = args.slice(marker + 1);
    const end = words.findIndex((word) => word === ";" || word === "+");
    return { words: end < 0 ? words : words.slice(0, end) };
  }),
  custom("bash", shellScript),
  custom("sh", shellScript),
  custom("zsh", shellScript),
  custom("fish", shellScript),
  custom("op", (args) => {
    if (args[0] !== "run" && !(args[0] === "plugin" && args[1] === "run"))
      return undefined;
    const separator = args.indexOf("--");
    return separator < 0 ? undefined : { words: args.slice(separator + 1) };
  }),
  custom("mise", (args) => {
    if (args[0] !== "exec" && args[0] !== "x") return undefined;
    const separator = args.indexOf("--");
    return separator < 0 ? undefined : { words: args.slice(separator + 1) };
  }),
];

function shellScript(args: readonly string[]): WrapperTarget | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (/^-[^-]*c/.test(arg)) {
      const script = args[index + 1];
      return script === undefined ? undefined : { script };
    }
    if (!arg.startsWith("-")) return undefined;
  }
  return undefined;
}

export function expandWrappers(
  command: ShellCommand,
  customWrappers: readonly WrapperDefinition[],
): WrapperTarget[] {
  const name = basename(command.words[0] ?? "");
  const invocation = { command: name, args: command.words.slice(1) };
  return [...builtInWrappers, ...customWrappers]
    .filter((wrapper) => wrapper.command === name)
    .flatMap((wrapper) => wrapper.resolve(invocation) ?? []);
}
