import { prisma } from "@/lib/db";
import { formatPrice, zonedLocalToUtc } from "@/lib/format";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import { dayLabel, requireRegistered, timeLabel, type AgentTool } from "./types";

export interface PrepareBookingArgs {
  serviceId: string;
  staffId?: string;
  /** "YYYY-MM-DDTHH:mm" en la zona horaria del negocio, tomado de checkAvailability. */
  startTime: string;
}

// Paso previo obligatorio a bookAppointment: comprueba que el horario sigue libre, fija el estilista
// y devuelve el resumen exacto que el sistema envía con los botones [Confirmar cita] [Cancelar].
// No reserva nada.
export const prepareBooking: AgentTool<PrepareBookingArgs> = {
  name: "prepareBooking",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "prepareBooking",
      description: `Prepara la ${t.record.singular.toLowerCase()} elegida y envía al cliente el resumen con botones para confirmar. Úsala cuando la persona elija un horario. No reserva.`,
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: `ID del ${t.item.singular.toLowerCase()}.` },
          staffId: { type: "string", description: `ID del ${t.staff.singular.toLowerCase()} de ese horario (de checkAvailability).` },
          startTime: { type: "string", description: "Inicio YYYY-MM-DDTHH:mm, tomado de checkAvailability." },
        },
        required: ["serviceId", "startTime"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const blocked = requireRegistered(ctx);
    if (blocked) return blocked;

    const { tenant } = ctx;
    const start = zonedLocalToUtc(args.startTime, tenant.business.timezone);
    if (!start) return { ok: false, error: "INVALID_DATE" };

    const service = await prisma.service.findFirst({ where: { id: args.serviceId, tenantId: tenant.id, active: true } });
    if (!service) return { ok: false, error: "SERVICE_NOT_FOUND" };

    const slots = await findAvailableSlots(prisma, {
      tenant,
      day: args.startTime.slice(0, 10),
      durationMinutes: service.durationMinutes,
      staffMemberId: args.staffId ?? null,
    });
    const slot = slots.find((s) => s.start.getTime() === start.getTime());
    if (!slot) return { ok: false, error: "SLOT_TAKEN" };

    const staffId = args.staffId ?? slot.staffMemberIds[0] ?? null;
    const staff = staffId ? await prisma.staffMember.findUnique({ where: { id: staffId }, select: { name: true } }) : null;

    return {
      ok: true,
      serviceId: service.id,
      service: service.title,
      staffId,
      staff: staff?.name ?? null,
      startTime: args.startTime,
      date: dayLabel(args.startTime, tenant.business.locale),
      time: timeLabel(args.startTime),
      price: formatPrice(service.price, tenant.business),
      awaitingConfirmation: true,
    };
  },
};
