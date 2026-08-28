import { describe, expect, it } from "vitest";
import { parseWebhook } from "./parse";
import type { WhatsappWebhookPayload } from "./types";

function groupTextMessage(opts: {
  body: string;
  from?: string;
  id?: string;
  timestampSeconds?: number;
  groupId?: string;
  senderName?: string;
}): WhatsappWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [
                { profile: { name: opts.senderName ?? "Dana" }, wa_id: opts.from ?? "15550000001" },
              ],
              messages: [
                {
                  from: opts.from ?? "15550000001",
                  id: opts.id ?? "wamid.abc",
                  timestamp: String(opts.timestampSeconds ?? Math.floor(Date.now() / 1000)),
                  type: "text",
                  group_id: opts.groupId ?? "1203630group",
                  text: { body: opts.body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("parseWebhook", () => {
  it("extracts a group text message with sender metadata", () => {
    const payload = groupTextMessage({ body: "Inception", senderName: "Dana" });
    const messages = parseWebhook(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      rawBody: "Inception",
      senderName: "Dana",
      senderWaid: "15550000001",
      groupId: "1203630group",
      messageId: "wamid.abc",
    });
  });

  it("ignores non-text messages and direct (non-group) messages", () => {
    const payload: WhatsappWebhookPayload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  { type: "image", id: "m1", text: { body: "poster.jpg" } },
                  { type: "text", id: "m2", from: "1555", text: { body: "hi" } }, // no group_id
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseWebhook(payload)).toHaveLength(0);
  });

  it("falls back to context.group_id for group identification", () => {
    const payload: WhatsappWebhookPayload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    type: "text",
                    id: "m3",
                    from: "1555",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    context: { group_id: "1203630ctx" },
                    text: { body: "Knives Out" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const messages = parseWebhook(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].groupId).toBe("1203630ctx");
  });

  it("drops stale redelivered messages", () => {
    const payload = groupTextMessage({
      body: "ancient",
      timestampSeconds: Math.floor(Date.now() / 1000) - 60 * 60, // 1h old
    });
    expect(parseWebhook(payload)).toHaveLength(0);
  });

  it("drops messages marked with errors", () => {
    const payload: WhatsappWebhookPayload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    type: "text",
                    id: "m4",
                    from: "1555",
                    group_id: "g",
                    errors: [{ code: 130501, title: "Unsupported" }],
                    text: { body: "Inception" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseWebhook(payload)).toHaveLength(0);
  });

  it("handles batched entries", () => {
    const first = groupTextMessage({ body: "Dune", id: "wamid.1", from: "15550000001" });
    const second = groupTextMessage({ body: "Her", id: "wamid.2", from: "15550000002" });
    const payload: WhatsappWebhookPayload = {
      entry: [
        ...(first.entry ?? []),
        ...(second.entry ?? []),
      ],
    };
    expect(parseWebhook(payload)).toHaveLength(2);
  });
});