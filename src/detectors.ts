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

export function invokesCommand(
  name: string,
  wrappers: readonly WrapperDefinition[] = [],
): (command: string) => boolean {
  return (source: string): boolean => {
    const queue = shellCommands(source);

    // Wrapper recursion is deliberately bounded: definitions should unwrap toward
    // a payload command. Raise this ceiling if a real command stack exceeds it.
    for (let index = 0; index < queue.length && index < 64; index += 1) {
      const command = queue[index];
      if (command && named(command.words[0], name)) return true;
      if (command) {
        for (const target of expandWrappers(command, wrappers)) {
          queue.push(...targetCommands(target));
        }
      }
    }
    return false;
  };
}
