import {
  type ConventionBlock,
  commandInvocations,
  type ShellCommand,
} from "../index.ts";

const basename = (word: string): string => word.split("/").pop() ?? word;

// git global options that consume the following argument as their value.
const GIT_VALUE_OPTIONS = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
]);

/**
 * The git subcommand and its arguments, skipping global options such as
 * `git -C repo` or `git --git-dir=x` that precede it.
 */
function gitSubcommand(
  words: readonly string[],
): { subcommand: string; args: readonly string[] } | undefined {
  let index = 0;
  while (index < words.length) {
    const word = words[index];
    if (word === undefined || !word.startsWith("-")) break;
    index += GIT_VALUE_OPTIONS.has(word) ? 2 : 1;
  }
  const subcommand = words[index];
  return subcommand === undefined
    ? undefined
    : { subcommand, args: words.slice(index + 1) };
}

function skipsHooks(command: ShellCommand): boolean {
  const [head, ...rest] = command.words;
  if (head === undefined || basename(head) !== "git") return false;
  const parsed = gitSubcommand(rest);
  if (parsed === undefined) return false;
  const { subcommand, args } = parsed;

  if (subcommand !== "commit" && subcommand !== "push") return false;
  if (args.some((arg) => arg === "--no-verify")) return true;
  // `git commit -n` (also in groups like `-an`) is --no-verify. For push,
  // `-n` is --dry-run, which does not skip hooks. Value-taking short options
  // with an attached value (`-mmsg`) are messages, not flag groups.
  return (
    subcommand === "commit" &&
    args.some(
      (arg) =>
        arg.startsWith("-") &&
        !arg.startsWith("--") &&
        !(arg.length > 2 && "mcCFt".includes(arg.charAt(1))) &&
        arg.slice(1).includes("n"),
    )
  );
}

export const noVerifyBlock: ConventionBlock = {
  id: "no-verify",
  detect: (command) => commandInvocations(command).some(skipsHooks),
  rationale:
    "`--no-verify` bypasses the hooks the repository runs to protect every commit and push — tests, lint, and signing checks included. Whatever the hook would have caught lands in the history instead.",
  alternative:
    "Run the commit or push normally and fix what the hook reports. If a hook is genuinely broken, fix or reconfigure the hook rather than bypassing it.",
  exception: {
    description:
      "which hook is being skipped and why bypassing it is safe here",
  },
};
