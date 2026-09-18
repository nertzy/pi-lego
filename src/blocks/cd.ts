import { parse } from "unbash";

import type { ConventionBlock, ShellCommand } from "../index.ts";
import { expandWrappers, type WrapperDefinition } from "../wrappers.ts";

type AstNode = {
  type: string;
  name?: { value: string };
  suffix?: Array<{ value: string }>;
  command?: AstNode;
  commands?: AstNode[];
};

const basename = (word: string): string => word.split("/").pop() ?? word;

/** The final executable command of a statement, or undefined for control flow. */
function finalCommand(node: AstNode | undefined): AstNode | undefined {
  if (node === undefined) return undefined;
  if (node.type === "Command") return node;
  if (node.type === "Statement") return finalCommand(node.command);
  if (node.type === "AndOr" || node.type === "Pipeline") {
    return finalCommand(node.commands?.at(-1));
  }
  return undefined;
}

function toShellCommand(node: AstNode): ShellCommand {
  const name = node.name?.value ?? "";
  return { words: [name, ...(node.suffix ?? []).map((s) => s.value)] };
}

/**
 * True when source's last effective command is a `cd` — one whose directory
 * change nothing in the same call consumes, so it is discarded when the call
 * ends. A `cd` with a consumer later in its chain (`cd x && make`) is visible
 * next to that consumer and is allowed.
 */
function endsInDiscardedCd(
  source: string,
  wrappers: readonly WrapperDefinition[],
): boolean {
  const script = parse(source);
  const candidate = finalCommand(
    script.commands?.at(-1) as AstNode | undefined,
  );
  if (candidate === undefined) return false;

  const command = toShellCommand(candidate);
  if (basename(command.words[0] ?? "") === "cd") return true;

  for (const target of expandWrappers(command, wrappers)) {
    if ("script" in target) {
      if (endsInDiscardedCd(target.script, wrappers)) return true;
    } else if (basename(target.words[0] ?? "") === "cd") {
      return true;
    }
  }
  return false;
}

export const cdBlock: ConventionBlock = {
  id: "cd",
  detect: (command) => endsInDiscardedCd(command, []),
  rationale:
    "A `cd` that ends a bash call changes a directory nothing in the call goes on to use, and each pi bash call starts fresh in the session working directory, so it never carries over to the next call either. The directory change is pure noise — or evidence a later call wrongly assumes it happened.",
  alternative:
    "Keep the `cd` next to its consumer in one chain (`cd dashboard && mise x -- bin/dev`), run commands with cwd-relative or absolute paths, or use the tool's own directory flag (`git -C`, `npm --prefix`, `make -C`).",
  exception: {
    description: "why this directory change stands alone",
  },
};
