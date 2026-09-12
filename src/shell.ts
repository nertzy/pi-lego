import { parse, type Command, type ParsedScript, type Word, type WordPart } from "unbash";

export interface ShellCommand {
  words: string[];
}

function visitWordPart(part: WordPart, visit: (value: unknown) => void): void {
  visit(part);
}

function visitWord(word: Word | undefined, visit: (value: unknown) => void): void {
  if (!word) return;
  for (const part of word.parts ?? []) visitWordPart(part, visit);
}

/** Extract simple command invocations, including commands nested in expansions. */
export function shellCommands(source: string): ShellCommand[] {
  const commands: ShellCommand[] = [];
  const seen = new Set<object>();

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }

    const candidate = value as { type?: string };
    if (candidate.type === "Command") {
      const command = candidate as Command;
      if (command.name) {
        commands.push({
          words: [command.name.value, ...command.suffix.map((word) => word.value)],
        });
      }
      visitWord(command.name, visit);
      for (const word of command.suffix) visitWord(word, visit);
      for (const assignment of command.prefix) visitWord(assignment.value, visit);
      for (const redirect of command.redirects) {
        visitWord(redirect.target, visit);
        visitWord(redirect.body, visit);
      }
      return;
    }

    for (const child of Object.values(value)) visit(child);
  };

  // unbash intentionally returns a useful partial tree alongside parse errors.
  // Convention detection uses that tree; it does not claim malformed input is valid.
  visit(parse(source) satisfies ParsedScript);
  return commands;
}
