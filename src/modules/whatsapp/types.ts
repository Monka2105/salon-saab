// Subconjunto tipado del payload de WhatsApp Cloud API que usa la plantilla.
// Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface WebhookPayload {
  object: string;
  entry?: WebhookEntry[];
}

interface WebhookEntry {
  id: string;
  changes?: WebhookChange[];
}

interface WebhookChange {
  field: string;
  value: WebhookValue;
}

interface WebhookValue {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile?: { name?: string }; wa_id: string }[];
  messages?: WaMessage[];
  statuses?: unknown[];
}

export interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string; payload: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

/** Mensaje entrante normalizado e independiente del formato de Meta. */
export interface InboundMessage {
  phoneNumberId: string;
  from: string;
  waMessageId: string;
  profileName?: string;
  type: string;
  /** null cuando el tipo no es soportado (audio, imagen…) */
  text: string | null;
  /** ID de la fila o botón pulsado en un mensaje interactivo (lo genera el servidor; no confíes en él a ciegas). */
  replyId?: string;
  timestamp: Date;
}

// ── Mensajes salientes interactivos ──────────────────────────
// Límites de Meta: lista ≤ 10 filas en total, título de fila ≤ 24, descripción ≤ 72, botón de lista ≤ 20;
// botones de respuesta ≤ 3 con título ≤ 20; cuerpo ≤ 1024. IDs ≤ 200 (filas) / 256 (botones).

export interface WaListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WaListSection {
  title?: string;
  rows: WaListRow[];
}

export interface WaReplyButton {
  id: string;
  title: string;
}

export type WaInteractive =
  | {
      type: "list";
      header?: { type: "text"; text: string };
      body: { text: string };
      footer?: { text: string };
      action: { button: string; sections: WaListSection[] };
    }
  | {
      type: "button";
      header?: { type: "text"; text: string };
      body: { text: string };
      footer?: { text: string };
      action: { buttons: { type: "reply"; reply: WaReplyButton }[] };
    };
