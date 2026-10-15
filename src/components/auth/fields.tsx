import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, ...input }: TextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="micro-label block">{label}</span>
      <input {...input} className="input" />
      {hint && <span className="block text-[12px] text-ash">{hint}</span>}
    </label>
  );
}

/** Mensajes en tinta, nunca en color: el error se distingue por la regla negra a la izquierda. */
export function FormMessage({ state }: { state: { error?: string; info?: string } }) {
  if (state.error) {
    return (
      <p role="alert" className="border-l border-carbon pl-3 text-[15px] text-carbon">
        {state.error}
      </p>
    );
  }
  if (state.info) return <p className="text-[15px] text-ash">{state.info}</p>;
  return null;
}
