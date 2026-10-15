"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/auth/fields";

interface Props {
  /** Puede devolver { error } para explicar por qué no se eliminó. */
  action: (formData: FormData) => Promise<void | { error?: string }>;
  id: string;
  /** Texto de la confirmación, p. ej. "¿Eliminar «Corte de autor»?" */
  question: string;
}

/** Acción destructiva en dos pasos, en línea: ELIMINAR → ¿Seguro? SÍ, ELIMINAR / NO. */
export function ConfirmDelete({ action, id, question }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-secondary">
        Eliminar
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        const result = await action(fd);
        setError(result?.error);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <span className="text-[15px] text-carbon">{question}</span>
        <SubmitButton />
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(undefined);
          }}
          className="btn-secondary"
        >
          No
        </button>
      </div>
      <FormMessage state={{ error }} />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}
