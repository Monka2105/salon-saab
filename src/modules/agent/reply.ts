import type { ResolvedTenant } from "@/lib/tenant";
import type { WaInteractive, WaListSection, WaReplyButton } from "@/modules/whatsapp/types";
import { dayLabel, shortName, timeLabel, type ToolResult } from "./tools/types";

// Respuesta estructurada del agente. La IA solo redacta el texto; las listas y botones se construyen
// aquí, en el servidor, a partir de los resultados reales de las herramientas (nunca datos inventados).

export type AgentReply =
  | { kind: "text"; text: string }
  | { kind: "list"; header?: string; body: string; button: string; sections: WaListSection[] }
  | { kind: "buttons"; body: string; buttons: WaReplyButton[] };

const LIMITS = { header: 60, body: 1024, rowTitle: 24, rowDescription: 72, sectionTitle: 24, listButton: 20, rows: 10, buttonTitle: 20 };

export const textReply = (text: string): AgentReply => ({ kind: "text", text });

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Hasta `n` elementos repartidos de punta a punta (9:00 … 11:55) en vez de solo los primeros. */
function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.round((i * (items.length - 1)) / (n - 1))]);
}

/** Franja del día de un "YYYY-MM-DDTHH:mm" local. */
function periodOf(local: string): string {
  const hour = Number(local.slice(11, 13));
  return hour < 12 ? "Mañana" : hour < 18 ? "Tarde" : "Noche";
}

// ── IDs de filas y botones ───────────────────────────────────
// Vuelven en el webhook cuando la persona pulsa. Se revalidan siempre (prepareBooking / createAppointment).

export interface SlotChoice {
  serviceId: string;
  staffId: string | null;
  startTime: string;
}

export type QuickReply =
  | { action: "service"; serviceId: string }
  | { action: "slot"; choice: SlotChoice }
  | { action: "book"; choice: SlotChoice }
  | { action: "decline" };

const encodeChoice = (c: SlotChoice) => `${c.serviceId}|${c.staffId ?? "-"}|${c.startTime}`;

export function parseQuickReply(id: string | undefined): QuickReply | null {
  if (!id) return null;
  const [action, ...parts] = id.split("|");
  if (action === "decline") return { action: "decline" };
  if (action === "svc" && parts[0]) return { action: "service", serviceId: parts[0] };
  if ((action === "slot" || action === "book") && parts.length === 3) {
    const [serviceId, staff, startTime] = parts;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startTime)) return null;
    return { action, choice: { serviceId, staffId: staff === "-" ? null : staff, startTime } };
  }
  return null;
}

// ── Constructores a partir de resultados de herramientas ─────

interface ServiceItem {
  id: string;
  title: string;
  price: string | null;
  durationMinutes: number;
}

export function servicesList(services: ServiceItem[], body: string): AgentReply | null {
  if (!services.length) return null;
  return {
    kind: "list",
    body,
    button: "Ver servicios",
    sections: [
      {
        title: "Servicios",
        rows: services.slice(0, LIMITS.rows).map((s) => {
          const title = clip(s.title, LIMITS.rowTitle);
          const details = [s.price, `${s.durationMinutes} min`].filter(Boolean).join(" · ");
          // Si el nombre no cabe en el título, va completo en la descripción.
          const description = title === s.title ? details : `${s.title} · ${details}`;
          return { id: `svc|${s.id}`, title, description: clip(description, LIMITS.rowDescription) };
        }),
      },
    ],
  };
}

interface SlotsResult {
  date: string;
  serviceId: string;
  service: string;
  price: string | null;
  slots: { startTime: string; staffId: string | null; staff: string | null }[];
}

/**
 * Horarios del día agrupados en Mañana / Tarde / Noche: cada franja cabe en una lista (≤ 10 filas).
 * Si una franja tiene más (servicios cortos: 5 min → 100+ horarios), se muestran 10 repartidos de inicio a fin
 * y se invita a escribir otra hora; la IA la valida con prepareBooking.
 */
export function slotsList(result: SlotsResult, body: string, locale: string): AgentReply | null {
  if (!result.slots.length) return null;

  const groups = new Map<string, SlotsResult["slots"]>();
  for (const s of result.slots) {
    const period = periodOf(s.startTime);
    groups.set(period, [...(groups.get(period) ?? []), s]);
  }

  let thinned = false;
  const sections: WaListSection[] = [...groups].map(([period, slots]) => {
    const shown = spread(slots, LIMITS.rows);
    thinned ||= shown.length < slots.length;
    const first = timeLabel(slots[0].startTime);
    const last = timeLabel(slots.at(-1)!.startTime);
    return {
      title: clip(slots.length > 1 ? `${period} ${first}–${last}` : period, LIMITS.sectionTitle),
      rows: shown.map((s) => ({
        id: `slot|${encodeChoice({ serviceId: result.serviceId, staffId: s.staffId, startTime: s.startTime })}`,
        title: clip(s.staff ? `${timeLabel(s.startTime)} - ${shortName(s.staff)}` : timeLabel(s.startTime), LIMITS.rowTitle),
      })),
    };
  });

  const summary = [...groups].map(([period, slots]) => `${period.toLowerCase()} (${slots.length})`).join(", ");
  const lines = [
    body,
    "",
    `${dayLabel(result.date, locale)}: ${summary}.`,
    thinned ? "Le muestro una selección; si prefiere otra hora dentro de esas franjas, escríbamela." : null,
  ].filter((l): l is string => l !== null);

  return {
    kind: "list",
    header: [result.service, result.price].filter(Boolean).join(" · "),
    body: lines.join("\n"),
    button: "Ver horarios",
    sections,
  };
}

interface PreparedBooking extends SlotChoice {
  service: string;
  staff: string | null;
  date: string;
  time: string;
  price: string | null;
}

/** Resumen exacto + [Confirmar cita] [Cancelar]. El texto lo arma el servidor para que coincida con lo que se reservará. */
export function confirmationButtons(b: PreparedBooking, tenant: ResolvedTenant): AgentReply {
  const lines = [
    "Por favor confirme su reserva:",
    "",
    `*${tenant.terminology.item.singular}:* ${b.service}`,
    b.staff ? `*Profesional:* ${b.staff}` : null,
    `*Fecha:* ${b.date}`,
    `*Hora:* ${b.time}`,
    b.price ? `*Precio:* ${b.price}` : null,
  ].filter((l): l is string => l !== null);
  return {
    kind: "buttons",
    body: lines.join("\n"),
    buttons: [
      { id: `book|${encodeChoice(b)}`, title: "Confirmar cita" },
      { id: "decline", title: "Cancelar" },
    ],
  };
}

/**
 * Qué interfaz deja cada herramienta para la respuesta final del turno.
 * `undefined` = no cambia la interfaz; `null` = la descarta (p. ej. tras reservar).
 */
export function uiFromToolResult(
  name: string,
  result: ToolResult,
  tenant: ResolvedTenant,
): ((body: string) => AgentReply | null) | null | undefined {
  if (result.ok !== true) return name === "prepareBooking" || name === "checkAvailability" ? null : undefined;

  switch (name) {
    case "getAvailableServices":
      return (body) => servicesList(result.services as ServiceItem[], body);
    case "checkAvailability":
      return (body) => slotsList(result as unknown as SlotsResult, body, tenant.business.locale);
    case "prepareBooking":
      return () => confirmationButtons(result as unknown as PreparedBooking, tenant);
    case "bookAppointment":
    case "cancelAppointment":
      return null;
    default:
      return undefined;
  }
}

// ── Salida ───────────────────────────────────────────────────

/** Versión en texto plano: se guarda en el historial (contexto de la IA) y se usa en canales sin interactivos. */
export function renderAsText(reply: AgentReply): string {
  switch (reply.kind) {
    case "text":
      return reply.text;
    case "list":
      return [
        reply.header ? `*${reply.header}*
${reply.body}` : reply.body,
        ...reply.sections.map((s) =>
          [s.title ? `*${s.title}*` : null, ...s.rows.map((r) => `• ${r.title}${r.description ? ` — ${r.description}` : ""}`)]
            .filter(Boolean)
            .join("\n"),
        ),
      ].join("\n\n");
    case "buttons":
      return `${reply.body}\n\nResponda: ${reply.buttons.map((b) => `«${b.title}»`).join(" o ")}`;
  }
}

/**
 * Reparte las secciones en listas de ≤ 10 filas (límite de Meta), sin mezclar franjas:
 * Mañana (7) + Tarde (12) → [Mañana] [Tarde 1/2] [Tarde 2/2].
 */
function chunkSections(sections: WaListSection[]): WaListSection[][] {
  const pages: WaListSection[][] = [];
  let page: WaListSection[] = [];
  let used = 0;
  for (const section of sections) {
    const parts = Math.ceil(section.rows.length / LIMITS.rows);
    for (let i = 0; i < parts; i++) {
      const rows = section.rows.slice(i * LIMITS.rows, (i + 1) * LIMITS.rows);
      const title = clip(parts > 1 ? `${section.title} (${i + 1}/${parts})` : (section.title ?? ""), LIMITS.sectionTitle);
      if (used + rows.length > LIMITS.rows) {
        pages.push(page);
        page = [];
        used = 0;
      }
      page.push({ title, rows });
      used += rows.length;
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

type CloudMessage = { type: "text"; text: string } | { type: "interactive"; interactive: WaInteractive };

/**
 * Payloads para la Cloud API. Si el texto supera el cuerpo permitido (1024), va antes como mensaje aparte.
 * Una lista con más de 10 filas se envía como varias listas seguidas.
 */
export function toCloudMessages(reply: AgentReply): CloudMessage[] {
  if (reply.kind === "text") return [{ type: "text", text: reply.text }];

  const fits = reply.body.length <= LIMITS.body;
  const lead: CloudMessage[] = fits ? [] : [{ type: "text", text: reply.body }];
  const firstBody = fits ? reply.body : reply.kind === "list" ? "Elija una opción:" : "¿Confirmamos?";

  if (reply.kind === "buttons") {
    return [
      ...lead,
      {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: firstBody },
          action: { buttons: reply.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, LIMITS.buttonTitle) } })) },
        },
      },
    ];
  }

  const pages = chunkSections(reply.sections);
  const header = reply.header ? { type: "text" as const, text: clip(reply.header, LIMITS.header) } : undefined;
  return [
    ...lead,
    ...pages.map((sections, i): CloudMessage => {
      // "Tarde 12:20 PM–5:00 PM" → "tarde": el rango ya va en el título de la sección.
      const names = [...new Set(sections.map((s) => s.title?.split(" ")[0]).filter(Boolean))].join(" y ");
      return {
        type: "interactive",
        interactive: {
          type: "list",
          ...(i === 0 && header && { header }),
          body: { text: i === 0 ? firstBody : `Horarios de la ${names.toLowerCase()}:` },
          action: {
            button: clip(pages.length > 1 && sections[0]?.title ? `Ver ${sections[0].title.split(" ")[0].toLowerCase()}` : reply.button, LIMITS.listButton),
            sections,
          },
        },
      };
    }),
  ];
}
