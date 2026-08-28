/** Minimal typed views of the Meta WhatsApp Cloud API webhook payload. */

export interface WhatsappWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: WhatsappMessage[];
      };
      field?: string;
    }>;
  }>;
}

export interface WhatsappMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  /** Present on group-message webhooks (and used as group filter). */
  group_id?: string;
  context?: {
    /** Fallback location for group identifiers on some message types. */
    group_id?: string;
    id?: string;
  };
  text?: { body?: string };
  errors?: Array<{ code?: number; title?: string }>;
}

/** A message that survived parsing, ready to be validated. */
export interface ParsedInboundMessage {
  messageId: string;
  groupId: string;
  senderWaid: string;
  senderName: string;
  rawBody: string;
  timestamp: Date;
}

export type IngestOutcome =
  | { status: "created"; candidateId: string; title: string }
  | { status: "duplicate" }
  | { status: "invalid"; reason: string }
  | { status: "unsupported" };

export interface IngestResult {
  results: IngestOutcome[];
  created: number;
  duplicates: number;
  invalid: number;
  unsupported: number;
}