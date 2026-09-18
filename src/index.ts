import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

import { commandInvocations, invokesCommand } from "./detectors.ts";

export type { ShellCommand } from "./shell.ts";
export {
  builtInWrappers,
  defineWrapper,
  type WrapperDefinition,
  type WrapperInput,
  type WrapperInvocation,
  type WrapperTarget,
} from "./wrappers.ts";
export { commandInvocations };

import type { WrapperDefinition } from "./wrappers.ts";

interface ConventionBlockBase {
  id: string;
  rationale: string;
  alternative: string;
  exception?: {
    comment?: string;
    description: string;
    note?: string;
  };
}

export type ConventionBlock = ConventionBlockBase &
  (
    | { pattern: { command: string }; detect?: never }
    | { detect(command: string): boolean; pattern?: never }
  );

function exceptionComment(block: ConventionBlock): string {
  return block.exception?.comment ?? `allow ${block.id}`;
}

export interface EvaluationOptions {
  wrappers?: readonly WrapperDefinition[];
}

/** The context a registration-scope predicate sees for one tool call. */
export interface BlockScope {
  toolName: string;
  command: string;
  cwd?: string;
}

export interface RegisterOptions extends EvaluationOptions {
  /**
   * Narrow which tool calls the blocks evaluate, for example by `scope.cwd`.
   * Without it, blocks apply to every bash and cmux_open_terminal call.
   */
  appliesTo?: (scope: BlockScope) => boolean;
}

function detects(
  command: string,
  block: ConventionBlock,
  wrappers: readonly WrapperDefinition[],
): boolean {
  return block.pattern
    ? invokesCommand(block.pattern.command, wrappers)(command)
    : block.detect(command);
}

function hasException(command: string, block: ConventionBlock): boolean {
  if (!block.exception) return false;
  const prefix = `# ${exceptionComment(block)}:`;

  for (const sourceLine of command.split("\n")) {
    const line = sourceLine.trim();
    if (line === "") continue;
    if (!line.startsWith("#")) return false;
    if (line.startsWith(prefix) && line.slice(prefix.length).trim() !== "")
      return true;
  }

  return false;
}

function feedback(block: ConventionBlock): string {
  const lines = [
    `Command blocked (not executed): \`${block.id}\` not allowed.`,
    block.rationale,
    `Instead: ${block.alternative}`,
  ];
  if (block.exception) {
    lines.push(
      `Exception: put \`# ${exceptionComment(block)}: <${block.exception.description}>\` in the leading comment block.`,
    );
    if (block.exception.note) lines.push(block.exception.note);
  }
  return lines.join("\n");
}

export function evaluateCommand(
  command: string,
  blocks: readonly ConventionBlock[],
  options: EvaluationOptions = {},
): string | undefined {
  const wrappers = options.wrappers ?? [];
  const violations = blocks.filter(
    (block) =>
      detects(command, block, wrappers) && !hasException(command, block),
  );
  if (violations.length === 0) return undefined;
  return violations.map(feedback).join("\n\n");
}

export function registerBlocks(
  pi: ExtensionAPI,
  blocks: readonly ConventionBlock[],
  options: RegisterOptions = {},
): void {
  pi.on("tool_call", (event, ctx) => {
    let command: string | undefined;
    if (isToolCallEventType("bash", event)) {
      command = event.input.command;
    } else if (event.toolName === "cmux_open_terminal") {
      const input = event.input as { command?: unknown };
      if (typeof input.command === "string") command = input.command;
    }

    if (command === undefined) return undefined;
    if (
      options.appliesTo &&
      !options.appliesTo({
        toolName: event.toolName,
        command,
        cwd: ctx?.cwd,
      })
    ) {
      return undefined;
    }
    const reason = evaluateCommand(command, blocks, options);
    return reason ? { block: true, reason } : undefined;
  });
}
