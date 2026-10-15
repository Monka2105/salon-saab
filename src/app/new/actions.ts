"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { zonedLocalToUtc } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { findAvailableSlots } from "@/modules/appointments/scheduling";
import { AppointmentError, type AppointmentErrorCode, createAppointment } from "@/modules/appointments/service";

export interface BookingFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

const bookingSchema = z.object({
  serviceId: z.string().cuid(),
  staffMemberId: z.union([z.literal("any"), z.string().cuid()]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Selecciona un horario."),
  customerNotes: z.string().trim().max(500).optional(),
});

const ERROR_MESSAGES: Partial<Record<AppointmentErrorCode, string>> = {
  SERVICE_NOT_FOUND: "El servicio seleccionado ya no está disponible.",
  STAFF_NOT_FOUND: "Ese estilista ya no está disponible.",
  OUT_OF_RANGE: "Elige una fecha futura dentro del rango permitido.",
  SLOT_TAKEN: "Ese horario ya no está disponible. Prueba con otro.",
};

export interface SlotOption {
  /** "YYYY-MM-DDTHH:mm" en la zona horaria del negocio (lo que envía el formulario). */
  value: string;
  /** "HH:mm" */
  label: string;
}

const slotQuerySchema = z.object({
  serviceId: z.string().cuid(),
  staffMemberId: z.union([z.literal("any"), z.string().cuid()]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Smart Slots de un día para el selector de horarios. */
export async function loadSlots(serviceId: string, staffMemberId: string, day: string): Promise<SlotOption[]> {
  await requireUser("/new");
  const tenant = await getCurrentTenant();
  const parsed = slotQuerySchema.safeParse({ serviceId, staffMemberId, day });
  if (!parsed.success) return [];

  const service = await prisma.service.findFirst({ where: { id: parsed.data.serviceId, tenantId: tenant.id, active: true } });
  if (!service) return [];

  const slots = await findAvailableSlots(prisma, {
    tenant,
    day: parsed.data.day,
    durationMinutes: service.durationMinutes,
    staffMemberId: parsed.data.staffMemberId === "any" ? null : parsed.data.staffMemberId,
  });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return slots.map((s) => {
    const label = time.format(s.start);
    return { value: `${parsed.data.day}T${label}`, label };
  });
}

export async function submitBooking(_prev: BookingFormState, fd: FormData): Promise<BookingFormState> {
  const user = await requireUser("/new");
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
