# pi-lego

[![npm version](https://img.shields.io/npm/v/pi-lego)](https://www.npmjs.com/package/pi-lego)

Turn repeated agent corrections into reusable blocks.

pi-lego is a framework for executable agent conventions. A block detects a command pattern, explains why it is unhelpful, gives an actionable alternative, and can offer a reason-bearing local exception. The default extension includes the `head` and `tail` blocks.

This is corrective feedback, not a sandbox or permissions engine. It does not verify authorization, parse every shell construct, show confirmation dialogs, or grant permissions through slash commands.

## Install

Install the published package:

```bash
pi install npm:pi-lego
```

For local development, install a checkout instead:

```bash
pi install /path/to/pi-lego
```

Restart pi or run `/reload`. The package's default extension registers the included blocks for `bash` and `cmux_open_terminal` tool calls.

## Included blocks

Ordinary command output should stream because pi already bounds model-visible output and preserves the full result when it truncates. Using `head` or `tail` to hide ordinary output loses evidence; let the full output stream and rely on the harness bounds instead.

When a block matches, the command is not executed and the agent sees feedback like:

```text
Command blocked (not executed): `tail` not allowed.
Pi already bounds model-visible output and preserves the full result when it truncates, so hiding ordinary output with `tail` loses useful evidence.
Instead: Re-run the same command without the `tail` segment and let the output stream. Use a producer's own filters when the query itself is narrow.
Exception: put `# allow tail: <specific reason>` in the leading comment block.
```

### `head`

`head` waits for N lines or EOF. A finite producer that closes after fewer lines returns normally, but a live producer that keeps stdout open can wait indefinitely. Prefer producer-native bounds or a timeout for live streams. An initial-lines query can declare its narrow intent in the leading comment block:

```bash
# allow head: the initial lines are the query
head -n 50 app.log
```

### `tail`

A last-lines query can declare its narrow intent in the leading comment block:

```bash
# allow tail: the final lines are the query
journalctl --unit app | tail -n 50
```

The leading comment block may contain blank lines and multiple standalone comments, so each matching block can have its own exception. Parsing stops at the first executable line. Reasons must be nonempty, but may contain ordinary punctuation because the comment is inert. Quoted strings, inline comments, malformed comments, and comments after an executable line do not bypass a block.

## Write a block

Blocks are small TypeScript objects. There is no JSON DSL.

Import from the public `pi-lego` and `@earendil-works/pi-coding-agent` package names, not checkout paths or package internals. Your extension must be able to resolve its dependencies from its own location. For a packaged extension, declare `pi-lego` in `dependencies`; installing pi-lego as a Pi extension does not by itself put it on every standalone extension's module search path.

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerBlocks, type ConventionBlock } from "pi-lego";

const archive: ConventionBlock = {
  id: "archive",
  pattern: { command: "archive" },
  rationale: "Archiving during an edit loop hides the files under review.",
  alternative: "Inspect the working files directly.",
  exception: {
    description: "specific reason",
  },
};

export default function (pi: ExtensionAPI): void {
  registerBlocks(pi, [archive]);
}
```

A command pattern matches executable positions through pipelines, control flow, substitutions, nested shell commands, and the built-in wrappers `command`, `nohup`, `sudo`, `env`, `timeout`, `xargs`, `find -exec`, `bash`/`sh`/`zsh`/`fish -c`, `op run --`, `op plugin run --`, and `mise exec`/`mise x ... --`. Use `detect(command)` instead when a convention needs custom matching; a block cannot define both. If `exception.comment` is omitted, it defaults to `allow <id>`. Omit `exception` entirely for a block that cannot be overridden.

If several blocks match, pi-lego reports all of them. Each exception only bypasses the block that owns its exact comment marker; all other matching blocks are still reported.

### Add command wrappers

Custom wrapper definitions compose with the built-ins. A declarative prefix can be a shell string or an exact token array:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineWrapper, registerBlocks } from "pi-lego";

const wrappers = [
  defineWrapper({ prefix: "launcher start --" }),
  defineWrapper({ prefix: ["runner", "exec", "--"] }),
];

export default function (pi: ExtensionAPI): void {
  registerBlocks(pi, [archive], { wrappers });
}
```

String prefixes are parsed once by `defineWrapper`, so quoting is honored: `launcher 'special mode' --` contains three tokens. A string prefix must be one static simple command; assignments, redirects, pipelines, control operators, parameter expansion, and command substitution are rejected. Token arrays are already-tokenized exact prefixes and are not shell-expanded.

Use a resolver for wrappers whose options do not have one fixed prefix:

```ts
const unusual = defineWrapper({
  command: "launcher",
  resolve(args) {
    const marker = args.indexOf("execute:");
    return marker < 0 ? undefined : { words: args.slice(marker + 1) };
  },
});
```

A resolver can return `{ words: [...] }` for an already-tokenized command or `{ script: "..." }` for nested Bash source. It receives dequoted argument values; it never executes or expands them.

## Scope and limitations

- Matchers inspect command text before tool execution. They do not constrain other tools or commands launched outside these two pi tool calls.
- Shell structure is parsed without execution by [unbash](https://github.com/webpro-nl/unbash). It targets Bash (with much POSIX `sh` syntax), not PowerShell, `cmd.exe`, or every construct of other shells. Malformed input is inspected through unbash's best-effort partial AST; parser recovery can still omit an invocation.
- Wrapper definitions model command-specific argument semantics. The built-ins cover only the forms listed above; unsupported flags or an unusual form may require a custom resolver. Wrapper expansion is capped at 64 commands to stop cyclic custom definitions.
- Exceptions are local declarations of intent. They are not capabilities, signed approvals, or an audit system.
- A block author owns false-positive and false-negative behavior in its matcher.

## Positioning

Custom blocking hooks are already part of pi's extension API. pi-lego focuses on composing corrections for safe-but-wrong approaches: explain the convention, offer a useful alternative, and allow a narrow local exception when warranted.

The wrapper registry and flag-boundary approach were adapted from [`pi-guard`'s `src/wrappers.ts`](https://github.com/jdiamond/pi-guard/blob/main/src/wrappers.ts), by Jason Diamond, under the MIT license. See `THIRD_PARTY_NOTICES.md`. Shell parsing uses unbash 4.0.11 under the ISC license.

Related projects cover adjacent needs:

- [pi-guardrails](https://github.com/aliou/pi-guardrails) focuses on dangerous operations, secrets, and protected files.
- [pi-permission-system](https://github.com/MasuRii/pi-permission-system) provides centralized allow, deny, and ask decisions.
- [pi-guard](https://github.com/jdiamond/pi-guard) provides extensible matchers and shell parsing.

## Development

pi-lego supports the Node.js release lines in [active support](https://endoflife.date/nodejs); see [CONTRIBUTING.md](CONTRIBUTING.md) for the current toolchain requirements.

```bash
npm ci
npm run check
npm pack --dry-run
```

## License

MIT
