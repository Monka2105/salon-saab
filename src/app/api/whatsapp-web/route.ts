import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderAsText } from "@/modules/agent/reply";
import { handleInboundMessage } from "@/modules/agent/router";
import { bridgeAuthorized } from "@/modules/whatsapp/bridge-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Puente para el bot de WhatsApp Web (`npm run whatsapp` con WHATSAPP_BRIDGE_URL): el bot corre en
// otra máquina, pero el mensaje se procesa aquí, con la base de datos de esta app (servicios,
// estilistas y citas reales). Devuelve las respuestas como texto y el bot las envía.

const messageSchema = z.object({
  phoneNumberId: z.string().min(1).max(32),
  from: z.string().regex(/^\d{8,15}$/),
  waMessageId: z.string().min(1).max(128),
  profileName: z.string().max(100).optional(),
  type: z.string().max(40),
  text: z.string().max(4096).nullable(),
  timestamp: z.coerce.date(),
});

export async function POST(req: NextRequest) {
  const authorized = bridgeAuthorized(req.headers.get("authorization"));
  if (authorized === null) return new NextResponse("Bridge disabled", { status: 404 });
  if (!authorized) return new NextResponse("Unauthorized", { status: 401 });

  const parsed = messageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse("Invalid payload", { status: 400 });

  const replies: string[] = [];
  await handleInboundMessage(parsed.data, {
    send: async (reply) => {
      // WhatsApp Web (Baileys) no envía listas ni botones de forma fiable: van como texto con las opciones.
      replies.push(renderAsText(reply));
    },
    // El bot marca el mensaje como leído en su lado.
    markAsRead: async () => {},
  });

  return NextResponse.json({ replies });
}
