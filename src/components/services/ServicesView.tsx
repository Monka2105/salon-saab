import { prisma } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { ServiceBlock } from "./ServiceBlock";

interface Props {
  tenant: ResolvedTenant;
  /** Limita el número de servicios (p. ej. destacados en el inicio) */
  limit?: number;
}

/** Catálogo editorial: 1 → 2 → 3 columnas, bloques separados por aire y hairlines. */
export async function ServicesView({ tenant, limit }: Props) {
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: limit,
  });

  return services.length ? (
    <div className="grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-14">
      {services.map((service, i) => (
        <ServiceBlock key={service.id} service={service} index={i} tenant={tenant} />
      ))}
    </div>
  ) : (
    <p className="text-[15px] text-ash">Aún no hay {tenant.terminology.item.plural.toLowerCase()} publicados.</p>
  );
}
