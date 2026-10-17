import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { ConfirmService } from "@/components/staff/ConfirmService";
import { ServiceBreakdown } from "@/components/stats/ServiceBreakdown";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayIn, zonedMonthRange } from "@/lib/format";
import { customerLabel } from "@/lib/phone";
import { getCurrentTenant } from "@/lib/tenant";
import { clientsServedBy, notesByService, servicesByType, staffTotals } from "@/modules/appointments/stats";
import { BLOCKING_STATUSES } from "@/modules/appointments/status";
import { confirmServiceDone } from "./actions";

export const metadata: Metadata = { title: "Mi agenda", robots: { index: false } };

/** Panel del estilista: confirma lo que ya atendió, ve lo que viene y su historial de clientes. */
export default async function StaffPage() {
  const tenant = await getCurrentTenant();
  const { staff } = await requireStaff(tenant.id);
  const { business, terminology: terms } = tenant;
  const now = new Date();
  const month = zonedMonthRange(todayIn(business.timezone).slice(0, 7), business.timezone);

  const mine = { tenantId: tenant.id, staffMemberId: staff.id };
  const include = { user: { select: { name: true, phoneNumber: true } }, service: { select: { title: true } } };
  const [toConfirm, upcoming, monthTotals, allTotals, clients, typesMonth, typesTotal, notes] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...mine, status: { in: BLOCKING_STATUSES }, startTime: { lte: now } },
      include,
      orderBy: { startTime: "desc" },
      take: 50,
    }),
    prisma.appointment.findMany({
      where: { ...mine, status: { in: BLOCKING_STATUSES }, startTime: { gt: now } },
      include,
      orderBy: { startTime: "asc" },
      take: 30,
    }),
    staffTotals(tenant.id, staff.id, month),
    staffTotals(tenant.id, staff.id),
    clientsServedBy(tenant.id, staff.id),
    servicesByType(tenant.id, staff.id, month),
    servicesByType(tenant.id, staff.id),
    notesByService(tenant.id, staff.id),
  ]);

  const when = new Intl.DateTimeFormat(business.locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: business.timezone });
  const date = new Intl.DateTimeFormat(business.locale, { dateStyle: "medium", timeZone: business.timezone });

  return (
    <PublicShell tenant={tenant}>
      <header>
        <p className="micro-label text-ash">Mi agenda</p>
        <h1 className="headline mt-5">{staff.name}</h1>
      </header>

      <section className="grid gap-6 sm:grid-cols-3">
        <Figure label="Servicios este mes" value={monthTotals.completed} />
        <Figure label="Servicios en total" value={allTotals.completed} />
        <Figure label={`${terms.customer.plural} atendidos`} value={allTotals.clients} />
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="space-y-3">
          <h2 className="font-serif text-[32px] leading-[1.1]">Por confirmar</h2>
          <p className="text-[15px] leading-[1.45] text-ash">
            {terms.record.plural} que ya empezaron. Confírmalas cuando termines: así quedan en tu historial.
          </p>
        </div>
        {toConfirm.length ? (
          <ul className="space-y-6">
            {toConfirm.map((a) => (
              <li key={a.id} className="flex flex-col gap-6 bg-white p-6 sm:p-8">
                <div>
                  <p className="micro-label text-ash first-letter:uppercase">{when.format(a.startTime)}</p>
                  <p className="mt-3 font-serif text-2xl leading-[1.15]">{customerLabel(a.user)}</p>
                  <p className="micro-label mt-2 text-ash">{a.service.title}</p>
                  {a.customerNotes && <p className="mt-3 text-[15px] text-ash">“{a.customerNotes}”</p>}
                </div>
                <ConfirmService id={a.id} action={confirmServiceDone} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ash">Nada pendiente de confirmar.</p>
        )}
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <h2 className="font-serif text-[32px] leading-[1.1]">Próximas</h2>
        {upcoming.length ? (
          <ul className="border-b border-stone">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-4 border-t border-stone py-5">
                <div>
                  <p className="text-lg">{customerLabel(a.user)}</p>
                  <p className="micro-label mt-1 text-ash">{a.service.title}</p>
                </div>
                <p className="text-[15px] tabular-nums first-letter:uppercase">{when.format(a.startTime)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ash">Sin {terms.record.plural.toLowerCase()} próximas.</p>
        )}
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="space-y-3">
          <h2 className="font-serif text-[32px] leading-[1.1]">Por servicio</h2>
          <p className="text-[15px] leading-[1.45] text-ash">Cuántas veces hiciste cada servicio, este mes y desde siempre, con tus últimas notas de cada uno.</p>
        </div>
        <ServiceBreakdown month={typesMonth} total={typesTotal} notes={notes} locale={business.locale} timeZone={business.timezone} />
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <h2 className="font-serif text-[32px] leading-[1.1]">Mis {terms.customer.plural.toLowerCase()}</h2>
        {clients.length ? (
          <ul className="border-b border-stone">
            {clients.map((c) => (
              <li key={c.userId} className="flex flex-wrap items-baseline justify-between gap-4 border-t border-stone py-5">
                <p className="text-lg">{customerLabel(c)}</p>
                <p className="micro-label text-ash">
                  {c.services} {c.services === 1 ? "servicio" : "servicios"}
                  {c.lastVisit && ` · última vez ${date.format(c.lastVisit)}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ash">Aún no hay servicios confirmados.</p>
        )}
      </section>
    </PublicShell>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-6 sm:p-8">
      <p className="micro-label text-ash">{label}</p>
      <p className="mt-4 font-serif text-[48px] leading-none tabular-nums">{value}</p>
    </div>
  );
}
