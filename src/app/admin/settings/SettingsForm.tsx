"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "../actions";

type FieldName =
  | "name"
  | "tagline"
  | "description"
  | "phone"
  | "address"
  | "timezone"
  | "primaryColor"
  | "accentColor"
  | "whatsappPhoneNumberId"
  | "systemPrompt"
  | "terminology";

interface Props {
  values: Record<FieldName, string>;
  defaults: Partial<Record<FieldName, string>>;
}

const FIELDS: { name: FieldName; label: string; multiline?: boolean; mono?: boolean }[] = [
  { name: "name", label: "Nombre del negocio" },
  { name: "tagline", label: "Eslogan" },
  { name: "description", label: "Descripción", multiline: true },
  { name: "phone", label: "Teléfono (solo dígitos, con indicativo)" },
  { name: "address", label: "Dirección" },
  { name: "timezone", label: "Zona horaria (IANA)" },
  { name: "primaryColor", label: "Color primario" },
  { name: "accentColor", label: "Color de acento" },
  { name: "whatsappPhoneNumberId", label: "WhatsApp phone_number_id (Meta)" },
  { name: "terminology", label: "Terminología (JSON parcial)", multiline: true, mono: true },
  { name: "systemPrompt", label: "System prompt del agente", multiline: true, mono: true },
];

const INITIAL_STATE: SettingsState = { status: "idle" };

export function SettingsForm({ values, defaults }: Props) {
  const [state, action, pending] = useActionState(updateSettings, INITIAL_STATE);

  return (
    <form action={action} className="space-y-4 rounded-brand border border-zinc-200 bg-white p-5">
      {FIELDS.map(({ name, label, multiline, mono }) => (
        <label key={name} className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">{label}</span>
          {multiline ? (
            <textarea
              name={name}
              defaultValue={values[name]}
              placeholder={defaults[name]}
              rows={mono ? 12 : 3}
              className={`input ${mono ? "font-mono text-xs" : ""}`}
            />
          ) : (
            <input name={name} defaultValue={values[name]} placeholder={defaults[name]} className="input" />
          )}
        </label>
      ))}

      {state.status !== "idle" && (
        <p className={`text-sm ${state.status === "error" ? "text-red-600" : "text-emerald-700"}`}>{state.message}</p>
      )}

      <button disabled={pending} className="btn-primary">
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
