import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import type { AgentTool } from "./types";

export const getAvailableServices: AgentTool<Record<string, never>> = {
  name: "getAvailableServices",

  definition: ({ terminology: t }) => ({
    type: "function",
    function: {
      name: "getAvailableServices",
      description: `Lista los ${t.item.plural.toLowerCase()} activos con su ID, precio, duración y descripción. Úsala antes de hablar de precios o de reservar.`,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  }),

  async handler(_args, { tenant }) {
    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, description: true, price: true, durationMinutes: true },
    });
    return {
      ok: true,
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: formatPrice(s.price, tenant.business),
        durationMinutes: s.durationMinutes,
      })),
    };
  },
};
