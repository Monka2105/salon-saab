import { prisma } from "@/lib/db";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import type { AgentTool } from "./types";

export interface CheckAvailabilityArgs {
  /** Fecha "YYYY-MM-DD" en la zona horaria del negocio. */
  date: string;
  serviceId: string;
  staffMemberId?: string;
}

export const checkAvailability: AgentTool<CheckAvailabilityArgs> = {
  name: "checkAvailability",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "checkAvailability",
      description: `Consulta los ${t.slot.plural.toLowerCase()} disponibles en una fecha, opcionalmente para un elemento del catálogo de ${t.item.plural.toLowerCase()}.`,
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Fecha en formato YYYY-MM-DD (zona horaria del negocio)." },
          serviceId: { type: "string", description: `ID del ${t.item.singular.toLowerCase()} (el valor entre corchetes del catálogo).` },
          staffMemberId: { type: "string", description: `ID del ${t.staff.singular.toLowerCase()}; omítelo para "cualquiera".` },
        },
        required: ["date", "serviceId"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const { tenant } = ctx;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return { ok: false, error: "INVALID_DATE" };

    const service = await prisma.service.findFirst({ where: { id: args.serviceId, tenantId: tenant.id, active: true } });
    if (!service) return { ok: false, error: "SERVICE_NOT_FOUND" };

    const slots = await findAvailableSlots(prisma, {
      tenant,
      day: args.date,
      durationMinutes: service.durationMinutes,
      staffMemberId: args.staffMemberId ?? null,
    });
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return { ok: true, date: args.date, durationMinutes: service.durationMinutes, availableSlots: slots.map((s) => time.format(s.start)) };
  },
};
