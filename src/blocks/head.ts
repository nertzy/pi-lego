import type { ConventionBlock } from "../index.ts";

export const headBlock: ConventionBlock = {
  id: "head",
  pattern: { command: "head" },
  rationale:
    "Pi already bounds model-visible output and preserves the full result when it truncates, so hiding ordinary output with `head` loses useful evidence. `head` also waits for N lines or EOF; a live producer that emits fewer lines while keeping stdout open can wait indefinitely.",
  alternative:
    "Let the full output stream and rely on pi's bounds. For live streams, use producer-native bounds or a timeout; use `head` only when the initial lines are the actual query.",
  exception: {
    description: "specific reason",
  },
};
