import { Prisma, type Appointment, type AppointmentSource, type AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { todayIn } from "@/lib/format";
import type { ResolvedTenant } from "@/lib/tenant";
import { findAvailableSlots } from "./scheduling";
import { BLOCKING_STATUSES, CUSTOMER_CANCELLABLE, MANUAL_TRANSITIONS } from "./status";

// Lógica de dominio compartida por la web, el admin y el agente de WhatsApp.

export type AppointmentErrorCode =
  | "SERVICE_NOT_FOUND"
  | "STAFF_NOT_FOUND"
  | "OUT_OF_RANGE"
  | "SLOT_TAKEN"
  | "INVALID_TRANSITION"
  | "INVALID_COMPLETION";

export class AppointmentError extends Error {
  constructor(public readonly code: AppointmentErrorCode) {
    super(code);
  }
}

export interface CreateAppointmentInput {
  tenant: ResolvedTenant;
  userId: string;
  serviceId: string;
  /** null = "Cualquiera": se asigna el primer estilista libre */
  staffMemberId: string | null;
  startTime: Date;
  customerNotes?: string | null;
  source: AppointmentSource;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const { tenant } = input;

  const service = await prisma.service.findFirst({ where: { id: input.serviceId, tenantId: tenant.id, active: true } });
  if (!service) throw new AppointmentError("SERVICE_NOT_FOUND");

  const start = input.startTime;
  const end = new Date(start.getTime() + service.durationMinutes * 60_000);
  const now = new Date();
  if (start <= now || start.getTime() > now.getTime() + tenant.records.maxDaysAhead * 86_400_000) {
    throw new AppointmentError("OUT_OF_RANGE");
  }

  try {
    // Serializable: dos reservas simultáneas del mismo hueco no pueden pasar ambas la verificación.
    return await prisma.$transaction(
      async (tx) => {
        if (input.staffMemberId) {
          const staff = await tx.staffMember.findFirst({ where: { id: input.staffMemberId, tenantId: tenant.id, active: true } });
          if (!staff) throw new AppointmentError("STAFF_NOT_FOUND");
        }

        // Solo se acepta un inicio que el motor ofrecería: misma regla para web, admin y WhatsApp.
        const slots = await findAvailableSlots(tx, {
          tenant,
          day: todayIn(tenant.business.timezone, start),
          durationMinutes: service.durationMinutes,
          staffMemberId: input.staffMemberId,
          now,
        });
        const slot = slots.find((s) => s.start.getTime() === start.getTime());
        if (!slot) throw new AppointmentError("SLOT_TAKEN");

        return tx.appointment.create({
          data: {
            tenantId: tenant.id,
            userId: input.userId,
            serviceId: service.id,
            staffMemberId: slot.staffMemberIds[0] ?? null,
            startTime: start,
            endTime: end,
            source: input.source,
            customerNotes: input.customerNotes || null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new AppointmentError("SLOT_TAKEN");
    }
    throw err;
  }
}

/**
 * El cliente cancela su propia cita futura. Al pasar a CANCELLED sale de BLOCKING_STATUSES,
 * así que el motor vuelve a ofrecer ese bloque a otros clientes.
 */
export async function cancelOwnAppointment(tenantId: string, userId: string, id: string): Promise<void> {
  const { count } = await prisma.appointment.updateMany({
    where: { id, tenantId, userId, status: { in: CUSTOMER_CANCELLABLE }, startTime: { gt: new Date() } },
    data: { status: "CANCELLED" },
  });
  if (count !== 1) throw new AppointmentError("INVALID_TRANSITION");
}

/** Cambio de estado simple (sin efectos secundarios). Ver MANUAL_TRANSITIONS. */
export async function transitionAppointment(tenantId: string, id: string, to: AppointmentStatus): Promise<void> {
  const allowedFrom = Object.entries(MANUAL_TRANSITIONS)
    .filter(([, targets]) => targets?.includes(to))
    .map(([from]) => from as AppointmentStatus);

  const { count } = await prisma.appointment.updateMany({
    where: { id, tenantId, status: { in: allowedFrom } },
    data: { status: to },
  });
  if (count !== 1) throw new AppointmentError("INVALID_TRANSITION");
}

function allowedPhotoHosts(): string[] {
  return (process.env.UPLOAD_ALLOWED_HOSTS ?? "res.cloudinary.com")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

// Fotos opcionales mientras no exista subida de archivos; cuando exista, volver a exigir .min(1).
export const completionSchema = z.object({
  executionNotes: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => v || null)
    .optional(),
  photoUrls: z
    .array(
      z
        .string()
        .url()
        .refine((u) => {
          const url = new URL(u);
          return url.protocol === "https:" && allowedPhotoHosts().includes(url.hostname);
        }, "Las fotos deben venir del almacenamiento autorizado."),
    )
    .max(3, "Máximo 3 fotos.")
    .default([]),
});

export interface CompleteAppointmentInput {
  tenantId: string;
  appointmentId: string;
  /** Cuenta que confirma (estilista o admin); queda en completedById. */
  actorUserId: string;
  /** Si se indica, solo puede confirmar citas de ese estilista (panel /staff). */
  staffMemberId?: string;
  details?: unknown;
}

/**
 * PENDING/ACTIVE → COMPLETED, solo si la cita ya empezó. Guarda quién y cuándo la confirmó:
 * cita + cliente + estilista + completedAt es el registro de "servicios realizados".
 */
export async function completeAppointment(input: CompleteAppointmentInput): Promise<void> {
  const parsed = completionSchema.safeParse(input.details ?? {});
  if (!parsed.success) throw new AppointmentError("INVALID_COMPLETION");

  const now = new Date();
  const { count } = await prisma.appointment.updateMany({
    where: {
      id: input.appointmentId,
      tenantId: input.tenantId,
      status: { in: BLOCKING_STATUSES },
      startTime: { lte: now },
      ...(input.staffMemberId && { staffMemberId: input.staffMemberId }),
    },
    data: { status: "COMPLETED", completedAt: now, completedById: input.actorUserId, ...parsed.data },
  });
  if (count !== 1) throw new AppointmentError("INVALID_TRANSITION");
}

/** Marca inasistencia y suma 1 al noShowCount del cliente (atómico). */
export async function markNoShow(tenantId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({
      where: { id, tenantId, status: { in: BLOCKING_STATUSES } },
      select: { userId: true },
    });
    if (!appt) throw new AppointmentError("INVALID_TRANSITION");

    const { count } = await tx.appointment.updateMany({
      where: { id, status: { in: BLOCKING_STATUSES } },
      data: { status: "NO_SHOW" },
    });
    if (count !== 1) throw new AppointmentError("INVALID_TRANSITION");
    await tx.user.update({ where: { id: appt.userId }, data: { noShowCount: { increment: 1 } } });
  });
}
