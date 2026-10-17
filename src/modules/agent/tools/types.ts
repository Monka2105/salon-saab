import type { User } from "@prisma/client";
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import type { ResolvedTenant } from "@/lib/tenant";
import { publicUrl } from "@/lib/url";

/** Contexto inyectado a cada herramienta: nunca confíes en IDs de tenant/cliente que envíe la IA. */
export interface ToolContext {
  tenant: ResolvedTenant;
  customer: User;
}

export type ToolResult = Record<string, unknown>;

export interface AgentTool<Args> {
  name: string;
  /** La definición se construye por tenant para usar su terminología en las descripciones. */
  definition: (tenant: ResolvedTenant) => ChatCompletionFunctionTool;
  handler: (args: Args, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * Reservar y cancelar exigen un perfil verificado (celular confirmado con OTP en la web).
 * Devuelve el error para la IA, o null si puede continuar.
 */
export function requireRegistered(ctx: ToolContext): ToolResult | null {
  if (ctx.customer.isPhoneVerified) return null;
  return { ok: false, error: "REGISTRATION_REQUIRED", registerUrl: publicUrl("/login") };
}

/** "YYYY-MM-DD HH:mm" en la zona horaria del negocio: formato estable para la IA. */
export function toLocalString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "2026-10-16T15:00" → "3:00 PM" (hora local del negocio, como la ve el cliente). */
export function timeLabel(local: string): string {
  const [h, m] = local.slice(11, 16).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "2026-10-16" → "Jueves 16 de octubre". */
export function dayLabel(day: string, locale: string): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  const text = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(",", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Andrea Valencia" → "Andrea V.": cabe en el título de una fila de WhatsApp (24 caracteres). */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const initial = rest.at(-1)?.charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}
