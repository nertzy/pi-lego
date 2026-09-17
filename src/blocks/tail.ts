import type { ConventionBlock } from "../index.ts";

export const tailBlock: ConventionBlock = {
  id: "tail",
  pattern: { command: "tail" },
  rationale:
    "Pi already bounds model-visible output and preserves the full result when it truncates, so hiding ordinary output with `tail` loses useful evidence.",
  alternative:
    "Re-run the same command without the `tail` segment and let the output stream. Use a producer's own filters when the query itself is narrow.",
  exception: {
    description: "specific reason",
  },
};
