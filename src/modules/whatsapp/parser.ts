import type { InboundMessage, WaMessage, WebhookPayload } from "./types";

function extractText(message: WaMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body ?? null;
    case "button":
      return message.button?.text ?? null;
    case "interactive": {
      const { button_reply, list_reply } = message.interactive ?? {};
      if (button_reply) return button_reply.title;
      // La descripción de la fila da contexto a la IA ("3:00 PM - Mateo" + servicio y día).
      if (list_reply) return list_reply.description ? `${list_reply.title} (${list_reply.description})` : list_reply.title;
      return null;
    }
    default:
      return null;
  }
}

/** Aplana el payload del webhook en mensajes entrantes (ignora estados de entrega/lectura). */
export function extractInboundMessages(payload: WebhookPayload): InboundMessage[] {
  if (payload.object !== "whatsapp_business_account") return [];

  return (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? [])
      .filter((change) => change.field === "messages")
      .flatMap(({ value }) =>
        (value.messages ?? []).map((message) => ({
          phoneNumberId: value.metadata.phone_number_id,
          from: message.from,
          waMessageId: message.id,
          profileName: value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name,
          type: message.type,
          text: extractText(message)?.trim() || null,
          replyId: message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id,
          timestamp: new Date(Number(message.timestamp) * 1000),
        })),
      ),
  );
}
