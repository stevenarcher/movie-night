/**
 * Sends an announcement to the WhatsApp group via the Cloud API.
 * Only active when messaging credentials are configured.
 */
export async function sendGroupMessage(body: string): Promise<boolean> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;
  const groupId = process.env.WA_GROUP_ID;

  if (!phoneNumberId || !accessToken || !groupId) {
    console.warn("[whatsapp] sendGroupMessage skipped (messaging credentials not configured)");
    return false;
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "group",
      to: groupId,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    console.error("[whatsapp] sendGroupMessage failed", res.status, await res.text());
    return false;
  }
  return true;
}