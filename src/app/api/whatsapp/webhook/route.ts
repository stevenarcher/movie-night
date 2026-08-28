import { parseWebhook } from "@/whatsapp/parse";
import { verifySignature } from "@/whatsapp/signature";
import { ingestWhatsappMessages } from "@/whatsapp/ingest";
import { badRequest, ok, serverError } from "@/lib/api";

/**
 * GET: Meta's webhook verification handshake.
 * Returns the raw `hub.challenge` value when `hub.verify_token` matches.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const configuredToken = process.env.WA_WEBHOOK_VERIFY_TOKEN;
  if (!configuredToken) {
    return ok({ ok: false, reason: "Webhook verify token is not configured. Set WA_WEBHOOK_VERIFY_TOKEN." });
  }

  if (mode === "subscribe" && token === configuredToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return badRequest("Invalid webhook verification");
}

/**
 * POST: receive Cloud API message webhooks, validate, dedupe, and add
 * movie-title suggestions to the candidate pool.
 */
export async function POST(request: Request) {
  if (!process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    return ok({ ok: false, reason: "Webhook not configured (WA_WEBHOOK_VERIFY_TOKEN missing)." });
  }

  const rawBody = await request.text();

  // Verify signature if an app secret is configured. In local development with no
  // secret set we accept unauthenticated payloads so the simulate endpoint works,
  // but production deployments MUST set WA_APP_SECRET.
  const appSecret = process.env.WA_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, appSecret)) {
      return badRequest("Invalid signature");
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return badRequest("Invalid JSON body");
  }

  const messages = parseWebhook(payload as never);
  if (messages.length === 0) {
    // Status updates & non-group messages are expected traffic — ACK quietly.
    return ok({ ok: true, created: 0 });
  }

  try {
    const result = await ingestWhatsappMessages(messages);
    return ok({ ok: true, ...result, submitted: messages.length });
  } catch (error) {
    console.error("[whatsapp] webhook ingest failed", error);
    return serverError("Failed to process messages");
  }
}