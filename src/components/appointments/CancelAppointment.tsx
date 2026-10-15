"use client";

import { useActionState, useState } from "react";
import { cancelAppointment, type CancelState } from "@/app/appointments/actions";
import { FormMessage } from "@/components/auth/fields";

const INITIAL_STATE: CancelState = {};

/** Acción de texto en dos pasos (sin diálogos nativos): CANCELAR CITA → ¿Confirmas? SÍ, CANCELAR / NO. */
export function CancelAppointment({ id }: { id: string }) {
  const [state, action, pending] = useActionState(cancelAppointment, INITIAL_STATE);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-secondary">
        Cancelar cita
      </button>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-[15px] text-ink">¿Confirmas la cancelación? El horario quedará libre para otra persona.</p>
      <div className="flex flex-wrap gap-6">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="btn-secondary">
          No, mantener
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
