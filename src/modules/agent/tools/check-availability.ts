import { prisma } from "@/lib/db";
import { formatPrice, shiftDay, todayIn } from "@/lib/format";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import { toLocalString, type AgentTool } from "./types";

export interface CheckAvailabilityArgs {
  /** Fecha "YYYY-MM-DD" en la zona horaria del negocio; sin fecha = el primer día con horarios libres. */
  date?: string;
  serviceId: string;
  staffId?: string;
}

/** Cuántos días hacia adelante se buscan cuando la persona no dice fecha. */
const SEARCH_DAYS = 14;

export const checkAvailability: AgentTool<CheckAvailabilityArgs> = {
  name: "checkAvailability",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "checkAvailability",
      description: `Consulta los ${t.slot.plural.toLowerCase()} disponibles de un ${t.item.singular.toLowerCase()}, cada uno con el ${t.staff.singular.toLowerCase()} libre. El sistema los muestra como lista interactiva.`,
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Fecha YYYY-MM-DD (zona horaria del negocio). Omítela si la persona no dio fecha: se busca el primer día con horarios." },
          serviceId: { type: "string", description: `ID del ${t.item.singular.toLowerCase()} (del catálogo).` },
          staffId: { type: "string", description: `ID del ${t.staff.singular.toLowerCase()}; omítelo para buscar con todos.` },
        },
        required: ["serviceId"],
        additionalProperties: false,
      },
    },
  }),

  async handler(args, ctx) {
    const { tenant } = ctx;
    if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return { ok: false, error: "INVALID_DATE" };

    const service = await prisma.service.findFirst({ where: { id: args.serviceId, tenantId: tenant.id, active: true } });
    if (!service) return { ok: false, error: "SERVICE_NOT_FOUND" };

    const tz = tenant.business.timezone;
    const days = args.date
      ? [args.date]
      : Array.from({ length: Math.min(SEARCH_DAYS, tenant.records.maxDaysAhead + 1) }, (_, i) => shiftDay(todayIn(tz), i));

    let date = days[0];
    let slots: Awaited<ReturnType<typeof findAvailableSlots>> = [];
    for (date of days) {
      slots = await findAvailableSlots(prisma, { tenant, day: date, durationMinutes: service.durationMinutes, staffMemberId: args.staffId ?? null });
      if (slots.length) break;
    }

    const staffIds = [...new Set(slots.map((s) => s.staffMemberIds[0]).filter(Boolean))];
    const staff = await prisma.staffMember.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } });
    const names = new Map(staff.map((s) => [s.id, s.name]));

    return {
      ok: true,
      date,
      serviceId: service.id,
      service: service.title,
      price: formatPrice(service.price, tenant.business),
      durationMinutes: service.durationMinutes,
      // startTime en el mismo formato que esperan prepareBooking/bookAppointment: la IA lo copia tal cual.
      // Cada horario lleva el primer estilista libre (orden de asignación del motor).
      slots: slots.map((s) => ({
        startTime: toLocalString(s.start, tz).replace(" ", "T"),
        staffId: s.staffMemberIds[0] ?? null,
        staff: names.get(s.staffMemberIds[0]) ?? null,
      })),
    };
  },
};
