"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/app/login/actions";
import { FormMessage, TextField } from "./fields";

type Action = (prev: AuthFormState, fd: FormData) => Promise<AuthFormState>;

interface Props {
  requestAction: Action;
  verifyAction: Action;
  callbackUrl?: string;
  submitLabel?: string;
}

/** Dos pasos: celular → código de 6 dígitos. Reutilizado en el login y en "vincular celular" de la cuenta. */
export function PhoneOtpForm({ requestAction, verifyAction, callbackUrl, submitLabel = "Entrar" }: Props) {
  const [requested, request, requesting] = useActionState(requestAction, { step: "phone" });
  const [verified, verify, verifying] = useActionState(verifyAction, {});

  const phone = verified.phone ?? requested.phone;
  const onCodeStep = requested.step === "code" || verified.step === "code";

  if (!onCodeStep) {
    return (
      <form action={request} className="space-y-6">
        <TextField
          label="Celular"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+57 300 123 4567"
          hint="Con indicativo de país. Te llegará un código por WhatsApp."
          required
        />
        <FormMessage state={requested} />
        <button type="submit" disabled={requesting} className="btn-primary">
          {requesting ? "Enviando…" : "Enviar código"}
        </button>
      </form>
    );
  }

  return (
    <form action={verify} className="space-y-6">
      <input type="hidden" name="phone" value={phone} />
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <TextField
        label="Código"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="000000"
        required
        autoFocus
      />
      <FormMessage state={verified.error ? verified : requested} />
      <div className="flex flex-wrap items-center gap-8">
        <button type="submit" disabled={verifying} className="btn-primary">
          {verifying ? "Verificando…" : submitLabel}
        </button>
        <button type="submit" formAction={request} formNoValidate className="btn-secondary">
          Reenviar código
        </button>
      </div>
    </form>
  );
}
