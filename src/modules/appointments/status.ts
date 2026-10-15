import type { AppointmentStatus } from "@prisma/client";

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"];

/** Estados que ocupan agenda: bloquean el horario del estilista. */
export const BLOCKING_STATUSES: AppointmentStatus[] = ["PENDING", "ACTIVE"];

/** Estados que el cliente puede cancelar por su cuenta (una cita en curso solo la cancela el salón). */
export const CUSTOMER_CANCELLABLE: AppointmentStatus[] = ["PENDING"];

/**
 * Transiciones que el admin puede hacer con un simple cambio de estado.
 * ACTIVE → COMPLETED NO está aquí: exige notas de ejecución + fotos (ver completeAppointment).
 * → NO_SHOW tampoco: incrementa noShowCount (ver markNoShow).
 */
export const MANUAL_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PENDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PENDING", "CANCELLED"],
};

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}
