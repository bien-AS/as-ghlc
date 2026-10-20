import type { InngestFunction } from "inngest";

import { ghlImport, ghlReconcile } from "./ghl-sync";

/** Every Inngest function the app serves. Add each job here as its spec lands. */
export const functions: InngestFunction.Any[] = [ghlImport, ghlReconcile];
