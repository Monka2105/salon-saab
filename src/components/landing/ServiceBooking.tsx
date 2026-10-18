"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { loadDaySlots, submitBooking, type BookingFormState } from "@/app/servicios/actions";

export interface BookingStaff {
  id: string;
  name: string;
  specialty: string | null;
  photoUrl: string | null;
}

interface Props {
  serviceId: string;
  staff: BookingStaff[];
  locale: string;
  /** Días seleccionables "YYYY-MM-DD", desde hoy. */
  days: string[];
  /** Selección inicial: primer día libre, o la que venía en la URL (p. ej. al volver del login). */
  defaults: { staffId: string; day: string; slot: string | null };
  /** Horarios del día inicial, ya calculados en el servidor. */
  initialSlots: string[];
  signedIn: boolean;
  /** Ruta de esta página, para volver tras iniciar sesión con la selección intacta. */
  path: string;
  staffLabel: string;
}

const INITIAL_STATE: BookingFormState = { status: "idle" };

/** "14:00" → "02:00 PM" */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function dateParts(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(new Date(Date.UTC(y, m - 1, d)));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** "Andrea Valencia" → "Andrea V." */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/**
 * Reserva completa de un servicio: estilista → fecha → horario → notas → confirmar.
 * Los horarios son los Smart Slots reales; createAppointment los revalida al confirmar.
 */
export function ServiceBooking({ serviceId, staff, locale, days, defaults, initialSlots, signedIn, path, staffLabel }: Props) {
  const [state, action, pending] = useActionState(submitBooking, INITIAL_STATE);
  const [staffId, setStaffId] = useState(defaults.staffId);
  const [day, setDay] = useState(defaults.day);
  const [slots, setSlots] = useState<string[] | null>(initialSlots);
  const [selected, setSelected] = useState(defaults.slot && initialSlots.includes(defaults.slot) ? defaults.slot : "");
  const firstRender = useRef(true);

  // Recalcula al cambiar estilista o día, y tras un intento fallido (el hueco pudo ocuparse).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let stale = false;
    setSlots(null);
    setSelected("");
    loadDaySlots(serviceId, staffId, day).then((result) => {
      if (!stale) setSlots(result);
    });
    return () => {
      stale = true;
    };
  }, [serviceId, staffId, day, state]);

  if (state.status === "success") {
    return (
      <section className="space-y-6 border-t border-carbon pt-10">
        <p className="micro-label text-ash">Reserva recibida</p>
        <p className="font-serif text-[30px] leading-[1.15]">{state.message}</p>
        <p className="text-[15px]">
          {capitalize(dateParts(day, locale, { weekday: "long", day: "numeric", month: "long" }))} · {clock(selected)}
        </p>
        <Link href="/appointments" className="link-cta">
          Ver mi historial
        </Link>
      </section>
    );
  }

  const periods = slots
    ? [
        { label: "Mañana", slots: slots.filter((t) => t < "12:00") },
        { label: "Tarde", slots: slots.filter((t) => t >= "12:00" && t < "18:00") },
        { label: "Noche", slots: slots.filter((t) => t >= "18:00") },
      ].filter((p) => p.slots.length)
    : [];

  const loginHref = () => {
    const q = new URLSearchParams({ day });
    if (staffId !== "any") q.set("staff", staffId);
    if (selected) q.set("slot", selected);
    return `/login?callbackUrl=${encodeURIComponent(`${path}?${q}`)}`;
  };

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffMemberId" value={staffId} />
      <input type="hidden" name="date" value={selected ? `${day}T${selected}` : ""} />

      {staff.length > 0 && (
        <section>
          <h2 className="font-serif text-[24px] leading-[1.1] uppercase">Tu {staffLabel}</h2>
          <p className="mt-1 text-[14px]">Elige quién te atenderá</p>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {staff.map((m) => (
              <StaffCard key={m.id} selected={staffId === m.id} onSelect={() => setStaffId(m.id)} title={shortName(m.name)} subtitle={m.specialty}>
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover grayscale" />
                ) : (
                  <span className="flex aspect-[16/10] w-full items-center justify-center bg-stone font-serif text-[24px] text-graphite">{initials(m.name)}</span>
                )}
              </StaffCard>
            ))}
            <StaffCard selected={staffId === "any"} onSelect={() => setStaffId("any")} title="Cualquiera disponible" subtitle="Primer turno libre">
              <span className="flex aspect-[16/10] w-full items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <rect x="3" y="3" width="12" height="12" />
                  <rect x="9" y="9" width="12" height="12" className="fill-cream" />
                </svg>
              </span>
            </StaffCard>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-serif text-[24px] leading-[1.1] uppercase">Disponibilidad</h2>
        <p className="mt-1 text-[14px]">{capitalize(dateParts(day, locale, { weekday: "long", day: "numeric", month: "long" }))}</p>

        {/* Fechas: tira desplazable de días */}
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {days.map((d) => {
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={active}
                className={`flex min-w-[64px] shrink-0 cursor-pointer flex-col items-center border px-3 py-2.5 transition-colors ${active ? "border-carbon bg-carbon text-cream" : "border-ink/40 hover:border-ink"}`}
              >
                <span className="micro-label">{dateParts(d, locale, { weekday: "short" }).replace(".", "")}</span>
                <span className="mt-1 text-[20px] leading-none font-medium tabular-nums">{dateParts(d, locale, { day: "numeric" })}</span>
                <span className="micro-label mt-1 text-[10px] opacity-70">{dateParts(d, locale, { month: "short" }).replace(".", "")}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 min-h-[120px]">
          {slots === null ? (
            <p className="text-[15px] text-ash">Buscando horarios…</p>
          ) : periods.length === 0 ? (
            <p className="text-[15px] text-ash">No quedan horarios libres este día. Prueba con otra fecha{staff.length > 0 ? " u otro estilista" : ""}.</p>
          ) : (
            <div className="space-y-6">
              {periods.map((p) => (
                <div key={p.label}>
                  <p className="micro-label text-ash">
                    {p.label} · {p.slots.length} {p.slots.length === 1 ? "horario" : "horarios"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.slots.map((t) => {
                      const active = t === selected;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelected(t)}
                          aria-pressed={active}
                          className={`cursor-pointer border px-3.5 py-2 text-[14px] whitespace-nowrap tabular-nums transition-colors ${active ? "border-carbon bg-carbon text-cream" : "border-ink/30 hover:border-ink"}`}
                        >
                          {clock(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-[560px] space-y-5 border-t border-stone pt-8">
        <label className="block space-y-2">
          <span className="micro-label block">Notas (opcional)</span>
          <textarea name="customerNotes" rows={3} maxLength={500} className="input" />
        </label>

        {state.status === "error" && <p className="text-[14px] text-carbon">{state.message}</p>}

        {signedIn ? (
          <button
            type="submit"
            disabled={pending || !selected}
            className="micro-label cursor-pointer bg-carbon px-10 py-4 text-cream transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {pending ? "Reservando…" : selected ? `Confirmar · ${clock(selected)}` : "Elige un horario"}
          </button>
        ) : (
          <Link href={loginHref()} className="micro-label inline-block bg-carbon px-10 py-4 text-cream transition-opacity hover:opacity-85">
            Inicia sesión para confirmar
          </Link>
        )}
      </section>
    </form>
  );
}

function StaffCard({
  selected,
  onSelect,
  title,
  subtitle,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string | null;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex cursor-pointer flex-col items-center border p-2 pb-3 text-center transition-colors ${selected ? "border-carbon bg-white" : "border-ink/40 hover:border-ink"}`}
    >
      {children}
      <span className="mt-2 text-[13px] font-medium tracking-[0.02em] uppercase">{title}</span>
      {subtitle && <span className="micro-label mt-1 text-ash">{subtitle}</span>}
    </button>
  );
}
