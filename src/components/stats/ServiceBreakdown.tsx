import { customerLabel } from "@/lib/phone";
import type { ServiceCount, ServiceNote } from "@/modules/appointments/stats";

interface Props {
  month: ServiceCount[];
  total: ServiceCount[];
  /** Notas del estilista por servicio; si se pasan, se muestran bajo cada fila. */
  notes?: Map<string, ServiceNote[]>;
  locale?: string;
  timeZone?: string;
}

/** Servicios realizados por tipo: mes vs total, con las notas del estilista. */
export function ServiceBreakdown({ month, total, notes, locale, timeZone }: Props) {
  if (!total.length) return <p className="text-[15px] text-ash">Aún no hay servicios confirmados.</p>;

  const monthCount = new Map(month.map((m) => [m.serviceId, m.count]));
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone });

  return (
    <div>
      <div className="micro-label grid grid-cols-[1fr_70px_70px] gap-6 pb-3 text-ash">
        <span>Servicio</span>
        <span className="text-right">Mes</span>
        <span className="text-right">Total</span>
      </div>
      <ul className="border-b border-stone">
        {total.map((s) => {
          const serviceNotes = notes?.get(s.serviceId) ?? [];
          return (
            <li key={s.serviceId} className="border-t border-stone py-4">
              <div className="grid grid-cols-[1fr_70px_70px] items-baseline gap-6">
                <span className="font-serif text-xl leading-[1.2]">{s.title}</span>
                <span className="text-right text-[15px] tabular-nums">{monthCount.get(s.serviceId) ?? 0}</span>
                <span className="text-right text-[15px] tabular-nums">{s.count}</span>
              </div>
              {serviceNotes.length > 0 && (
                <ul className="mt-4 space-y-3 border-l border-stone pl-4">
                  {serviceNotes.map((n) => (
                    <li key={n.id}>
                      <p className="micro-label text-ash">
                        {date.format(n.startTime)} · {customerLabel(n.client)}
                      </p>
                      <p className="mt-1 text-[14px] leading-[1.45] whitespace-pre-line">{n.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
