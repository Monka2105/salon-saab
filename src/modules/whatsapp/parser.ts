import type { InboundMessage, WaMessage, WebhookPayload } from "./types";

function extractText(message: WaMessage): string | null {
  switch (message.type) {
    case "text":
      return message.text?.body ?? null;
    case "button":
      return message.button?.text ?? null;
    case "interactive":
      return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null;
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
          timestamp: new Date(Number(message.timestamp) * 1000),
        })),
      ),
  );
}
