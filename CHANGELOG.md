# Changelog

Notable changes to `pi-lego` are documented here.

## [Unreleased]

### Added

- Added `commandInvocations(command, wrappers?)` to the public API so custom `detect` functions can inspect the arguments of unwrapped commands.
- Added an `appliesTo(scope)` registration option that narrows which tool calls blocks evaluate, with access to the tool name, command text, and session cwd.

## [0.1.1] - 2026-09-17

### Changed

- Clarified block feedback: the message now states that the command was not executed, says "`tail` not allowed" to mirror the `# allow tail:` exception marker, and leads with the recovery action (re-run without the blocked segment).

## [0.1.0] - 2026-09-12

### Added

- Added a framework for composing reusable agent-convention blocks.
- Added built-in `head` and `tail` blocks with explicit comment-based exceptions.
- Added shell-wrapper detection so conventions apply through nested shell commands.
- Added CI across the minimum supported Node version and the current Node LTS, including a packed-package runtime smoke test.
