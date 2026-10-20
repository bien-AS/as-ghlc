import { serve } from "inngest/next";

import { assertCloudModeOnDeployment } from "@/lib/inngest/assert-cloud-mode";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// No profile guard: this is Inngest's framework endpoint, not a data route. The SDK signs
// every call with INNGEST_SIGNING_KEY, and the guard below keeps signing switched on.

export const runtime = "nodejs";
// One step per request: the research brief step (site fetch plus a model call capped at 120 s) needs minutes.
export const maxDuration = 300;

// At module scope, so a deployment carrying INNGEST_DEV fails at build time instead of
// serving functions unsigned.
assertCloudModeOnDeployment();

export const { GET, POST, PUT } = serve({ client: inngest, functions });
