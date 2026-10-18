import { prisma } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { ServiceBlock } from "./ServiceBlock";

interface Props {
  tenant: ResolvedTenant;
  /** Limita el número de servicios (p. ej. destacados en el inicio) */
  limit?: number;
}

/** Catálogo editorial por categoría: 1 → 2 → 3 columnas, bloques separados por aire y hairlines. */
export async function ServicesView({ tenant, limit }: Props) {
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { category: { select: { id: true, name: true, sortOrder: true } } },
    take: limit,
  });

  // Secciones en el orden de las categorías; los servicios sin categoría van al final.
  const groups: { key: string; name: string | null; order: number; services: typeof services }[] = [];
  for (const service of services) {
    const key = service.category?.id ?? "none";
    const group = groups.find((g) => g.key === key);
    if (group) group.services.push(service);
    else groups.push({ key, name: service.category?.name ?? null, order: service.category?.sortOrder ?? Infinity, services: [service] });
  }
  groups.sort((a, b) => a.order - b.order);
  // Sin categorías no hay títulos de sección: el catálogo se ve como siempre.
  const showHeadings = groups.some((g) => g.name);

  let index = 0;
  return services.length ? (
    <div className="space-y-20">
      {groups.map((g) => (
        <section key={g.key}>
          {showHeadings && <h2 className="micro-label mb-8 border-b border-stone pb-3">{g.name ?? "Otros"}</h2>}
          <div className="grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-x-14">
            {g.services.map((service) => (
              <ServiceBlock key={service.id} service={service} index={index++} tenant={tenant} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <p className="text-[15px] text-ash">Aún no hay {tenant.terminology.item.plural.toLowerCase()} publicados.</p>
  );
}
