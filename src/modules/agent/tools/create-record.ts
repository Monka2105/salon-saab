import { zonedLocalToUtc } from "@/lib/format";
import { AppointmentError, createAppointment } from "@/modules/appointments/service";
import type { AgentTool } from "./types";

export interface CreateRecordArgs {
  serviceId: string;
  staffMemberId?: string;
  /** "YYYY-MM-DDTHH:mm" en la zona horaria del negocio. */
  date: string;
  notes?: string;
}

export const createRecord: AgentTool<CreateRecordArgs> = {
  name: "createRecord",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "createRecord",
      description: `Registra una nueva solicitud de tipo «${t.record.singular}». Úsala solo tras la confirmación explícita de la persona.`,
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string", description: `ID del ${t.item.singular.toLowerCase()} (el valor entre corchetes del catálogo).` },
          staffMemberId: { type: "string", description: `ID del ${t.staff.singular.toLowerCase()}; omítelo para "cualquiera".` },
          date: { type: "string", description: "Inicio en formato YYYY-MM-DDTHH:mm (zona horaria del negocio)." },
          notes: { type: "string", description: "Observaciones adicionales." },
        },
        required: ["serviceId", "date"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const startTime = zonedLocalToUtc(args.date, ctx.tenant.business.timezone);
    if (!startTime) return { ok: false, error: "INVALID_DATE" };

    try {
      const appt = await createAppointment({
        tenant: ctx.tenant,
        userId: ctx.customer.id, // siempre del contexto, nunca de la IA
        serviceId: args.serviceId,
        staffMemberId: args.staffMemberId ?? null,
        startTime,
        customerNotes: args.notes,
        source: "WHATSAPP",
      });
      return { ok: true, appointmentId: appt.id, status: appt.status };
    } catch (err) {
      if (err instanceof AppointmentError) return { ok: false, error: err.code };
      throw err;
    }
  },
};
