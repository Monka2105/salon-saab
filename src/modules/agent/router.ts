import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTenantByPhoneNumberId, type ResolvedTenant } from "@/lib/tenant";
import { publicUrl } from "@/lib/url";
import { markAsRead, sendInteractiveMessage, sendTextMessage } from "@/modules/whatsapp/client";
import type { InboundMessage } from "@/modules/whatsapp/types";
import {
  confirmationButtons,
  parseQuickReply,
  renderAsText,
  slotsList,
  textReply,
  toCloudMessages,
  type AgentReply,
  type SlotChoice,
} from "./reply";
import { runAgent } from "./run-agent";
import { executeTool } from "./tools";
import { dayLabel, timeLabel } from "./tools/types";

/** Canal por el que se responde a un mensaje concreto (Cloud API de Meta o WhatsApp Web vía Baileys). */
export interface ReplyTransport {
  send(reply: AgentReply): Promise<void>;
  markAsRead(): Promise<void>;
}

function cloudApiTransport(msg: InboundMessage): ReplyTransport {
  return {
    async send(reply) {
      for (const out of toCloudMessages(reply)) {
        if (out.type === "text") await sendTextMessage(msg.phoneNumberId, msg.from, out.text);
        else await sendInteractiveMessage(msg.phoneNumberId, msg.from, out.interactive);
      }
    },
    markAsRead: () => markAsRead(msg.phoneNumberId, msg.waMessageId),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Una conversación "nueva" (con saludo) si no hubo mensajes en estas horas. */
const CONVERSATION_GAP_MS = 6 * 60 * 60_000;

// ── Respuestas rápidas: toques en filas y botones ────────────
// Elegir un horario y pulsar "Confirmar cita" se resuelven sin IA: son deterministas, instantáneos
// y no pueden alterar los datos de la reserva. Todo se revalida en prepareBooking / createAppointment.

interface Ctx {
  tenant: ResolvedTenant;
  customer: User;
}

function registrationInvite(): AgentReply {
  const url = publicUrl("/login");
  return textReply(`Para reservar necesita registrarse con su celular${url ? ` en ${url}` : " en nuestra página web"}. Es un minuto.`);
}

/** Tras un SLOT_TAKEN: vuelve a ofrecer los horarios libres de ese día. */
async function offerOtherSlots(choice: SlotChoice, ctx: Ctx): Promise<AgentReply> {
  const result = await executeTool("checkAvailability", JSON.stringify({ serviceId: choice.serviceId, date: choice.startTime.slice(0, 10) }), ctx);
  const list = result.ok === true ? slotsList(result as never, "Ese horario acaba de ocuparse. Estos siguen libres:", ctx.tenant.business.locale) : null;
  return list ?? textReply("Ese horario acaba de ocuparse y no quedan otros ese día. ¿Le busco en otra fecha?");
}

async function prepare(choice: SlotChoice, ctx: Ctx): Promise<AgentReply> {
  const result = await executeTool("prepareBooking", JSON.stringify({ ...choice, staffId: choice.staffId ?? undefined }), ctx);
  if (result.ok === true) return confirmationButtons(result as never, ctx.tenant);
  if (result.error === "REGISTRATION_REQUIRED") return registrationInvite();
  if (result.error === "SLOT_TAKEN") return offerOtherSlots(choice, ctx);
  return textReply(ctx.tenant.agent.fallbackMessage);
}

async function book(choice: SlotChoice, ctx: Ctx): Promise<AgentReply> {
  const result = await executeTool("bookAppointment", JSON.stringify({ ...choice, staffId: choice.staffId ?? undefined }), ctx);
  if (result.ok !== true) {
    if (result.error === "REGISTRATION_REQUIRED") return registrationInvite();
    if (result.error === "SLOT_TAKEN" || result.error === "OUT_OF_RANGE") return offerOtherSlots(choice, ctx);
    return textReply(ctx.tenant.agent.fallbackMessage);
  }

  const { tenant, customer } = ctx;
  const lines = [
    "Su cita está agendada.",
    "",
    `${result.service}${result.staff ? ` con ${result.staff}` : ""}`,
    `${dayLabel(choice.startTime, tenant.business.locale)}, ${timeLabel(choice.startTime)}`,
    "",
    customer.noShowCount >= 2
      ? "Si le surge un imprevisto, por favor cancele por aquí para liberar el horario."
      : "Si necesita cancelarla, escríbame por aquí.",
  ];
  return textReply(lines.join("\n"));
}

/** Servicio elegido en la lista: horarios con todos los estilistas desde el primer día libre. */
async function showSlotsForService(serviceId: string, ctx: Ctx): Promise<AgentReply> {
  const result = await executeTool("checkAvailability", JSON.stringify({ serviceId }), ctx);
  if (result.ok !== true) return textReply(ctx.tenant.agent.fallbackMessage);
  const list = slotsList(result as never, `Horarios disponibles para ${result.service}:`, ctx.tenant.business.locale);
  return list ?? textReply(`No quedan horarios libres para ${result.service} en los próximos días. ¿Desea que le ayude con otro servicio?`);
}

/** null = no es un toque determinista; lo atiende la IA con el texto de la opción elegida. */
async function handleQuickReply(replyId: string | undefined, ctx: Ctx): Promise<AgentReply | null> {
  const quick = parseQuickReply(replyId);
  switch (quick?.action) {
    case "service":
      return showSlotsForService(quick.serviceId, ctx);
    case "slot":
      return prepare(quick.choice, ctx);
    case "book":
      return book(quick.choice, ctx);
    case "decline":
      // Resuelto aquí para que la IA no lo confunda con cancelar una cita existente.
      return textReply("Entendido, no he reservado nada. ¿Desea ver otro horario u otro servicio?");
    default:
      return null;
  }
}

/**
 * Ruta un mensaje entrante de WhatsApp: tenant → cliente → memoria → (respuesta rápida | IA) → respuesta.
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

  const previous = await prisma.message.findFirst({
    where: { userId: customer.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const newConversation = !previous || Date.now() - previous.createdAt.getTime() > CONVERSATION_GAP_MS;

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

  const ctx = { tenant, customer };
  let reply: AgentReply;
  try {
    if (msg.text === null) {
      reply = textReply(tenant.agent.unsupportedMessage);
    } else {
      const quick = await handleQuickReply(msg.replyId, ctx);
      if (quick) {
        reply = quick;
      } else {
        const recent = await prisma.message.findMany({
          where: { userId: customer.id },
          orderBy: { createdAt: "desc" },
          take: tenant.agent.historyLimit,
        });
        const history = recent.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        reply = await runAgent({ tenant, customer, history, newConversation });
      }
    }
  } catch (err) {
    console.error("[agent] run failed", err);
    reply = textReply(tenant.agent.fallbackMessage);
  }

  // El historial guarda la versión en texto (con las opciones listadas): es el contexto de la IA en el siguiente turno.
  await prisma.message.create({ data: { userId: customer.id, role: "assistant", content: renderAsText(reply) } });
  await transport.send(reply);
}
