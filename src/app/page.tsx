import { ServiceCatalog } from "@/components/landing/ServiceCatalog";
import { PublicShell } from "@/components/PublicShell";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";

/**
 * Inicio dinámico: todo el texto, colores y terminología vienen de la configuración
 * del tenant (config/tenant.ts + overrides en BD). No hay contenido de nicho en el código.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();
  const { business, terminology: terms } = tenant;

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.serviceCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const whatsappUrl = business.phone ? `https://wa.me/${business.phone}` : null;

  const whatsappBand = whatsappUrl && (
    <section className="bg-graphite px-4 py-14 text-center text-cream">
      <p className="mx-auto max-w-[560px] text-[17px] leading-[1.45]">
        ¿Prefieres asistencia directa? Nuestro asistente en WhatsApp puede agendar o cancelar tu cita en segundos.
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="micro-label mt-6 inline-block border-b border-cream pb-1 transition-opacity hover:opacity-70"
      >
        Hablar por WhatsApp
      </a>
    </section>
  );

  return (
    <PublicShell tenant={tenant} after={whatsappBand}>
      <ServiceCatalog
        services={services.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: formatPrice(s.price, business),
          categoryId: s.categoryId,
        }))}
        categories={categories}
        title={`Nuestros ${terms.item.plural}`}
      />
    </PublicShell>
  );
}
