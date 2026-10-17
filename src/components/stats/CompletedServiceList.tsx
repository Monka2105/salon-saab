import { customerLabel } from "@/lib/phone";
import type { CompletedService } from "@/modules/appointments/stats";

interface Props {
  services: CompletedService[];
  locale: string;
  timeZone: string;
  empty: string;
  /** Muestra quién confirmó (útil para el admin; el estilista ya sabe que fue él). */
  showConfirmedBy?: boolean;
}

/** Registro de servicios realizados: fecha, cliente, servicio, notas y quién lo confirmó. */
export function CompletedServiceList({ services, locale, timeZone, empty, showConfirmedBy = false }: Props) {
  if (!services.length) return <p className="text-[15px] text-ash">{empty}</p>;

  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone });
  return (
    <ul className="border-b border-stone">
      {services.map((s) => (
        <li key={s.id} className="grid gap-x-8 gap-y-2 border-t border-stone py-5 sm:grid-cols-[130px_1fr]">
          <p className="micro-label pt-1 text-ash tabular-nums">{when.format(s.startTime)}</p>
          <div>
            <p className="font-serif text-xl leading-[1.2]">{s.service.title}</p>
            <p className="mt-1 text-[15px]">{customerLabel(s.user)}</p>
            {s.executionNotes && <p className="mt-2 text-[14px] leading-[1.45] text-ash">“{s.executionNotes}”</p>}
            {showConfirmedBy && s.completedBy && (
              <p className="micro-label mt-2 text-ash">Confirmó: {s.completedBy.name ?? s.completedBy.email}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
