import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTenantByPhoneNumberId } from "@/lib/tenant";
import { markAsRead, sendTextMessage } from "@/modules/whatsapp/client";
import type { InboundMessage } from "@/modules/whatsapp/types";
import { runAgent } from "./run-agent";

/** Canal por el que se responde a un mensaje concreto (Cloud API de Meta o WhatsApp Web vía Baileys). */
export interface ReplyTransport {
  sendText(text: string): Promise<void>;
  markAsRead(): Promise<void>;
}

function cloudApiTransport(msg: InboundMessage): ReplyTransport {
  return {
    sendText: (text) => sendTextMessage(msg.phoneNumberId, msg.from, text),
    markAsRead: () => markAsRead(msg.phoneNumberId, msg.waMessageId),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Ruta un mensaje entrante de WhatsApp: tenant → cliente → memoria → IA → respuesta.
 * Idempotente: Meta reintenta webhooks, y waMessageId es único en la tabla Message.
 */
export async function handleInboundMessage(
  msg: InboundMessage,
  transport: ReplyTransport = cloudApiTransport(msg),
): Promise<void> {
  const tenant = await getTenantByPhoneNumberId(msg.phoneNumberId);

  // Identidad por celular: si la persona verificó este número en la web, es su mismo perfil.
  // Si no existe, se crea un perfil "sombra" (no verificado) que se fusiona al verificar en /account.
  const customer = await prisma.user.upsert({
    where: { phoneNumber: msg.from },
    create: { phoneNumber: msg.from, name: msg.profileName ?? null },
    update: {},
  });

  try {
    await prisma.message.create({
      data: {
        userId: customer.id,
        role: "user",
        content: msg.text ?? `[${msg.type}]`,
        waMessageId: msg.waMessageId,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // reintento duplicado de Meta
    throw err;
  }

  transport.markAsRead().catch((err) => console.warn("[whatsapp] markAsRead failed", err));

  let reply: string;
  if (msg.text === null) {
    reply = tenant.agent.unsupportedMessage;
  } else {
    const recent = await prisma.message.findMany({
      where: { userId: customer.id },
      orderBy: { createdAt: "desc" },
      take: tenant.agent.historyLimit,
    });
    const history = recent.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      reply = await runAgent({ tenant, customer, history });
    } catch (err) {
      console.error("[agent] run failed", err);
      reply = tenant.agent.fallbackMessage;
    }
  }

  await prisma.message.create({ data: { userId: customer.id, role: "assistant", content: reply } });
  await transport.sendText(reply);
}
