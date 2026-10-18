"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDay, todayIn, zonedLocalToUtc } from "@/lib/format";
import { getCurrentTenant, type ResolvedTenant } from "@/lib/tenant";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import { AppointmentError, type AppointmentErrorCode, createAppointment } from "@/modules/appointments/service";

// Reserva desde la página de cada servicio (/servicios/[id]).
// Consultar horarios es público (solo expone horas libres, igual que el agente de WhatsApp);
// reservar exige sesión.

export interface NextSlots {
  /** "YYYY-MM-DD" del primer día con horarios, o null si no hay en el rango buscado. */
  day: string | null;
  /** "HH:mm" en la zona horaria del negocio. */
  slots: string[];
}

/** Días que se buscan hacia adelante desde hoy para el primer día libre. */
const SEARCH_DAYS = 14;

const idSchema = z.string().cuid();
const staffSchema = z.union([z.literal("any"), idSchema]);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function slotsFor(tenant: ResolvedTenant, serviceId: string, staffMemberId: string, day: string): Promise<string[]> {
  const service = await prisma.service.findFirst({ where: { id: serviceId, tenantId: tenant.id, active: true } });
  if (!service) return [];

  const slots = await findAvailableSlots(prisma, {
    tenant,
    day,
    durationMinutes: service.durationMinutes,
    staffMemberId: staffMemberId === "any" ? null : staffMemberId,
    serviceId: service.id,
  });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return slots.map((s) => time.format(s.start));
}

/** Horarios libres ("HH:mm") de un día concreto. */
export async function loadDaySlots(serviceId: string, staffMemberId: string, day: string): Promise<string[]> {
  if (!idSchema.safeParse(serviceId).success || !staffSchema.safeParse(staffMemberId).success || !daySchema.safeParse(day).success) {
    return [];
  }
  return slotsFor(await getCurrentTenant(), serviceId, staffMemberId, day);
}

/** Primer día con horarios libres desde hoy. */
export async function loadNextSlots(serviceId: string, staffMemberId: string): Promise<NextSlots> {
  if (!idSchema.safeParse(serviceId).success || !staffSchema.safeParse(staffMemberId).success) return { day: null, slots: [] };

  const tenant = await getCurrentTenant();
  const today = todayIn(tenant.business.timezone);
  for (let i = 0; i < Math.min(SEARCH_DAYS, tenant.records.maxDaysAhead + 1); i++) {
    const day = shiftDay(today, i);
    const slots = await slotsFor(tenant, serviceId, staffMemberId, day);
    if (slots.length) return { day, slots };
  }
  return { day: null, slots: [] };
}

// ── Reserva ──────────────────────────────────────────────────

export interface BookingFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

const bookingSchema = z.object({
  serviceId: idSchema,
  staffMemberId: staffSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Selecciona un horario."),
  customerNotes: z.string().trim().max(500).optional(),
});

const ERROR_MESSAGES: Partial<Record<AppointmentErrorCode, string>> = {
  SERVICE_NOT_FOUND: "El servicio seleccionado ya no está disponible.",
  STAFF_NOT_FOUND: "Ese estilista ya no está disponible.",
  STAFF_NOT_ALLOWED: "Este servicio lo realiza otro estilista. Elige uno de los disponibles.",
  OUT_OF_RANGE: "Elige una fecha futura dentro del rango permitido.",
  SLOT_TAKEN: "Ese horario ya no está disponible. Prueba con otro.",
};

export async function submitBooking(_prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Inicia sesión para reservar." };
  const tenant = await getCurrentTenant();

  const parsed = bookingSchema.safeParse({
    serviceId: fd.get("serviceId"),
    staffMemberId: fd.get("staffMemberId") || "any",
    date: fd.get("date"),
    customerNotes: fd.get("customerNotes") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  const startTime = zonedLocalToUtc(parsed.data.date, tenant.business.timezone);
  if (!startTime) return { status: "error", message: "Fecha inválida." };

  try {
    await createAppointment({
      tenant,
      userId: user.id,
      serviceId: parsed.data.serviceId,
      staffMemberId: parsed.data.staffMemberId === "any" ? null : parsed.data.staffMemberId,
      startTime,
      customerNotes: parsed.data.customerNotes,
      source: "WEB",
    });
  } catch (err) {
    if (err instanceof AppointmentError && ERROR_MESSAGES[err.code]) {
      return { status: "error", message: ERROR_MESSAGES[err.code] };
    }
    console.error("[appointments] create failed", err);
    return { status: "error", message: "No pudimos registrar tu cita. Intenta de nuevo." };
  }

  return { status: "success", message: "Tu cita quedó registrada. Te confirmaremos por WhatsApp." };
}
