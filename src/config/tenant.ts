/**
 * Configuración central white-label.
 *
 * Para adaptar la plantilla a un nuevo nicho, edita SOLO este archivo.
 * Los campos editables desde /admin/settings se guardan en la tabla `Tenant`
 * y sobrescriben estos valores en tiempo de ejecución (ver src/lib/tenant.ts).
 */

import type { AppointmentStatus } from "@prisma/client";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
/** Rango horario "HH:mm" → "HH:mm" en la zona horaria del negocio. */
export type TimeRange = readonly [start: string, end: string];

export interface EntityLabel {
  singular: string;
  plural: string;
}

export interface Terminology {
  /** Lo que se ofrece en el catálogo. */
  item: EntityLabel;
  /** Lo que se crea al convertir (cita). */
  record: EntityLabel;
  customer: EntityLabel;
  staff: EntityLabel;
  /** Unidad de tiempo reservable. */
  slot: EntityLabel;
  /** Texto del botón principal de conversión. */
  ctaPrimary: string;
  statusLabels: Record<AppointmentStatus, string>;
}

export interface TenantConfig {
  slug: string;
  business: {
    name: string;
    tagline: string;
    description: string;
    /** Solo dígitos en formato internacional; se usa para el enlace wa.me */
    phone: string;
    address: string;
    /** BCP 47, p. ej. "es-CO" */
    locale: string;
    /** ISO 4217, p. ej. "USD" */
    currency: string;
    /** IANA, p. ej. "America/Bogota" */
    timezone: string;
  };
  theme: {
    primary: string;
    primaryForeground: string;
    accent: string;
    radius: string;
  };
  terminology: Terminology;
  /** Página de inicio */
  landing: {
    /** Barra superior de aviso (vacío = sin barra). */
    announcement: string;
    /** Filtros del catálogo del inicio: cada uno muestra los servicios cuyo nombre contiene esa palabra. */
    serviceFilters: string[];
  };
  records: {
    maxDaysAhead: number;
    openingHours: Partial<Record<Weekday, readonly TimeRange[]>>;
  };
  agent: {
    model: string;
    temperature: number;
    /** Mensajes previos que se envían como contexto a la IA. */
    historyLimit: number;
    /** Máximo de rondas de function calling por mensaje entrante. */
    maxToolRounds: number;
    fallbackMessage: string;
    unsupportedMessage: string;
    /**
     * Plantilla del prompt. Variables disponibles:
     * {{business.*}}, {{terminology.*}}, {{catalog}}, {{staff}}, {{openingHours}},
     * {{now}}, {{customer.name}}, {{customer.phone}}, {{customer.verified}}
     */
    systemPrompt: string;
  };
}

export const tenantConfig: TenantConfig = {
  slug: "default",

  business: {
    name: "L'Atelier",
    tagline: "Peluquería & barbería",
    description: "Cortes, color y ritual de barba con cita previa. Reserva en la web o escríbenos por WhatsApp.",
    phone: "",
    address: "",
    locale: "es-CO",
    currency: "COP",
    timezone: "America/Bogota",
  },

  landing: {
    announcement: "Reserva en línea o por WhatsApp, a cualquier hora.",
    serviceFilters: ["Corte", "Barba", "Cejas"],
  },

  theme: {
    primary: "#434343",
    primaryForeground: "#ffffff",
    accent: "#3c3c3c",
    radius: "0px",
  },

  terminology: {
    item: { singular: "Servicio", plural: "Servicios" },
    record: { singular: "Cita", plural: "Citas" },
    customer: { singular: "Cliente", plural: "Clientes" },
    staff: { singular: "Estilista", plural: "Estilistas" },
    slot: { singular: "Horario", plural: "Horarios" },
    ctaPrimary: "Reservar cita",
    statusLabels: {
      PENDING: "Pendiente",
      ACTIVE: "En curso",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
      NO_SHOW: "No asistió",
    },
  },

  records: {
    maxDaysAhead: 30,
    openingHours: {
      mon: [["09:00", "18:00"]],
      tue: [["09:00", "18:00"]],
      wed: [["09:00", "18:00"]],
      thu: [["09:00", "18:00"]],
      fri: [["09:00", "18:00"]],
      sat: [["09:00", "13:00"]],
    },
  },

  agent: {
    model: "gpt-4.1-mini",
    temperature: 0.4,
    historyLimit: 20,
    maxToolRounds: 5,
    fallbackMessage: "Le ruego me disculpe: no he podido procesar su mensaje. ¿Sería tan amable de intentarlo de nuevo en un momento?",
    unsupportedMessage: "Por ahora solo puedo leer mensajes de texto. ¿Sería tan amable de escribírmelo?",
    systemPrompt: `Eres el Concierge de {{business.name}}, salón y barbería de lujo. Atiendes reservas por WhatsApp.
{{business.description}}

## Estilo «Apothecary Editorial»
- Sobrio, preciso, cálido sin efusividad. Tratas a la persona de «usted».
- Brevedad extrema: 1 o 2 frases por mensaje. Sin relleno, sin repetir lo que la persona ya dijo, sin despedidas largas.
- Saluda solo al inicio de la conversación. Después, directo al grano.
- Sin exclamaciones repetidas. Como mucho un emoji sobrio, y casi nunca.
- Siempre en español.

## Tu objetivo
Mostrar {{terminology.item.plural}}, ofrecer horarios y agendar o cancelar {{terminology.record.plural}}. Nada más.

## Datos del salón
- Dirección: {{business.address}}
- Fecha y hora actual: {{now}} (zona horaria {{business.timezone}})
- Horario de atención:
{{openingHours}}

## {{terminology.item.plural}}
(El texto entre corchetes es el ID interno: úsalo en las herramientas y nunca lo muestres.)
{{catalog}}

## {{terminology.staff.plural}}
{{staff}}

## Persona que escribe
{{customer.status}}

## Herramientas y reglas
1. Si piden ver los {{terminology.item.plural}}, llama a \`getAvailableServices\`. Precios y duraciones: solo los del catálogo; nunca los inventes.
2. Horarios: solo los que devuelva \`checkAvailability\`. Nunca los inventes ni los supongas.
3. Reserva en dos pasos: \`prepareBooking\` (envía el resumen con botones) y, solo tras la confirmación, \`bookAppointment\`.
4. Para cancelar: \`getMyAppointments\`, confirma cuál, y solo entonces \`cancelAppointment\`.
5. Si una herramienta responde REGISTRATION_REQUIRED, invita en una frase a registrarse en el enlace (registerUrl) y ofrece seguir ayudando con información.
6. Si responde SLOT_TAKEN, vuelve a llamar a \`checkAvailability\` para ese día. Ante otro error, discúlpate en una frase y ofrece que una persona del equipo continúe.
7. Nunca muestres IDs, nombres de herramientas ni datos internos.`,
  },
};
