"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDay, todayIn, zonedLocalToUtc } from "@/lib/format";
import { getCurrentTenant, type ResolvedTenant } from "@/lib/tenant";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import {
  AppointmentError,
  type AppointmentErrorCode,
  createBooking,
  findBookingServices,
  MAX_SERVICES_PER_BOOKING,
} from "@/modules/appointments/service";

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
/** Servicio principal + adicionales, en orden; los horarios se calculan con la duración total. */
const serviceIdsSchema = z.array(idSchema).min(1).max(MAX_SERVICES_PER_BOOKING);
const staffSchema = z.union([z.literal("any"), idSchema]);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function slotsFor(tenant: ResolvedTenant, serviceIds: string[], staffMemberId: string, day: string): Promise<string[]> {
  const services = await findBookingServices(tenant.id, serviceIds);
  if (!services) return [];

  const slots = await findAvailableSlots(prisma, {
    tenant,
    day,
    durationMinutes: services.reduce((sum, s) => sum + s.durationMinutes, 0),
    staffMemberId: staffMemberId === "any" ? null : staffMemberId,
  });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return slots.map((s) => time.format(s.start));
}

/** Horarios libres ("HH:mm") de un día concreto. */
export async function loadDaySlots(serviceIds: string[], staffMemberId: string, day: string): Promise<string[]> {
  if (!serviceIdsSchema.safeParse(serviceIds).success || !staffSchema.safeParse(staffMemberId).success || !daySchema.safeParse(day).success) {
    return [];
  }
  return slotsFor(await getCurrentTenant(), serviceIds, staffMemberId, day);
}

/** Primer día con horarios libres desde hoy. */
export async function loadNextSlots(serviceIds: string[], staffMemberId: string): Promise<NextSlots> {
  if (!serviceIdsSchema.safeParse(serviceIds).success || !staffSchema.safeParse(staffMemberId).success) return { day: null, slots: [] };

  const tenant = await getCurrentTenant();
  const today = todayIn(tenant.business.timezone);
  for (let i = 0; i < Math.min(SEARCH_DAYS, tenant.records.maxDaysAhead + 1); i++) {
    const day = shiftDay(today, i);
    const slots = await slotsFor(tenant, serviceIds, staffMemberId, day);
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
  serviceIds: serviceIdsSchema,
  staffMemberId: staffSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Selecciona un horario."),
  customerNotes: z.string().trim().max(500).optional(),
});

const ERROR_MESSAGES: Partial<Record<AppointmentErrorCode, string>> = {
  SERVICE_NOT_FOUND: "Alguno de los servicios seleccionados ya no está disponible.",
  STAFF_NOT_FOUND: "Ese estilista ya no está disponible.",
  OUT_OF_RANGE: "Elige una fecha futura dentro del rango permitido.",
  SLOT_TAKEN: "Ese horario ya no está disponible. Prueba con otro.",
};

export async function submitBooking(_prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Inicia sesión para reservar." };
  const tenant = await getCurrentTenant();

  const parsed = bookingSchema.safeParse({
    serviceIds: fd.getAll("serviceIds"),
    staffMemberId: fd.get("staffMemberId") || "any",
    date: fd.get("date"),
    customerNotes: fd.get("customerNotes") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  const startTime = zonedLocalToUtc(parsed.data.date, tenant.business.timezone);
  if (!startTime) return { status: "error", message: "Fecha inválida." };

  try {
    await createBooking({
      tenant,
      userId: user.id,
      serviceIds: parsed.data.serviceIds,
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

  const message = parsed.data.serviceIds.length > 1 ? "Tus servicios quedaron reservados." : "Tu cita quedó registrada.";
  return { status: "success", message: `${message} Te confirmaremos por WhatsApp.` };
}
