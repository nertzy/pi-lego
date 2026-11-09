import type { ArgumentBlock } from "../arguments.ts";

// Context pruners replace the arguments of old tool calls with a stand-in
// like `<purged-args size="900" ref="t323"/>` or
// `<purged-errored-args size="657"/>`. A model re-issuing "the same call"
// copies the stand-in verbatim, so the whole argument is the marker.
const PLACEHOLDER = /^\s*<purged-(?:errored-)?args\b[^<>]*\/>\s*$/;

export const prunedPlaceholderBlock: ArgumentBlock = {
  id: "pruned-placeholder",
  detect: ({ value }) => PLACEHOLDER.test(value),
  rationale:
    "`<purged-args .../>` is a context-pruning placeholder that stands in for an earlier call's arguments; it was never the real command or content. Passing it on runs or writes the marker itself: a syntax error at best, an overwritten file at worst.",
  alternative:
    "Recover the original arguments from the pruner (`context_tree_query` with the placeholder's `ref` under pi-condense), or write the argument out in full again.",
};
