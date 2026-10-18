import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bridgeAuthorized } from "@/modules/whatsapp/bridge-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cola de salida para el bot de WhatsApp Web: la app publicada no puede llamar al bot (corre en
// otra máquina), así que deja los mensajes (códigos OTP) en OutboundMessage y el bot los recoge.

export async function POST(req: NextRequest) {
  const authorized = bridgeAuthorized(req.headers.get("authorization"));
  if (authorized === null) return new NextResponse("Bridge disabled", { status: 404 });
  if (!authorized) return new NextResponse("Unauthorized", { status: 401 });

  // Recoger y borrar en una sola sentencia: si dos bots consultan a la vez, cada mensaje sale una vez.
  // Los vencidos también se borran, pero no se envían.
  const rows = await prisma.$queryRaw<{ to: string; text: string; expiresAt: Date }[]>`
    DELETE FROM "OutboundMessage" RETURNING "to", "text", "expiresAt"`;
  const now = Date.now();
  const messages = rows.filter((m) => m.expiresAt.getTime() > now).map(({ to, text }) => ({ to, text }));

  return NextResponse.json({ messages });
}
