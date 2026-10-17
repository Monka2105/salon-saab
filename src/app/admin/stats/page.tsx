import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftMonth, todayIn, zonedMonthRange } from "@/lib/format";
import { CompletedServiceList } from "@/components/stats/CompletedServiceList";
import { ServiceBreakdown } from "@/components/stats/ServiceBreakdown";
import { customerLabel } from "@/lib/phone";
import { getCurrentTenant } from "@/lib/tenant";
import { clientsServedBy, completedByStaff, completedServices, servicesByType } from "@/modules/appointments/stats";

/** Servicios realizados por estilista (mes y total) y clientes atendidos por cada uno. */
export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<{ month?: string; staff?: string }> }) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const { business, terminology: terms } = tenant;
  const thisMonth = todayIn(business.timezone).slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? params.month! : thisMonth;

  // Incluye estilistas archivados: su historial sigue contando.
  const period = zonedMonthRange(month, business.timezone);
  const [staff, monthly, allTime] = await Promise.all([
    prisma.staffMember.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    completedByStaff(tenant.id, period),
    completedByStaff(tenant.id),
  ]);
  const rows = staff.filter((s) => s.active || allTime.has(s.id));
  const sum = (m: typeof monthly) => [...m.values()].reduce((n, t) => n + t.completed, 0);

  const selected = rows.find((s) => s.id === params.staff);
  const [clients, typesMonth, typesTotal, monthLog] = selected
    ? await Promise.all([
        clientsServedBy(tenant.id, selected.id),
        servicesByType(tenant.id, selected.id, period),
        servicesByType(tenant.id, selected.id),
        completedServices(tenant.id, selected.id, period),
      ])
    : [[], [], [], []];

  const monthTitle = new Intl.DateTimeFormat(business.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
  const date = new Intl.DateTimeFormat(business.locale, { dateStyle: "medium", timeZone: business.timezone });
  const href = (m: string, staffId = selected?.id) => `/admin/stats?month=${m}${staffId ? `&staff=${staffId}` : ""}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="micro-label text-ash">Rendimiento</p>
          <h1 className="headline mt-4 first-letter:uppercase">{monthTitle}</h1>
        </div>
        <nav className="flex gap-6">
          <Link href={href(shiftMonth(month, -1))} className="btn-secondary">
            Anterior
          </Link>
          <Link href={href(thisMonth)} className="btn-secondary">
            Este mes
          </Link>
          <Link href={href(shiftMonth(month, 1))} className="btn-secondary">
            Siguiente
          </Link>
        </nav>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Figure label="Servicios realizados en el mes" value={sum(monthly)} />
        <Figure label="Servicios realizados en total" value={sum(allTime)} />
      </section>

      <section className="space-y-4">
        <div className="micro-label hidden grid-cols-[1fr_90px_90px_110px_150px] gap-6 text-ash sm:grid">
          <span>{terms.staff.singular}</span>
          <span className="text-right">Mes</span>
          <span className="text-right">Total</span>
          <span className="text-right">{terms.customer.plural}</span>
          <span />
        </div>
        <ul className="border-b border-stone">
          {rows.map((s) => {
            const total = allTime.get(s.id);
            const isSelected = s.id === selected?.id;
            return (
              <li
                key={s.id}
                className="grid grid-cols-3 items-baseline gap-x-6 gap-y-2 border-t border-stone py-5 sm:grid-cols-[1fr_90px_90px_110px_150px]"
              >
                <p className="col-span-3 font-serif text-xl sm:col-span-1">
                  {s.name}
                  {!s.active && <span className="micro-label ml-3 text-ash">Archivado</span>}
                </p>
                <Cell label="Mes" value={monthly.get(s.id)?.completed ?? 0} />
                <Cell label="Total" value={total?.completed ?? 0} />
                <Cell label={terms.customer.plural} value={total?.clients ?? 0} />
                <Link
                  href={isSelected ? `/admin/stats?month=${month}` : href(month, s.id)}
                  scroll={false}
                  className={`col-span-3 sm:col-span-1 sm:justify-self-end ${isSelected ? "link-cta" : "btn-secondary"}`}
                >
                  {isSelected ? "Ocultar" : "Ver detalle"}
                </Link>
              </li>
            );
          })}
          {allTime.has(null) && (
            <li className="border-t border-stone py-5 text-[15px] text-ash">
              Sin {terms.staff.singular.toLowerCase()} asignado: {allTime.get(null)!.completed} servicios en total.
            </li>
          )}
          {!rows.length && (
            <li className="border-t border-stone py-10 text-[15px] text-ash">Aún no hay {terms.staff.plural.toLowerCase()}.</li>
          )}
        </ul>
      </section>

      {selected && (
        <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <div className="space-y-3">
            <p className="micro-label text-ash">{selected.name}</p>
            <h2 className="font-serif text-[28px] leading-[1.1]">Servicios realizados</h2>
            <p className="text-[15px] leading-[1.45] text-ash">Cuántas veces hizo cada servicio este mes y desde siempre.</p>
          </div>
          <ServiceBreakdown month={typesMonth} total={typesTotal} />
        </section>
      )}

      {selected && (
        <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <div className="space-y-3">
            <h2 className="font-serif text-[28px] leading-[1.1] first-letter:uppercase">Registro de {monthTitle}</h2>
            <p className="text-[15px] leading-[1.45] text-ash">Cada servicio confirmado, con su {terms.customer.singular.toLowerCase()} y notas.</p>
          </div>
          <CompletedServiceList
            services={monthLog}
            locale={business.locale}
            timeZone={business.timezone}
            empty="No confirmó servicios en este mes."
            showConfirmedBy
          />
        </section>
      )}

      {selected && (
        <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
          <h2 className="font-serif text-[28px] leading-[1.1]">
            {terms.customer.plural} atendidos
          </h2>
          {clients.length ? (
            <ul className="border-b border-stone">
              {clients.map((c) => (
                <li key={c.userId} className="flex flex-wrap items-baseline justify-between gap-4 border-t border-stone py-5">
                  <div>
                    <p className="text-lg">{customerLabel(c)}</p>
                    {c.email && <p className="mt-1 text-[13px] text-ash">{c.email}</p>}
                  </div>
                  <p className="micro-label text-ash">
                    {c.services} {c.services === 1 ? "servicio" : "servicios"}
                    {c.lastVisit && ` · última vez ${date.format(c.lastVisit)}`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ash">Aún no tiene servicios confirmados.</p>
          )}
        </section>
      )}
    </>
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

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-[15px] tabular-nums sm:text-right">
      <span className="micro-label mr-2 text-ash sm:hidden">{label}</span>
      {value}
    </p>
  );
}
