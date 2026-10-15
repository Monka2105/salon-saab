import Link from "next/link";
import { AddStaff, StaffEditor } from "@/components/admin/StaffEditor";
import { prisma } from "@/lib/db";
import { minutesToTime, todayIn, WEEKDAYS } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { createTimeOff, deleteTimeOff, saveAvailability } from "../actions";

/** Horario semanal y bloqueos de cada estilista. Alimenta el motor de Smart Slots. */
export default async function AdminAvailabilityPage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const { terminology: terms, business, records } = tenant;

  const staffList = await prisma.staffMember.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialty: true },
  });
  const current = staffList.find((s) => s.id === params.staff) ?? staffList[0];

  if (!current) {
    return (
      <>
        <h1 className="headline">Disponibilidad</h1>
        <p className="text-[15px] text-ash">No hay {terms.staff.plural.toLowerCase()} activos.</p>
        <AddStaff label={terms.staff.singular} />
      </>
    );
  }

  const [availability, timeOff] = await Promise.all([
    prisma.availability.findMany({ where: { staffMemberId: current.id }, orderBy: { startMinutes: "asc" } }),
    prisma.timeOff.findMany({ where: { staffMemberId: current.id, endTime: { gt: new Date() } }, orderBy: { startTime: "asc" } }),
  ]);
  const usesBusinessHours = availability.length === 0;

  // Rango mostrado por día: el propio del estilista o, si no tiene, el del negocio.
  const rangeFor = (weekday: (typeof WEEKDAYS)[number]): [string, string] | null => {
    if (usesBusinessHours) {
      const range = records.openingHours[weekday]?.[0];
      return range ? [range[0], range[1]] : null;
    }
    const row = availability.find((a) => a.weekday === weekday);
    return row ? [minutesToTime(row.startMinutes), minutesToTime(row.endMinutes % 1440)] : null;
  };

  const dayName = new Intl.DateTimeFormat(business.locale, { weekday: "long", timeZone: "UTC" });
  const range = new Intl.DateTimeFormat(business.locale, { dateStyle: "medium", timeStyle: "short", timeZone: business.timezone });
  const today = todayIn(business.timezone);

  return (
    <>
      <header className="space-y-6">
        <h1 className="headline">Disponibilidad</h1>
        <nav className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          {staffList.map((s) => (
            <Link
              key={s.id}
              href={`/admin/availability?staff=${s.id}`}
              aria-current={s.id === current.id ? "page" : undefined}
              className={s.id === current.id ? "link-cta" : "btn-secondary border-transparent"}
            >
              {s.name}
            </Link>
          ))}
          {/* key: el formulario de alta se cierra al cambiar de estilista */}
          <AddStaff key={current.id} label={terms.staff.singular} />
        </nav>
        <div className="border-t border-stone pt-6">
          {/* key: al cambiar de pestaña se cierra la edición del estilista anterior */}
          <StaffEditor key={current.id} staff={current} label={terms.staff.singular} />
        </div>
      </header>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="space-y-3">
          <h2 className="font-serif text-[28px] leading-[1.1]">Horario semanal</h2>
          <p className="text-[15px] leading-[1.45] text-ash">
            {usesBusinessHours
              ? `${current.name} usa el horario del negocio. Guarda para darle uno propio.`
              : "Deja un día vacío si no trabaja. Si vacías todos, vuelve a usar el horario del negocio."}
          </p>
        </div>

        <form action={saveAvailability} className="space-y-6 bg-white p-6 sm:p-8">
          <input type="hidden" name="staffMemberId" value={current.id} />
          {/* key: el formulario no controlado se reinicia al cambiar de estilista */}
          <div key={current.id} className="space-y-4">
            {WEEKDAYS.map((weekday, i) => {
              const [start, end] = rangeFor(weekday) ?? ["", ""];
              return (
                <div key={weekday} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid-cols-[140px_auto_auto]">
                  <span className="micro-label first-letter:uppercase">{dayName.format(new Date(Date.UTC(2024, 0, 1 + i)))}</span>
                  <input type="time" name={`${weekday}-start`} defaultValue={start} step={300} aria-label="Apertura" className="input w-auto" />
                  <input type="time" name={`${weekday}-end`} defaultValue={end} step={300} aria-label="Cierre" className="input w-auto" />
                </div>
              );
            })}
          </div>
          <button className="btn-primary">Guardar horario</button>
        </form>
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <div className="space-y-3">
          <h2 className="font-serif text-[28px] leading-[1.1]">Bloqueos</h2>
          <p className="text-[15px] leading-[1.45] text-ash">
            Sin horas bloquea los días completos. Las {terms.record.plural.toLowerCase()} ya agendadas en el rango no se cancelan solas:
            revísalas en la agenda.
          </p>
        </div>

        <div className="space-y-10">
          <form action={createTimeOff} className="grid gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8">
            <input type="hidden" name="staffMemberId" value={current.id} />
            <label className="block space-y-2">
              <span className="micro-label block">Desde</span>
              <input type="date" name="fromDay" required min={today} className="input" />
            </label>
            <label className="block space-y-2">
              <span className="micro-label block">Hasta (opcional)</span>
              <input type="date" name="toDay" min={today} className="input" />
            </label>
            <label className="block space-y-2">
              <span className="micro-label block">Hora inicio (opcional)</span>
              <input type="time" name="fromTime" step={300} className="input" />
            </label>
            <label className="block space-y-2">
              <span className="micro-label block">Hora fin (opcional)</span>
              <input type="time" name="toTime" step={300} className="input" />
            </label>
            <input name="reason" maxLength={200} placeholder="Motivo (opcional)" className="input sm:col-span-2" />
            <div className="sm:col-span-2">
              <button className="btn-primary">Bloquear</button>
            </div>
          </form>

          <ul className="border-b border-stone">
            {timeOff.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-4 border-t border-stone py-5">
                <div>
                  <p className="text-[15px] tabular-nums">
                    {range.format(t.startTime)} — {range.format(t.endTime)}
                  </p>
                  {t.reason && <p className="micro-label mt-2 text-ash">{t.reason}</p>}
                </div>
                <form action={deleteTimeOff}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn-secondary">Quitar</button>
                </form>
              </li>
            ))}
            {!timeOff.length && <li className="border-t border-stone py-8 text-[15px] text-ash">Sin bloqueos próximos.</li>}
          </ul>
        </div>
      </section>
    </>
  );
}
