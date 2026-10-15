import type { Appointment, Service, StaffMember } from "@prisma/client";
import type { ResolvedTenant } from "@/lib/tenant";
import { CUSTOMER_CANCELLABLE } from "@/modules/appointments/status";
import { CancelAppointment } from "./CancelAppointment";

interface Props {
  appointment: Appointment & { service: Service; staffMember: StaffMember | null };
  tenant: ResolvedTenant;
}

/** Tarjeta editorial: blanco puro sobre el lienzo crema, sin bordes ni sombras. */
export function AppointmentCard({ appointment: a, tenant }: Props) {
  const { business, terminology: terms } = tenant;
  const day = new Intl.DateTimeFormat(business.locale, { weekday: "long", day: "numeric", month: "long", timeZone: business.timezone });
  const time = new Intl.DateTimeFormat(business.locale, { timeStyle: "short", timeZone: business.timezone });
  const canCancel = CUSTOMER_CANCELLABLE.includes(a.status) && a.startTime > new Date();

  return (
    <article className="flex flex-col gap-8 bg-white p-8 sm:p-10">
      <header className="space-y-3">
        <p className="micro-label text-ash">{terms.statusLabels[a.status]}</p>
        <p className="font-serif text-[32px] leading-[1.1] first-letter:uppercase">{day.format(a.startTime)}</p>
        <p className="text-[15px] tabular-nums text-ink">
          {time.format(a.startTime)} — {time.format(a.endTime)}
        </p>
      </header>

      <div className="space-y-2">
        <p className="font-serif text-xl leading-[1.2]">{a.service.title}</p>
        <p className="micro-label text-ash">
          {a.staffMember?.name ?? `${terms.staff.singular} por asignar`} · {a.service.durationMinutes} min
        </p>
        {a.customerNotes && <p className="pt-2 text-[15px] text-ash">“{a.customerNotes}”</p>}
      </div>

      {canCancel && (
        <footer className="mt-auto">
          <CancelAppointment id={a.id} />
        </footer>
      )}
    </article>
  );
}
