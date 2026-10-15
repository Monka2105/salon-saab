"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { loadSlots, submitBooking, type BookingFormState, type SlotOption } from "@/app/new/actions";
import { FormMessage } from "@/components/auth/fields";
import type { Terminology } from "@/config/tenant";

interface Props {
  services: { id: string; label: string }[];
  staff: { id: string; name: string }[];
  defaultServiceId?: string;
  defaultStaffId?: string;
  terms: Terminology;
  /** Límites "YYYY-MM-DD" para el selector de día. */
  minDay: string;
  maxDay: string;
}

const INITIAL_STATE: BookingFormState = { status: "idle" };

export function BookingForm({ services, staff, defaultServiceId, defaultStaffId, terms, minDay, maxDay }: Props) {
  const [state, action, pending] = useActionState(submitBooking, INITIAL_STATE);
  const [serviceId, setServiceId] = useState(defaultServiceId ?? "");
  const [staffMemberId, setStaffMemberId] = useState(defaultStaffId ?? "any");
  const [day, setDay] = useState(minDay);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [selected, setSelected] = useState("");

  // Recalcula los Smart Slots al cambiar servicio, estilista o día (y tras un intento fallido: el hueco pudo ocuparse).
  useEffect(() => {
    setSelected("");
    if (!serviceId || !day) {
      setSlots(null);
      return;
    }
    let stale = false;
    setSlots(null);
    loadSlots(serviceId, staffMemberId, day).then((result) => {
      if (!stale) setSlots(result);
    });
    return () => {
      stale = true;
    };
  }, [serviceId, staffMemberId, day, state]);

  if (state.status === "success") {
    return (
      <div className="space-y-6 border-t border-carbon pt-8">
        <p className="micro-label text-ash">Recibido</p>
        <p className="font-serif text-[28px] leading-[1.15]">{state.message}</p>
        <Link href="/appointments" className="link-cta">
          Ver mis {terms.record.plural.toLowerCase()}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6 bg-white p-6 sm:p-10">
      <Field label={terms.item.singular}>
        <select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className="input">
          <option value="" disabled>
            Selecciona…
          </option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {staff.length > 0 && (
        <Field label={terms.staff.singular}>
          <select name="staffMemberId" value={staffMemberId} onChange={(e) => setStaffMemberId(e.target.value)} className="input">
            <option value="any">Cualquiera</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Día">
        <input type="date" value={day} min={minDay} max={maxDay} onChange={(e) => setDay(e.target.value)} required className="input" />
      </Field>

      <fieldset className="space-y-3">
        <legend className="micro-label">{terms.slot.plural}</legend>
        <input type="hidden" name="date" value={selected} />
        {!serviceId ? (
          <p className="text-[15px] text-ash">Elige un {terms.item.singular.toLowerCase()} para ver los horarios.</p>
        ) : slots === null ? (
          <p className="text-[15px] text-ash">Calculando…</p>
        ) : slots.length === 0 ? (
          <p className="text-[15px] text-ash">No quedan {terms.slot.plural.toLowerCase()} libres este día.</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {slots.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={selected === s.value}
                onClick={() => setSelected(s.value)}
                className={`cursor-pointer pb-1 text-[15px] tabular-nums transition-colors ${
                  selected === s.value ? "border-b border-carbon text-carbon" : "border-b border-transparent text-ash hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <Field label="Notas (opcional)">
        <textarea name="customerNotes" rows={3} maxLength={500} className="input" />
      </Field>

      {state.status === "error" && <FormMessage state={{ error: state.message }} />}

      <button type="submit" disabled={pending || !selected} className="btn-primary">
        {pending ? "Enviando…" : terms.ctaPrimary}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="micro-label block">{label}</span>
      {children}
    </label>
  );
}
