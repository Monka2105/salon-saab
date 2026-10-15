"use client";

import { useActionState } from "react";
import { register } from "@/app/login/actions";
import { FormMessage, TextField } from "@/components/auth/fields";

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState(register, {});

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <TextField label="Nombre" name="name" autoComplete="name" required maxLength={80} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={128}
        hint="Mínimo 10 caracteres."
        required
      />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
