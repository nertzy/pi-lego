import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** One string value inside a tool call's input. */
export interface ToolArgument {
  toolName: string;
  /** Dotted path from the input root, e.g. `content` or `edits.0.newText`. */
  path: string;
  value: string;
}

/**
 * A block over the string arguments of any tool call, for conventions that
 * concern what a call carries rather than which shell command it runs.
 *
 * There is no comment exception: argument blocks cover text that has no
 * legitimate form, so they cannot be overridden.
 */
export interface ArgumentBlock {
  id: string;
  /** Tool names whose inputs the block inspects; omit to inspect every tool. */
  tools?: readonly string[];
  detect(argument: ToolArgument): boolean;
  rationale: string;
  alternative: string;
}

/** The context a registration-scope predicate sees for one tool call. */
export interface ArgumentScope {
  toolName: string;
  cwd?: string;
}

export interface RegisterArgumentOptions {
  /**
   * Narrow which tool calls the blocks evaluate, for example by `scope.cwd`.
   * Without it, blocks apply to every tool call.
   */
  appliesTo?: (scope: ArgumentScope) => boolean;
}

/** Every string leaf in a tool input, depth first, with its dotted path. */
export function stringArguments(
  toolName: string,
  input: unknown,
): ToolArgument[] {
  const found: ToolArgument[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      found.push({ toolName, path, value });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        visit(item, `${path}.${index}`);
      });
    } else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        visit(item, path === "" ? key : `${path}.${key}`);
      }
    }
  };
  visit(input, "");
  return found;
}

function feedback(
  block: ArgumentBlock,
  toolName: string,
  paths: readonly string[],
): string {
  const where =
    paths.length === 1
      ? `argument \`${paths[0]}\``
      : `arguments ${paths.map((path) => `\`${path}\``).join(", ")}`;
  return [
    `Tool call blocked (not executed): \`${block.id}\` not allowed in \`${toolName}\` ${where}.`,
    block.rationale,
    `Instead: ${block.alternative}`,
  ].join("\n");
}

export function evaluateArguments(
  toolName: string,
  input: unknown,
  blocks: readonly ArgumentBlock[],
): string | undefined {
  const args = stringArguments(toolName, input);
  const reasons: string[] = [];
  for (const block of blocks) {
    if (block.tools && !block.tools.includes(toolName)) continue;
    const paths = args
      .filter((argument) => block.detect(argument))
      .map((argument) => argument.path);
    if (paths.length > 0) reasons.push(feedback(block, toolName, paths));
  }
  return reasons.length === 0 ? undefined : reasons.join("\n\n");
}

export function registerArgumentBlocks(
  pi: ExtensionAPI,
  blocks: readonly ArgumentBlock[],
  options: RegisterArgumentOptions = {},
): void {
  pi.on("tool_call", (event, ctx) => {
    if (
      options.appliesTo &&
      !options.appliesTo({ toolName: event.toolName, cwd: ctx?.cwd })
    ) {
      return undefined;
    }
    const reason = evaluateArguments(event.toolName, event.input, blocks);
    return reason ? { block: true, reason } : undefined;
  });
}
