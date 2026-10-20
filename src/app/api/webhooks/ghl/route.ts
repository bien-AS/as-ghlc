import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { apiError, invalidInput } from "@/lib/api/respond";
import { inngest } from "@/lib/inngest/client";
import {
  ASSUMED_PAYLOADS,
  forgetWebhookEvent,
  GHL_WEBHOOK_RECEIVED,
  recordWebhookEvent,
  webhookType,
} from "@/lib/inngest/functions/ghl-webhook";

/*
 * Events in (spec 06). GHL retries only on 429 and drops an event after a 5xx,
 * so this verifies, records and answers at once; the Inngest job does the work.
 * URL: /api/webhooks/ghl?event=<type>, one per workflow (types: ASSUMED_PAYLOADS).
 */

const SECRET_HEADER = "x-webhook-secret";

/** The per-location secret, from the header or the `secret` query parameter, compared in constant time. */
function secretMatches(given: string | null): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret || !given) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

/**
 * GHL's own signature, if workflow webhooks turn out to carry one (spec 06 open
 * question 7). None is known yet, so it passes; the secret is the check.
 */
function ghlSignatureValid(_request: Request, _body: string): boolean {
  return true;
}

/** The secret never reaches a stored payload, whatever the sender put in the body. */
function redact(body: string): string {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  return secret ? body.replaceAll(secret, "[redacted]") : body;
}

// ponytail: per-instance memory, bounds only how many refusals one address can make us store;
// spec 16 moves rate limits to a shared store.
const refusals = new Map<string, { count: number; until: number }>();
function refusalLimited(request: Request): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const now = Date.now();
  const hit = refusals.get(ip);
  if (hit && hit.until > now) return ++hit.count > 30;
  if (refusals.size > 10_000) refusals.clear();
  refusals.set(ip, { count: 1, until: now + 60_000 });
  return false;
}

const retryLater = (code: string) =>
  Response.json(
    { error: { code } },
    { status: 429, headers: { "Retry-After": "60" } },
  );

export async function POST(request: Request) {
  // Not session-guarded: GHL calls it. The per-location secret is the control.
  const url = new URL(request.url);
  const body = await request.text();
  const verified =
    secretMatches(
      request.headers.get(SECRET_HEADER) ?? url.searchParams.get("secret"),
    ) && ghlSignatureValid(request, body);
  const type = webhookType.safeParse(url.searchParams.get("event"));
  const raw = redact(body);

  const record = (isVerified: boolean, outcome: string) =>
    recordWebhookEvent({
      eventId: `${outcome}:${randomUUID()}`,
      type: type.data ?? "unknown",
      verified: isVerified,
      payload: { raw: raw.slice(0, 2000) },
      outcome,
    });

  if (!verified) {
    if (refusalLimited(request)) return retryLater("rate_limited");
    await record(false, "refused");
    return apiError("unauthenticated", 401);
  }

  if (!type.success) {
    await record(true, "malformed");
    return invalidInput(type.error);
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  const payload = ASSUMED_PAYLOADS[type.data].safeParse(json);
  if (!payload.success) {
    await record(true, "malformed");
    return invalidInput(payload.error);
  }

  const id = await recordWebhookEvent({
    eventId: payload.data.webhookId,
    type: type.data,
    verified: true,
    payload: json,
  });
  if (!id) return Response.json({ received: true, duplicate: true });

  try {
    await inngest.send({
      name: GHL_WEBHOOK_RECEIVED,
      data: { webhookEventId: id, contactId: payload.data.contact_id },
    });
  } catch {
    await forgetWebhookEvent(id);
    return retryLater("not_queued");
  }
  return Response.json({ received: true });
}
