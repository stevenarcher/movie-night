import { parseWebhook } from "@/whatsapp/parse";
import { ingestWhatsappMessages } from "@/whatsapp/ingest";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";

/**
 * Dev-only endpoint that feeds a Cloud-API-shaped payload through the exact
 * same pipeline as the real webhook. Lets you test parsing/validation/dedupe
 * without Meta credentials.
 *
 * Body shape: { "entry": [{ "changes": [{ "field": "messages", "value": { messages: [...], contacts: [...] } }] }] }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return unauthorized("Simulation is disabled in production");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    const messages = parseWebhook(payload as never);
    const result = await ingestWhatsappMessages(messages);
    return ok({ ok: true, submitted: messages.length, ...result });
  } catch (error) {
    console.error("[whatsapp] simulate failed", error);
    return serverError("Failed to process messages");
  }
}