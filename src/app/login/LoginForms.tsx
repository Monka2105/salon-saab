"use client";

import { useActionState, useState } from "react";
import { FormMessage, TextField } from "@/components/auth/fields";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { loginWithEmail, requestPhoneCode, verifyPhoneCode } from "./actions";

type Method = "phone" | "email";

export function LoginForms({ callbackUrl }: { callbackUrl: string }) {
  const [method, setMethod] = useState<Method>("phone");
  const [emailState, emailAction, emailPending] = useActionState(loginWithEmail, {});

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
        <PhoneOtpForm requestAction={requestPhoneCode} verifyAction={verifyPhoneCode} callbackUrl={callbackUrl} />
      ) : (
        <form action={emailAction} className="space-y-6">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" required />
          <FormMessage state={emailState} />
          <button type="submit" disabled={emailPending} className="btn-primary">
            {emailPending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      )}
    </div>
  );
}
