import { prisma } from "@/lib/db";
import { zonedLocalToUtc } from "@/lib/format";
import { AppointmentError, createAppointment } from "@/modules/appointments/service";
import { requireRegistered, toLocalString, type AgentTool } from "./types";

export interface BookAppointmentArgs {
  serviceId: string;
  staffId?: string;
  /** "YYYY-MM-DDTHH:mm" en la zona horaria del negocio; debe ser uno de los horarios de checkAvailability. */
  startTime: string;
  notes?: string;
}

// El cliente y la hora de fin NO son argumentos: el cliente es quien escribe (ctx.customer)
// y endTime = startTime + duración del servicio. La IA nunca decide a nombre de quién reserva.
export const bookAppointment: AgentTool<BookAppointmentArgs> = {
  name: "bookAppointment",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "bookAppointment",
      description: `Reserva una ${t.record.singular.toLowerCase()} para la persona que escribe. Úsala solo si confirma por texto el resumen que ya le enviaste con prepareBooking, con esos mismos datos.`,
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: `ID del ${t.item.singular.toLowerCase()} (de getAvailableServices).` },
          staffId: { type: "string", description: `ID del ${t.staff.singular.toLowerCase()}, el mismo de prepareBooking.` },
          startTime: { type: "string", description: "Inicio YYYY-MM-DDTHH:mm (zona horaria del negocio), el mismo de prepareBooking." },
          notes: { type: "string", description: "Observaciones de la persona (opcional)." },
        },
        required: ["serviceId", "startTime"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const blocked = requireRegistered(ctx);
    if (blocked) return blocked;

    const tz = ctx.tenant.business.timezone;
    const startTime = zonedLocalToUtc(args.startTime, tz);
    if (!startTime) return { ok: false, error: "INVALID_DATE" };

    try {
      const appt = await createAppointment({
        tenant: ctx.tenant,
        userId: ctx.customer.id,
        serviceId: args.serviceId,
        staffMemberId: args.staffId ?? null,
        startTime,
        customerNotes: args.notes?.slice(0, 500),
        source: "WHATSAPP",
      });
      const details = await prisma.appointment.findUniqueOrThrow({
        where: { id: appt.id },
        select: { service: { select: { title: true } }, staffMember: { select: { name: true } } },
      });
      return {
        ok: true,
        appointmentId: appt.id,
        status: appt.status,
        service: details.service.title,
        staff: details.staffMember?.name ?? null,
        startTime: toLocalString(appt.startTime, tz),
        endTime: toLocalString(appt.endTime, tz),
      };
    } catch (err) {
      if (err instanceof AppointmentError) return { ok: false, error: err.code };
      throw err;
    }
  },
};
