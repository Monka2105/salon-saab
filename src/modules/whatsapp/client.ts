const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const MAX_TEXT_LENGTH = 4096;

async function graphPost(phoneNumberId: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN no está configurado");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  return res.json();
}

function chunk(text: string, size: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

export async function sendTextMessage(phoneNumberId: string, to: string, text: string): Promise<void> {
  for (const part of chunk(text, MAX_TEXT_LENGTH)) {
    await graphPost(phoneNumberId, { recipient_type: "individual", to, type: "text", text: { body: part } });
  }
}

/**
 * OTP por plantilla de autenticación (Meta exige plantilla para mensajes iniciados por el negocio).
 * Requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_OTP_TEMPLATE (plantilla "Authentication" con botón "Copiar código").
 */
export async function sendAuthTemplate(to: string, code: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  if (!phoneNumberId || !template) throw new Error("WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_OTP_TEMPLATE no configurados");

  await graphPost(phoneNumberId, {
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: process.env.WHATSAPP_OTP_TEMPLATE_LANG || "es" },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  });
}

export async function markAsRead(phoneNumberId: string, messageId: string): Promise<void> {
  await graphPost(phoneNumberId, { status: "read", message_id: messageId });
}
