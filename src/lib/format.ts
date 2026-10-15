import type { TenantConfig, TimeRange, Weekday } from "@/config/tenant";

type Business = Pick<TenantConfig["business"], "locale" | "currency" | "timezone">;

function currencyDigits(business: Business): number {
  return new Intl.NumberFormat(business.locale, { style: "currency", currency: business.currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

/** Precio guardado en unidades mínimas → texto localizado. */
export function formatPrice(minor: number | null | undefined, business: Business): string | null {
  if (minor == null) return null;
  const formatter = new Intl.NumberFormat(business.locale, { style: "currency", currency: business.currency });
  return formatter.format(minor / 10 ** currencyDigits(business));
}

/** 1250 → "12.50" (para precargar un input editable, sin símbolo de moneda). */
export function fromMinorUnits(minor: number, business: Business): string {
  const digits = currencyDigits(business);
  return (minor / 10 ** digits).toFixed(digits);
}

/**
 * Texto del admin → unidades mínimas, según los decimales de la moneda.
 * Con decimales (USD): "12.50" o "12,50" → 1250.
 * Sin decimales (COP): "65.000", "65,000" o "$ 65 000" → 65000 (puntos y comas son separadores de miles).
 */
export function toMinorUnits(major: string, business: Business): number | null {
  const digits = currencyDigits(business);
  const cleaned = digits === 0 ? major.replace(/[^\d]/g, "") : major.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** digits);
}

export function formatDateTime(date: Date, business: Business): string {
  return new Intl.DateTimeFormat(business.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: business.timezone,
  }).format(date);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** Interpreta "YYYY-MM-DDTHH:mm" en la zona horaria del negocio y devuelve el instante UTC. */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - timeZoneOffsetMs(new Date(guess), timeZone));
}

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Horario de atención como lista legible, con nombres de día según el locale. */
export function describeOpeningHours(
  hours: Partial<Record<Weekday, readonly TimeRange[]>>,
  locale: string,
): { day: string; ranges: string }[] {
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
  // 2024-01-01 fue lunes
  return WEEKDAYS.flatMap((key, i) => {
    const ranges = hours[key];
    if (!ranges?.length) return [];
    const day = dayName.format(new Date(Date.UTC(2024, 0, 1 + i)));
    return [{ day: day.charAt(0).toUpperCase() + day.slice(1), ranges: ranges.map(([a, b]) => `${a}–${b}`).join(", ") }];
  });
}

/** Día de la semana y minuto del día de `date` en la zona horaria indicada. */
export function zonedParts(date: Date, timeZone: string): { weekday: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday").toLowerCase().slice(0, 3) as Weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** "09:30" → 570 */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" de hoy en la zona horaria indicada. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now);
}

/** "YYYY-MM-DD" ± n días (aritmética de calendario, sin zona horaria). */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha "YYYY-MM-DD". */
export function weekdayOf(day: string): Weekday {
  // getUTCDay(): 0 = domingo
  return WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7];
}

/** Instante UTC de "día + minutos desde medianoche" en la zona horaria del negocio (admite 1440 = fin del día). */
export function zonedDayMinutesToUtc(day: string, minutes: number, timeZone: string): Date | null {
  const dayOffset = Math.floor(minutes / 1440);
  return zonedLocalToUtc(`${shiftDay(day, dayOffset)}T${minutesToTime(minutes - dayOffset * 1440)}`, timeZone);
}
