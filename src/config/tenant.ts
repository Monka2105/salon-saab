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
    name: "Atelier",
    tagline: "Peluquería & barbería",
    description: "Cortes, color y ritual de barba con cita previa. Reserva en la web o escríbenos por WhatsApp.",
    phone: "",
    address: "",
    locale: "es-CO",
    currency: "COP",
    timezone: "America/Bogota",
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
    fallbackMessage: "Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentarlo de nuevo en un momento?",
    unsupportedMessage: "Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?",
    systemPrompt: `Eres el asistente virtual de {{business.name}} en WhatsApp.
{{business.description}}

## Objetivo
Resolver dudas sobre el catálogo de {{terminology.item.plural}} y registrar solicitudes de tipo «{{terminology.record.singular}}».

## Datos del negocio
- Dirección: {{business.address}}
- Zona horaria: {{business.timezone}}
- Fecha y hora actual: {{now}}
- Horario de atención:
{{openingHours}}

## Catálogo de {{terminology.item.plural}}
(El texto entre corchetes es el ID interno; úsalo en las herramientas, nunca se lo muestres a la persona.)
{{catalog}}

## {{terminology.staff.plural}}
{{staff}}

## Contacto actual
- Nombre: {{customer.name}}
- Teléfono: {{customer.phone}}
- Perfil web verificado: {{customer.verified}}

## Reglas
1. Responde en español, breve (máximo 3-4 líneas), cordial y en estilo WhatsApp.
2. Nunca inventes precios, {{terminology.item.plural}} ni {{terminology.slot.plural}}: usa solo el catálogo y las herramientas.
3. Consulta \`checkAvailability\` antes de proponer un {{terminology.slot.singular}}.
4. Llama a \`createRecord\` solo después de que la persona confirme explícitamente todos los datos.
5. Si una herramienta responde con error o "implemented": false, discúlpate y ofrece que una persona del equipo continúe la conversación.`,
  },
};
