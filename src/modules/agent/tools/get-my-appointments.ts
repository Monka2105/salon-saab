import { prisma } from "@/lib/db";
import { BLOCKING_STATUSES, CUSTOMER_CANCELLABLE } from "@/modules/appointments/status";
import { requireRegistered, toLocalString, type AgentTool } from "./types";

export const getMyAppointments: AgentTool<Record<string, never>> = {
  name: "getMyAppointments",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "getMyAppointments",
      description: `Lista las ${t.record.plural.toLowerCase()} futuras de la persona que escribe (con su ID). Úsala antes de cancelar.`,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  }),

  async handler(_args, ctx) {
    const blocked = requireRegistered(ctx);
    if (blocked) return blocked;

    const tz = ctx.tenant.business.timezone;
    const now = new Date();
    const appointments = await prisma.appointment.findMany({
      where: { tenantId: ctx.tenant.id, userId: ctx.customer.id, status: { in: BLOCKING_STATUSES }, endTime: { gt: now } },
      orderBy: { startTime: "asc" },
      take: 10,
      select: {
        id: true,
        status: true,
        startTime: true,
        service: { select: { title: true } },
        staffMember: { select: { name: true } },
      },
    });

    return {
      ok: true,
      appointments: appointments.map((a) => ({
        id: a.id,
        service: a.service.title,
        staff: a.staffMember?.name ?? null,
        startTime: toLocalString(a.startTime, tz),
        status: ctx.tenant.terminology.statusLabels[a.status],
        cancellable: CUSTOMER_CANCELLABLE.includes(a.status) && a.startTime > now,
      })),
    };
  },
};
