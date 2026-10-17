import { AppointmentError, cancelOwnAppointment } from "@/modules/appointments/service";
import { requireRegistered, type AgentTool } from "./types";

export interface CancelAppointmentArgs {
  appointmentId: string;
}

export const cancelAppointment: AgentTool<CancelAppointmentArgs> = {
  name: "cancelAppointment",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "cancelAppointment",
      description: `Cancela una ${t.record.singular.toLowerCase()} futura de la persona que escribe y libera ese horario. Úsala solo tras su confirmación explícita.`,
      parameters: {
        type: "object",
        properties: {
          appointmentId: { type: "string", description: "ID de la cita (de getMyAppointments)." },
        },
        required: ["appointmentId"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const blocked = requireRegistered(ctx);
    if (blocked) return blocked;

    try {
      // Filtra por ctx.customer.id: un ID de otra persona simplemente no se encuentra.
      await cancelOwnAppointment(ctx.tenant.id, ctx.customer.id, String(args.appointmentId));
      return { ok: true, appointmentId: args.appointmentId, status: "CANCELLED" };
    } catch (err) {
      if (err instanceof AppointmentError) return { ok: false, error: "NOT_CANCELLABLE" };
      throw err;
    }
  },
};
