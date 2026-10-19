import { Inngest } from "inngest";

/**
 * The app's one Inngest client. The SDK reads its keys from the environment:
 * INNGEST_EVENT_KEY to send events, INNGEST_SIGNING_KEY to verify calls to
 * /api/inngest. Locally neither is needed, but INNGEST_DEV=1 is (it comes from
 * the committed .env.development); without it the client is in cloud mode and
 * the serve route 500s for want of a signing key. See the README.
 */
export const inngest = new Inngest({ id: "as-ghlc" });
