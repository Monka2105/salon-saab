"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/auth/fields";

interface Props {
  id: string;
  action: (formData: FormData) => Promise<void | { error?: string }>;
}

/** CONFIRMAR SERVICIO → notas opcionales + SÍ, FUE REALIZADO / CANCELAR. Sin diálogos nativos. */
export function ConfirmService({ id, action }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Confirmar servicio
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        const result = await action(fd);
        setError(result?.error);
      }}
      className="w-full space-y-4"
    >
      <input type="hidden" name="id" value={id} />
      <label className="block space-y-2">
        <span className="micro-label block">Notas del servicio (opcional)</span>
        <textarea name="executionNotes" rows={3} maxLength={5000} placeholder="Fórmula, técnica, productos…" className="input" />
      </label>
      <FormMessage state={{ error }} />
      <div className="flex flex-wrap gap-6">
        <SubmitButton />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(undefined);
          }}
          className="btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Confirmando…" : "Sí, fue realizado"}
    </button>
  );
}
