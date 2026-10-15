import Link from "next/link";
import { prisma } from "@/lib/db";
import { shiftDay, todayIn, zonedLocalToUtc } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { getCurrentTenant } from "@/lib/tenant";
import { MANUAL_TRANSITIONS } from "@/modules/appointments/status";
import { markAppointmentNoShow, updateAppointmentStatus } from "./actions";

/** Agenda del día: la vista de trabajo del salón. */
export default async function AdminDayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [tenant, params] = await Promise.all([getCurrentTenant(), searchParams]);
  const { terminology: terms, business } = tenant;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayIn(business.timezone);

  const start = zonedLocalToUtc(`${day}T00:00`, business.timezone)!;
  const end = new Date(start.getTime() + 86_400_000);

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: tenant.id, startTime: { gte: start, lt: end } },
    include: { user: true, service: true, staffMember: true },
    orderBy: { startTime: "asc" },
  });

  const time = new Intl.DateTimeFormat(business.locale, { timeStyle: "short", timeZone: business.timezone });
  const title = new Intl.DateTimeFormat(business.locale, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="micro-label text-ash">Día del servicio</p>
          <h1 className="headline mt-4 first-letter:uppercase">{title}</h1>
        </div>
        <nav className="flex gap-6">
          <Link href={`/admin?date=${shiftDay(day, -1)}`} className="btn-secondary">
            Anterior
          </Link>
          <Link href="/admin" className="btn-secondary">
            Hoy
          </Link>
          <Link href={`/admin?date=${shiftDay(day, 1)}`} className="btn-secondary">
            Siguiente
          </Link>
        </nav>
      </header>

      <ul className="border-b border-stone">
        {appointments.map((a) => {
          const transitions = MANUAL_TRANSITIONS[a.status] ?? [];
          const canNoShow = a.status === "PENDING" || a.status === "ACTIVE";
          return (
            <li key={a.id} className="grid gap-4 border-t border-stone py-6 md:grid-cols-[90px_1fr_1fr_auto] md:gap-8">
              <p className="font-serif text-2xl leading-none">{time.format(a.startTime)}</p>

              <div>
                <p className="text-lg">{a.user.name ?? (a.user.phoneNumber ? maskPhone(a.user.phoneNumber) : "Sin nombre")}</p>
                {a.user.noShowCount > 1 && (
                  <p className="micro-label mt-2 inline-block border border-carbon px-2 py-1 text-carbon">
                    ⚠ {a.user.noShowCount} inasistencias previas
                  </p>
                )}
                {a.user.phoneNumber && (
                  <a href={`https://wa.me/${a.user.phoneNumber}`} target="_blank" rel="noopener noreferrer" className="micro-label mt-2 block text-ash hover:text-ink">
                    WhatsApp{a.user.isPhoneVerified ? " · verificado" : ""}
                  </a>
                )}
              </div>

              <div>
                <p className="font-serif text-xl leading-[1.15]">{a.service.title}</p>
                <p className="micro-label mt-2 text-ash">
                  {a.staffMember?.name ?? "Sin asignar"} · vía {a.source.toLowerCase()} · {terms.statusLabels[a.status]}
                </p>
                {a.customerNotes && <p className="mt-2 text-[15px] text-ash">“{a.customerNotes}”</p>}
              </div>

              <div className="flex flex-wrap items-start gap-6 md:justify-end">
                {transitions.map((to) => (
                  <form key={to} action={updateAppointmentStatus}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value={to} />
                    <button className="btn-secondary">{terms.statusLabels[to]}</button>
                  </form>
                ))}
                {canNoShow && (
                  <form action={markAppointmentNoShow}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-secondary">{terms.statusLabels.NO_SHOW}</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
        {!appointments.length && (
          <li className="border-t border-stone py-10 text-[15px] text-ash">Sin {terms.record.plural.toLowerCase()} este día.</li>
        )}
      </ul>
    </>
  );
}
