import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDaySlots, loadNextSlots } from "@/app/servicios/actions";
import { ServiceBooking } from "@/components/landing/ServiceBooking";
import { PublicShell } from "@/components/PublicShell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice, shiftDay, todayIn } from "@/lib/format";
import { MAX_SERVICES_PER_BOOKING } from "@/modules/appointments/service";
import { getCurrentTenant } from "@/lib/tenant";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ staff?: string; day?: string; slot?: string; extra?: string }>;

/** Días que se ofrecen en la tira de fechas. */
const DAYS_SHOWN = 21;

async function findService(id: string) {
  const tenant = await getCurrentTenant();
  const service = await prisma.service.findFirst({ where: { id, tenantId: tenant.id, active: true } });
  return { tenant, service };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { service } = await findService((await params).id);
  return { title: service?.title ?? "Servicio" };
}

/** Reserva de un servicio: estilista, fecha, horario y confirmación en la misma página. */
export default async function ServicePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getSessionUser()]);
  const { tenant, service } = await findService(id);
  if (!service) notFound();

  const { business, terminology: terms, records } = tenant;
  const staff = await prisma.staffMember.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialty: true, photoUrl: true },
  });

  // Servicios que se pueden añadir a la misma reserva (se hacen seguidos, con el mismo estilista).
  const otherServices = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true, id: { not: service.id } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, durationMinutes: true, price: true },
  });
  const extraIds = [...new Set((query.extra ?? "").split(","))]
    .filter((x) => otherServices.some((s) => s.id === x))
    .slice(0, MAX_SERVICES_PER_BOOKING - 1);
  const serviceIds = [service.id, ...extraIds];

  const today = todayIn(business.timezone);
  const days = Array.from({ length: Math.min(DAYS_SHOWN, records.maxDaysAhead + 1) }, (_, i) => shiftDay(today, i));

  // Selección de la URL (al volver del login) o, por defecto, el primer día con horarios libres.
  const staffId = staff.some((s) => s.id === query.staff) ? query.staff! : "any";
  const requestedDay = query.day && days.includes(query.day) ? query.day : null;
  let day = requestedDay ?? today;
  let initialSlots: string[];
  if (requestedDay) {
    initialSlots = await loadDaySlots(serviceIds, staffId, requestedDay);
  } else {
    const next = await loadNextSlots(serviceIds, staffId);
    day = next.day ?? today;
    initialSlots = next.slots;
  }

  const price = formatPrice(service.price, business);

  return (
    <PublicShell tenant={tenant}>
      {/* Un solo bloque: el espaciado grande de PublicShell entre secciones dejaría la reserva muy abajo. */}
      <div className="space-y-10">
        <section className="border-b border-stone pb-6">
          <Link href="/#servicios" className="micro-label text-ash hover:text-carbon">
            ← Todos los {terms.item.plural.toLowerCase()}
          </Link>
          <h1 className="mt-3 font-serif text-[30px] leading-[1.1] sm:text-[36px]">{service.title}</h1>
          <p className="micro-label mt-2 text-ash">
            {service.durationMinutes} minutos{price && <span className="text-ink"> · {price}</span>}
          </p>
          {service.description && <p className="mt-3 max-w-[560px] text-[15px] leading-[1.5]">{service.description}</p>}
        </section>

        <ServiceBooking
          mainService={{ id: service.id, title: service.title, durationMinutes: service.durationMinutes, price: service.price }}
          otherServices={otherServices}
          maxServices={MAX_SERVICES_PER_BOOKING}
          business={business}
          staff={staff}
          locale={business.locale}
          days={days}
          defaults={{ staffId, day, extraIds, slot: /^\d{2}:\d{2}$/.test(query.slot ?? "") ? query.slot! : null }}
          initialSlots={initialSlots}
          signedIn={Boolean(user)}
          path={`/servicios/${service.id}`}
          staffLabel={terms.staff.singular}
        />
      </div>
    </PublicShell>
  );
}
