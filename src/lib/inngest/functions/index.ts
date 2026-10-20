import type { InngestFunction } from "inngest";

import { ghlImport, ghlReconcile } from "./ghl-sync";
import { ghlWebhook } from "./ghl-webhook";
import { leadResearchJob } from "./research";

/** Every Inngest function the app serves. Add each job here as its spec lands. */
export const functions: InngestFunction.Any[] = [
  ghlImport,
  ghlReconcile,
  ghlWebhook,
  leadResearchJob,
];
