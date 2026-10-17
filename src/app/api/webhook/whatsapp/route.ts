import { after, type NextRequest, NextResponse } from "next/server";
import { handleInboundMessage } from "@/modules/agent/router";
import { extractInboundMessages } from "@/modules/whatsapp/parser";
import { verifyWebhookSignature } from "@/modules/whatsapp/signature";
import type { WebhookPayload } from "@/modules/whatsapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook de WhatsApp Cloud API → Concierge con IA.
//   GET  verificación de Meta (hub.challenge con WHATSAPP_VERIFY_TOKEN)
//   POST mensajes entrantes, firmados con X-Hub-Signature-256 (HMAC-SHA256 del cuerpo con WHATSAPP_APP_SECRET)
// Flujo: firma → parseo → 200 inmediato → (after) cliente + historial → IA + herramientas → respuesta por WhatsApp.

/** Verificación del webhook (Meta > WhatsApp > Configuration > Webhook). */
export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Recepción de eventos. Responde 200 de inmediato y procesa después (Meta exige respuesta rápida). */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    if (!verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[webhook] WHATSAPP_APP_SECRET es obligatorio en producción");
    return new NextResponse("Server misconfigured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const messages = extractInboundMessages(payload);
  if (messages.length) {
    after(async () => {
      const results = await Promise.allSettled(messages.map((m) => handleInboundMessage(m)));
      for (const r of results) if (r.status === "rejected") console.error("[webhook] handler failed", r.reason);
    });
  }

  return NextResponse.json({ received: true });
}
