import { homedir } from "node:os";

import {
  type ConventionBlock,
  commandInvocations,
  type ShellCommand,
} from "../index.ts";

const withoutTrailingSlashes = (word: string): string =>
  word.replace(/\/+$/, "");

const HOME_DIRECTORY = withoutTrailingSlashes(homedir());

/** A word that names the filesystem root or the home directory itself. */
function isRootOrHome(word: string): boolean {
  const trimmed = withoutTrailingSlashes(word);
  if (trimmed === "") return word.length > 0; // "/", "//", ...
  return (
    trimmed === "~" ||
    trimmed === "$HOME" ||
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal shell form is the match target
    trimmed === "${HOME}" ||
    (HOME_DIRECTORY !== "" && trimmed === HOME_DIRECTORY)
  );
}

const basename = (word: string): string => word.split("/").pop() ?? word;

/**
 * The options of one search tool that consume a value: long name to its short
 * letter (if any). `untilSemicolon` options (fd's --exec) consume every
 * following argument up to and including a `;`.
 */
interface ToolGrammar {
  readonly valueOptions: Readonly<Record<string, string | undefined>>;
  readonly untilSemicolon?: Readonly<Record<string, string>>;
}

const RG: ToolGrammar = {
  valueOptions: {
    "--regexp": "e",
    "--file": "f",
    "--glob": "g",
    "--iglob": undefined,
    "--type": "t",
    "--type-not": "T",
    "--type-add": undefined,
    "--max-count": "m",
    "--max-columns": "M",
    "--max-depth": undefined,
    "--max-filesize": undefined,
    "--after-context": "A",
    "--before-context": "B",
    "--context": "C",
    "--threads": "j",
    "--sort": undefined,
    "--sortr": undefined,
    "--path-separator": undefined,
    "--encoding": "E",
    "--engine": undefined,
    "--colors": undefined,
    "--ignore-file": undefined,
    "--pre": undefined,
    "--hostname-bin": undefined,
    "--field-context-separator": undefined,
    "--field-match-separator": undefined,
  },
};

const GREP: ToolGrammar = {
  valueOptions: {
    "--regexp": "e",
    "--file": "f",
    "--exclude": undefined,
    "--include": undefined,
    "--exclude-dir": undefined,
    "--exclude-from": undefined,
    "--max-count": "m",
    "--after-context": "A",
    "--before-context": "B",
    "--context": "C",
    "--directories": "d",
    "--devices": "D",
    "--label": undefined,
    "--binary-files": undefined,
    "--group-separator": undefined,
  },
};

const FD: ToolGrammar = {
  valueOptions: {
    "--and": undefined,
    "--max-depth": "d",
    "--min-depth": undefined,
    "--exact-depth": undefined,
    "--exclude": "E",
    "--type": "t",
    "--extension": "e",
    "--size": "S",
    "--changed-within": undefined,
    "--changed-after": undefined,
    "--change-newer-than": undefined,
    "--newer": undefined,
    "--changed-before": undefined,
    "--change-older-than": undefined,
    "--older": undefined,
    "--owner": "o",
    "--format": undefined,
    "--batch-size": undefined,
    "--ignore-file": undefined,
    "--ignore-contain": undefined,
    "--color": "c",
    "--threads": "j",
    "--max-results": undefined,
    "--base-directory": "C",
    "--path-separator": undefined,
    "--search-path": undefined,
  },
  untilSemicolon: { "--exec": "x", "--exec-batch": "X" },
};

interface ParsedArgs {
  readonly positional: readonly string[];
  /** Values of value-taking options, keyed by long name. */
  readonly values: ReadonlyMap<string, readonly string[]>;
  /** Long options and short letters that appeared, value-taking or not. */
  readonly flags: ReadonlySet<string>;
}

/**
 * Split an invocation's arguments into positionals, option values, and flags,
 * skipping the values options consume. Everything after `--` is positional.
 */
function parseArgs(grammar: ToolGrammar, words: readonly string[]): ParsedArgs {
  const longByShort = new Map<string, string>();
  for (const [long, short] of Object.entries(grammar.valueOptions)) {
    if (short) longByShort.set(short, long);
  }
  const execLongByShort = new Map<string, string>();
  for (const [long, short] of Object.entries(grammar.untilSemicolon ?? {})) {
    execLongByShort.set(short, long);
  }
  const positional: string[] = [];
  const values = new Map<string, string[]>();
  const flags = new Set<string>();
  const record = (long: string, value: string | undefined) => {
    if (value !== undefined)
      values.set(long, [...(values.get(long) ?? []), value]);
  };
  const skipPastSemicolon = (from: number): number => {
    const end = words.indexOf(";", from);
    return end === -1 ? words.length : end;
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === undefined) continue;
    if (word === "--") {
      positional.push(...words.slice(index + 1));
      break;
    }
    if (word.startsWith("--")) {
      const equals = word.indexOf("=");
      const long = equals === -1 ? word : word.slice(0, equals);
      flags.add(long);
      if (grammar.untilSemicolon?.[long] !== undefined) {
        index = skipPastSemicolon(index + 1);
      } else if (equals !== -1) {
        record(long, word.slice(equals + 1));
      } else if (Object.hasOwn(grammar.valueOptions, long)) {
        index += 1;
        record(long, words[index]);
      }
      continue;
    }
    if (word.startsWith("-") && word.length > 1) {
      const letters = word.slice(1);
      for (let at = 0; at < letters.length; at += 1) {
        const letter = letters.charAt(at);
        flags.add(letter);
        if (execLongByShort.has(letter)) {
          index = skipPastSemicolon(index + 1);
          break;
        }
        const long = longByShort.get(letter);
        if (long === undefined) continue;
        // A value-taking letter consumes the rest of the group, or the next
        // argument when it is the group's last letter.
        const attached = letters.slice(at + 1);
        if (attached === "") index += 1;
        record(long, attached === "" ? words[index] : attached);
        break;
      }
      continue;
    }
    positional.push(word);
  }
  return { positional, values, flags };
}

/** `find [global-options] path... expression`; paths precede the expression. */
function findPaths(words: readonly string[]): string[] {
  const paths: string[] = [];
  for (const word of words) {
    if (word.startsWith("-") || ["!", "(", ")", ","].includes(word)) break;
    paths.push(word);
  }
  return paths;
}

/**
 * `rg`/`grep [options] pattern path...`: a pattern-supplying option (-e, -f),
 * or rg's --files listing mode, makes every positional a path.
 */
function patternSearchPaths(
  grammar: ToolGrammar,
  args: readonly string[],
): readonly string[] {
  const { positional, values, flags } = parseArgs(grammar, args);
  const noPatternPositional =
    values.has("--regexp") || values.has("--file") || flags.has("--files");
  return noPatternPositional ? positional : positional.slice(1);
}

function grepIsRecursive(args: readonly string[]): boolean {
  const { flags } = parseArgs(GREP, args);
  return ["r", "R", "--recursive", "--dereference-recursive"].some((flag) =>
    flags.has(flag),
  );
}

/**
 * `fd [options] [pattern] [path...]`. --search-path replaces positional paths;
 * --base-directory is the search root when no path is given, and what `.`
 * resolves to when one is.
 */
function fdPaths(args: readonly string[]): readonly string[] {
  const { positional, values } = parseArgs(FD, args);
  const searchPaths = values.get("--search-path");
  const explicit = searchPaths ?? positional.slice(1);
  const baseDirectory = values.get("--base-directory")?.at(-1);
  if (baseDirectory === undefined) return explicit;
  if (explicit.length === 0) return [baseDirectory];
  return explicit.map((path) =>
    withoutTrailingSlashes(path) === "." ? baseDirectory : path,
  );
}

function searchesRootOrHome(command: ShellCommand): boolean {
  const [head, ...args] = command.words;
  if (head === undefined) return false;

  switch (basename(head)) {
    case "find":
      return findPaths(args).some(isRootOrHome);
    case "fd":
    case "fdfind":
      return fdPaths(args).some(isRootOrHome);
    case "rg":
      return patternSearchPaths(RG, args).some(isRootOrHome);
    case "grep":
      return (
        grepIsRecursive(args) &&
        patternSearchPaths(GREP, args).some(isRootOrHome)
      );
    default:
      return false;
  }
}

export const recursiveSearchBlock: ConventionBlock = {
  id: "recursive-search",
  detect: (command) => commandInvocations(command).some(searchesRootOrHome),
  rationale:
    "Recursively searching from `/`, `~`, or `$HOME` scans the whole filesystem or home directory: it is slow, floods the context with irrelevant matches, and can surface private files that were never meant to leave the machine.",
  alternative:
    "Scope the search to a specific relevant directory: the project root, a subdirectory, or a named path under home.",
  exception: {
    description:
      "why the whole filesystem or home directory is the search scope",
  },
};
