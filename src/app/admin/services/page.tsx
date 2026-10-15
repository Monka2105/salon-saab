import { ServiceFields } from "@/components/admin/ServiceFields";
import { ServiceList } from "@/components/admin/ServiceRow";
import { prisma } from "@/lib/db";
import { formatPrice, fromMinorUnits } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { createService } from "../actions";

export default async function AdminServicesPage() {
  const tenant = await getCurrentTenant();
  const { terminology: terms, business } = tenant;
  // Los servicios eliminados que tenían citas quedan archivados (active = false) y no se listan.
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <h1 className="headline">{terms.item.plural}</h1>

      <form action={createService} className="grid gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8">
        <ServiceFields currency={business.currency} />
        <div className="sm:col-span-2">
          <button className="btn-primary">Agregar</button>
        </div>
      </form>

      <ul className="border-b border-stone">
        <ServiceList
          currency={business.currency}
          services={services.map((s) => ({
            id: s.id,
            summary: `${s.durationMinutes} min · ${formatPrice(s.price, business)}`,
            defaults: {
              title: s.title,
              price: fromMinorUnits(s.price, business),
              description: s.description ?? "",
              durationMinutes: s.durationMinutes,
              sortOrder: s.sortOrder,
              imageUrl: s.imageUrl ?? "",
            },
          }))}
        />
        {!services.length && <li className="border-t border-stone py-10 text-[15px] text-ash">Catálogo vacío.</li>}
      </ul>
    </>
  );
}
