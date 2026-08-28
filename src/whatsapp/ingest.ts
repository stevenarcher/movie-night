import { prisma } from "@/lib/prisma";
import { validateTitle } from "./validate";
import type { IngestResult, ParsedInboundMessage } from "./types";
import { MAX_POOL_SIZE } from "./validate";

/**
 * Writes parsed WhatsApp messages into the candidate pool.
 *
 * - Applies title validation (see validate.ts).
 * - Optionally restricts to a configured group via `WA_GROUP_ID`.
 * - Deduplicates on both normalized title and message id (idempotent ingest).
 */
export async function ingestWhatsappMessages(
  messages: ParsedInboundMessage[],
  opts: { groupId?: string } = {},
): Promise<IngestResult> {
  const activeGroup = opts.groupId ?? process.env.WA_GROUP_ID;
  const result: IngestResult = { results: [], created: 0, duplicates: 0, invalid: 0, unsupported: 0 };

  if (activeGroup) {
    messages = messages.filter((m) => m.groupId === activeGroup);
    result.unsupported += messages.filter((m) => m.groupId !== activeGroup).length;
  }

  if (messages.length === 0) return result;

  const poolSize = await prisma.candidate.count();

  for (const message of messages) {
    const validation = validateTitle(message.rawBody);

    if (!validation.ok) {
      result.invalid += 1;
      result.results.push({ status: "invalid", reason: validation.reason });
      continue;
    }

    if (poolSize + result.created >= MAX_POOL_SIZE) {
      result.invalid += 1;
      result.results.push({ status: "invalid", reason: "Pool is full." });
      continue;
    }

    const created = await prisma.candidate
      .create({
        data: {
          title: validation.title,
          normalizedTitle: validation.normalizedTitle,
          source: "WHATSAPP",
          senderName: message.senderName,
          senderWaid: message.senderWaid,
          messageId: message.messageId,
          groupId: message.groupId,
          createdAt: message.timestamp,
          metadata: { received: message.timestamp.toISOString() },
        },
      })
      .then((row) => row)
      .catch((error: unknown) => {
        const code = (error as { code?: string }).code;
        // P2002 = unique constraint violation (duplicate title or message id)
        if (code === "P2002") return null;
        throw error;
      });

    if (created) {
      result.created += 1;
      result.results.push({ status: "created", candidateId: created.id, title: validation.title });
    } else {
      result.duplicates += 1;
      result.results.push({ status: "duplicate" });
    }
  }

  return result;
}