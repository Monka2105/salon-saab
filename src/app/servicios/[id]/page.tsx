import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDaySlots, loadNextSlots } from "@/app/servicios/actions";
import { ServiceBooking } from "@/components/landing/ServiceBooking";
import { PublicShell } from "@/components/PublicShell";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serviceStaffIds } from "@/modules/appointments/scheduling";
import { formatPrice, shiftDay, todayIn } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ staff?: string; day?: string; slot?: string }>;

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
  // Si el admin asignó estilistas al servicio, solo ellos se pueden elegir.
  const required = await serviceStaffIds(prisma, service.id);
  const staff = await prisma.staffMember.findMany({
    where: { tenantId: tenant.id, active: true, ...(required.length && { id: { in: required } }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialty: true, photoUrl: true },
  });
  const staffRequired = required.length > 0;

  const today = todayIn(business.timezone);
  const days = Array.from({ length: Math.min(DAYS_SHOWN, records.maxDaysAhead + 1) }, (_, i) => shiftDay(today, i));

  // Selección de la URL (al volver del login) o, por defecto, el primer día con horarios libres.
  const staffId = staff.some((s) => s.id === query.staff) ? query.staff! : staffRequired && staff.length === 1 ? staff[0].id : "any";
  const requestedDay = query.day && days.includes(query.day) ? query.day : null;
  let day = requestedDay ?? today;
  let initialSlots: string[];
  if (requestedDay) {
    initialSlots = await loadDaySlots(service.id, staffId, requestedDay);
  } else {
    const next = await loadNextSlots(service.id, staffId);
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
          serviceId={service.id}
          staff={staff}
          locale={business.locale}
          days={days}
          defaults={{ staffId, day, slot: /^\d{2}:\d{2}$/.test(query.slot ?? "") ? query.slot! : null }}
          initialSlots={initialSlots}
          signedIn={Boolean(user)}
          path={`/servicios/${service.id}`}
          staffLabel={terms.staff.singular}
          staffRequired={staffRequired}
        />
      </div>
    </PublicShell>
  );
}
