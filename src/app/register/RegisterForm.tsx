"use client";

import { useActionState, useState } from "react";
import { register, requestRegisterCode, verifyPhoneCode } from "@/app/login/actions";
import { FormMessage, TextField } from "@/components/auth/fields";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

type Method = "phone" | "email";

/** Celular + código por WhatsApp por defecto; email + contraseña queda como alternativa (p. ej. cuentas de estilistas). */
export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [method, setMethod] = useState<Method>("phone");
  const [state, action, pending] = useActionState(register, {});

  return (
    <div className="space-y-10">
      <div role="tablist" className="flex gap-8">
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => setMethod(m)}
            className={`micro-label border-b pb-1 transition-colors ${
              method === m ? "border-carbon text-carbon" : "border-transparent text-ash hover:text-ink"
            }`}
          >
            {m === "phone" ? "Celular" : "Email"}
          </button>
        ))}
      </div>

      {method === "phone" ? (
        <PhoneOtpForm
          requestAction={requestRegisterCode}
          verifyAction={verifyPhoneCode}
          callbackUrl={callbackUrl}
          submitLabel="Crear cuenta"
          askName
        />
      ) : (
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
      )}
    </div>
  );
}
