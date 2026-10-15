import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { ServicesView } from "@/components/services/ServicesView";
import { describeOpeningHours } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";

const FEATURED_COUNT = 3;

/**
 * Inicio dinámico: todo el texto, colores y terminología vienen de la configuración
 * del tenant (config/tenant.ts + overrides en BD). No hay contenido de nicho en el código.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();
  const { business, terminology: terms, records } = tenant;

  const hours = describeOpeningHours(records.openingHours, business.locale);
  const whatsappUrl = business.phone ? `https://wa.me/${business.phone}` : null;

  return (
    <PublicShell tenant={tenant}>
      <section className="max-w-[640px]">
        <p className="micro-label text-ash">{business.tagline}</p>
        <h1 className="headline mt-5 sm:text-[56px]">{business.name}</h1>
        {business.description && <p className="mt-6 max-w-[520px] text-lg leading-[1.35]">{business.description}</p>}
        <div className="mt-10 flex flex-wrap items-center gap-8">
          <Link href="/new" className="btn-primary">
            {terms.ctaPrimary}
          </Link>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="link-cta">
              Escríbenos por WhatsApp
            </a>
          )}
        </div>
      </section>

      <section className="space-y-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-serif text-[32px] leading-[1.1]">{terms.item.plural}</h2>
          <Link href="/catalog" className="link-cta">
            Ver todo
          </Link>
        </div>
        <ServicesView tenant={tenant} limit={FEATURED_COUNT} />
      </section>

      {(hours.length > 0 || business.address) && (
        <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <h2 className="font-serif text-[32px] leading-[1.1]">Visítanos</h2>
          <div className="grid gap-10 sm:grid-cols-2">
            {business.address && (
              <div>
                <p className="micro-label text-ash">Dirección</p>
                <p className="mt-3 font-serif text-xl leading-[1.3]">{business.address}</p>
              </div>
            )}
            {hours.length > 0 && (
              <div>
                <p className="micro-label text-ash">Horario</p>
                <ul className="mt-3 space-y-2 text-[15px]">
                  {hours.map(({ day, ranges }) => (
                    <li key={day} className="flex justify-between gap-4">
                      <span className="text-ash">{day}</span>
                      <span>{ranges}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
