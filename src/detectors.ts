import { type ShellCommand, shellCommands } from "./shell.ts";
import {
  expandWrappers,
  type WrapperDefinition,
  type WrapperTarget,
} from "./wrappers.ts";

const basename = (word: string): string => word.split("/").pop() ?? word;

function named(word: string | undefined, name: string): boolean {
  if (word === undefined) return false;
  return name.includes("/")
    ? word === name || word.endsWith(`/${name}`)
    : basename(word) === name;
}

function targetCommands(target: WrapperTarget): ShellCommand[] {
  if ("script" in target) return shellCommands(target.script);
  return target.words.length === 0 ? [] : [{ words: [...target.words] }];
}

/**
 * Enumerate command invocations in shell source, unwrapping built-in and
 * custom wrappers down to their payload commands.
 *
 * Wrapper recursion is deliberately bounded: definitions should unwrap toward
 * a payload command. Raise this ceiling if a real command stack exceeds it.
 */
export function commandInvocations(
  source: string,
  wrappers: readonly WrapperDefinition[] = [],
): ShellCommand[] {
  const queue = shellCommands(source);
  const invocations: ShellCommand[] = [];

  for (let index = 0; index < queue.length && index < 64; index += 1) {
    const command = queue[index];
    if (!command) continue;
    invocations.push(command);
    for (const target of expandWrappers(command, wrappers)) {
      queue.push(...targetCommands(target));
    }
  }
  return invocations;
}

export function invokesCommand(
  name: string,
  wrappers: readonly WrapperDefinition[] = [],
): (command: string) => boolean {
  return (source: string): boolean =>
    commandInvocations(source, wrappers).some((command) =>
      named(command.words[0], name),
    );
}
