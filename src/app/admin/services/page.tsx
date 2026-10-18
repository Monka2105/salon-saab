import { CategoryManager } from "@/components/admin/CategoryManager";
import { ServiceFields } from "@/components/admin/ServiceFields";
import { type ServiceGroup, ServiceList } from "@/components/admin/ServiceRow";
import { prisma } from "@/lib/db";
import { formatPrice, fromMinorUnits } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { createService } from "../actions";

export default async function AdminServicesPage() {
  const tenant = await getCurrentTenant();
  const { terminology: terms, business } = tenant;
  // Los servicios eliminados que tenían citas quedan archivados (active = false) y no se listan.
  const [services, categories, staff] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: { staffMembers: { where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.serviceCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.staffMember.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const items = services.map((s) => ({
    id: s.id,
    categoryId: s.categoryId,
    summary: [
      `${s.durationMinutes} min`,
      formatPrice(s.price, business),
      s.staffMembers.length > 0 && `Solo: ${s.staffMembers.map((m) => m.name).join(", ")}`,
    ]
      .filter(Boolean)
      .join(" · "),
    defaults: {
      title: s.title,
      price: fromMinorUnits(s.price, business),
      description: s.description ?? "",
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId ?? "",
      staffIds: s.staffMembers.map((m) => m.id),
    },
  }));
  const groups: ServiceGroup[] = [
    ...categories.map((c) => ({ id: c.id, name: c.name, services: items.filter((s) => s.categoryId === c.id) })),
    { id: null, name: "Sin categoría", services: items.filter((s) => !s.categoryId) },
  ].filter((g) => g.id || g.services.length);

  return (
    <>
      <h1 className="headline">{terms.item.plural}</h1>

      <CategoryManager categories={categories.map((c) => ({ ...c, serviceCount: items.filter((s) => s.categoryId === c.id).length }))} />

      <form action={createService} className="grid gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8">
        <ServiceFields currency={business.currency} categories={categories} staff={staff} />
        <div className="sm:col-span-2">
          <button className="btn-primary">Agregar</button>
        </div>
      </form>

      <div className="border-b border-stone">
        <ServiceList currency={business.currency} categories={categories} staff={staff} groups={groups} />
        {!services.length && <p className="border-t border-stone py-10 text-[15px] text-ash">Catálogo vacío.</p>}
      </div>
    </>
  );
}
