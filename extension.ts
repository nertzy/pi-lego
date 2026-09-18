import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { cdBlock } from "./src/blocks/cd.ts";
import { headBlock } from "./src/blocks/head.ts";
import { tailBlock } from "./src/blocks/tail.ts";
import { registerBlocks } from "./src/index.ts";

export default function (pi: ExtensionAPI): void {
  registerBlocks(pi, [headBlock, tailBlock, cdBlock]);
}
