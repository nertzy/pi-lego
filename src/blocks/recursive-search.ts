import {
  type ConventionBlock,
  commandInvocations,
  type ShellCommand,
} from "../index.ts";

/** A word that names the filesystem root or the home directory itself. */
function isRootOrHome(word: string): boolean {
  const trimmed = word.replace(/\/+$/, "");
  if (trimmed === "") return word.length > 0; // "/", "//", ...
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal shell form is the match target
  return trimmed === "~" || trimmed === "$HOME" || trimmed === "${HOME}";
}

const basename = (word: string): string => word.split("/").pop() ?? word;

// Long options that consume the following argument as their value.
const LONG_VALUE_OPTIONS: Record<string, readonly string[]> = {
  rg: [
    "--regexp",
    "--file",
    "--glob",
    "--iglob",
    "--type",
    "--type-not",
    "--type-add",
    "--max-count",
    "--max-columns",
    "--max-depth",
    "--max-filesize",
    "--after-context",
    "--before-context",
    "--context",
    "--threads",
    "--sort",
    "--sortr",
    "--path-separator",
    "--encoding",
    "--engine",
    "--colors",
    "--ignore-file",
    "--pre",
    "--hostname-bin",
    "--field-context-separator",
    "--field-match-separator",
  ],
  grep: [
    "--regexp",
    "--file",
    "--exclude",
    "--include",
    "--exclude-dir",
    "--exclude-from",
    "--max-count",
    "--after-context",
    "--before-context",
    "--context",
    "--directories",
    "--devices",
    "--label",
    "--binary-files",
    "--group-separator",
  ],
};

// Short-option letters that consume a value (attached or as the next argument).
const SHORT_VALUE_LETTERS: Record<string, string> = {
  rg: "efgtTmMABCjE",
  grep: "efmABCDd",
};

/**
 * Positional arguments of an invocation, skipping option flags and the values
 * they consume. Everything after `--` is positional. Also reports whether a
 * pattern-supplying option (-e/--regexp, -f/--file) appeared; when it did,
 * every positional is a path, otherwise the first positional is the pattern.
 */
function positionalArgs(
  name: string,
  words: readonly string[],
): { positional: string[]; patternSupplied: boolean } {
  const longValueOptions = new Set(LONG_VALUE_OPTIONS[name] ?? []);
  const shortValueLetters = SHORT_VALUE_LETTERS[name] ?? "";
  const positional: string[] = [];
  let patternSupplied = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word === undefined) continue;
    if (word === "--") {
      positional.push(...words.slice(index + 1));
      break;
    }
    if (word.startsWith("--")) {
      const [option] = word.split("=", 1);
      if (option === "--regexp" || option === "--file") patternSupplied = true;
      if (!word.includes("=") && option && longValueOptions.has(option)) {
        index += 1;
      }
      continue;
    }
    if (word.startsWith("-") && word.length > 1) {
      const letters = word.slice(1);
      if (letters.includes("e") || letters.includes("f")) {
        patternSupplied = true;
      }
      // A value-taking letter consumes the rest of the group, or the next
      // argument when it is the group's last letter.
      const valueAt = [...letters].findIndex((letter) =>
        shortValueLetters.includes(letter),
      );
      if (valueAt === letters.length - 1) index += 1;
      continue;
    }
    positional.push(word);
  }
  return { positional, patternSupplied };
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

function grepIsRecursive(words: readonly string[]): boolean {
  return words.some((word) =>
    word.startsWith("--")
      ? word === "--recursive" || word === "--dereference-recursive"
      : word.startsWith("-") && /[rR]/.test(word.slice(1)),
  );
}

function searchPaths(name: string, args: readonly string[]): string[] {
  const { positional, patternSupplied } = positionalArgs(name, args);
  return patternSupplied ? positional : positional.slice(1);
}

function searchesRootOrHome(command: ShellCommand): boolean {
  const [head, ...args] = command.words;
  if (head === undefined) return false;
  const name = basename(head);

  switch (name) {
    case "find":
      return findPaths(args).some(isRootOrHome);
    case "rg":
      return searchPaths("rg", args).some(isRootOrHome);
    case "grep":
      return (
        grepIsRecursive(args) && searchPaths("grep", args).some(isRootOrHome)
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
