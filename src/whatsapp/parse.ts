import type {
  ParsedInboundMessage,
  WhatsappMessage,
  WhatsappWebhookPayload,
} from "./types";

const MESSAGE_MAX_AGE_MS = 30 * 60 * 1000;

/** Extract a group id from a message, wherever Meta tucks it. */
function groupIdOf(message: WhatsappMessage): string | undefined {
  return message.group_id ?? message.context?.group_id;
}

/**
 * Flattens a Cloud API webhook payload into inbound WhatsApp messages.
 * Only text messages originating from a group are returned.
 */
export function parseWebhook(payload: WhatsappWebhookPayload): ParsedInboundMessage[] {
  const parsed: ParsedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value || change.field !== "messages") continue;

      const contacts = value.contacts ?? [];

      for (const message of value.messages ?? []) {
        if (message.type !== "text" || !message.text?.body) continue;

        const groupId = groupIdOf(message);
        if (!groupId) continue; // ignore direct (non-group) messages

        if (message.errors?.length) continue; // unsupported/delivery errors

        const timestamp = Number(message.timestamp ?? 0) * 1000;
        if (!timestamp || Date.now() - timestamp > MESSAGE_MAX_AGE_MS) {
          continue; // drop stale redeliveries
        }

        const contact = contacts.find((c) => c.wa_id === message.from);
        const senderName = contact?.profile?.name ?? message.from ?? "Unknown";
        const messageId = message.id ?? "";
        if (!messageId) continue;

        parsed.push({
          messageId,
          groupId,
          senderWaid: message.from ?? "",
          senderName,
          rawBody: message.text.body,
          timestamp: new Date(timestamp),
        });
      }
    }
  }

  return parsed;
}