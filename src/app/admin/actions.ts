"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Terminology } from "@/config/tenant";
import { signOut } from "@/auth";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDay, timeToMinutes, toMinorUnits, WEEKDAYS, zonedLocalToUtc } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { markNoShow, transitionAppointment } from "@/modules/appointments/service";
import { BLOCKING_STATUSES } from "@/modules/appointments/status";
import { isAppointmentStatus } from "@/modules/appointments/status";

// Cada acción llama a requireAdmin(): las Server Actions son endpoints POST públicos.

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();
const nullable = (fd: FormData, name: string) => text(fd, name) || null;
const idSchema = z.string().cuid();

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// ── Citas ─────────────────────────────────────────────────────

export async function updateAppointmentStatus(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  const status = text(formData, "status");
  if (!id.success || !isAppointmentStatus(status)) return;

  await transitionAppointment(tenant.id, id.data, status).catch(() => undefined);
  revalidatePath("/admin");
}

export async function markAppointmentNoShow(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  if (!id.success) return;

  await markNoShow(tenant.id, id.data).catch(() => undefined);
  revalidatePath("/admin");
}

// ── Servicios ─────────────────────────────────────────────────

const serviceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable(),
  price: z.number().int().nonnegative(),
  durationMinutes: z.number().int().min(5).max(600),
  imageUrl: z.string().url().startsWith("https://").nullable(),
  sortOrder: z.number().int(),
});

function parseService(formData: FormData, business: Parameters<typeof toMinorUnits>[1]) {
  return serviceSchema.safeParse({
    title: text(formData, "title"),
    description: nullable(formData, "description"),
    price: toMinorUnits(text(formData, "price"), business),
    durationMinutes: Number(text(formData, "durationMinutes")),
    imageUrl: nullable(formData, "imageUrl"),
    sortOrder: Number(text(formData, "sortOrder")) || 0,
  });
}

/** El catálogo público, /new y el agente leen servicios: se revalidan junto con el admin. */
function revalidateServices() {
  revalidatePath("/admin/services");
  revalidatePath("/catalog");
  revalidatePath("/new");
}

export async function createService(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const parsed = parseService(formData, tenant.business);
  if (!parsed.success) return;

  await prisma.service.create({ data: { tenantId: tenant.id, ...parsed.data } });
  revalidateServices();
}

export async function updateService(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  const parsed = parseService(formData, tenant.business);
  if (!id.success || !parsed.success) return;

  // La duración nueva aplica a las citas futuras; las ya agendadas conservan su endTime.
  await prisma.service.updateMany({ where: { id: id.data, tenantId: tenant.id, active: true }, data: parsed.data });
  revalidateServices();
}

/**
 * Sin citas → se borra. Con citas (aunque sean antiguas) se archiva: Appointment.service es
 * onDelete: Restrict y el historial del cliente debe conservar qué servicio recibió.
 */
export async function deleteService(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  if (!id.success) return;

  const where = { id: id.data, tenantId: tenant.id };
  const hasAppointments = (await prisma.appointment.count({ where: { serviceId: id.data, tenantId: tenant.id } })) > 0;
  if (hasAppointments) await prisma.service.updateMany({ where, data: { active: false } });
  else await prisma.service.deleteMany({ where });
  revalidateServices();
}

// ── Estilistas ────────────────────────────────────────────────

const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  specialty: z.string().trim().max(80).nullable(),
});

const parseStaff = (formData: FormData) =>
  staffSchema.safeParse({ name: text(formData, "name"), specialty: nullable(formData, "specialty") });

/** El selector de estilista aparece en el catálogo, en /new y en la agenda. */
function revalidateStaff() {
  revalidatePath("/admin/availability");
  revalidatePath("/admin");
  revalidatePath("/catalog");
  revalidatePath("/new");
}

export async function createStaff(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const parsed = parseStaff(formData);
  if (!parsed.success) return;

  const staff = await prisma.staffMember.create({ data: { tenantId: tenant.id, ...parsed.data } });
  revalidateStaff();
  redirect(`/admin/availability?staff=${staff.id}`);
}

export async function updateStaff(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  const parsed = parseStaff(formData);
  if (!id.success || !parsed.success) return;

  await prisma.staffMember.updateMany({ where: { id: id.data, tenantId: tenant.id, active: true }, data: parsed.data });
  revalidateStaff();
}

/**
 * Con citas próximas no se elimina: esos clientes quedarían sin estilista.
 * Con citas pasadas se archiva (el historial conserva quién atendió); sin ninguna, se borra.
 */
export async function deleteStaff(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  if (!id.success) return { error: "Estilista inválido." };

  const upcoming = await prisma.appointment.count({
    where: { staffMemberId: id.data, tenantId: tenant.id, status: { in: BLOCKING_STATUSES }, endTime: { gt: new Date() } },
  });
  if (upcoming > 0) {
    return {
      error: `Tiene ${upcoming} ${upcoming === 1 ? "cita próxima" : "citas próximas"}. Cancélalas o espera a que pasen; si solo cambió la persona, usa Editar.`,
    };
  }

  const where = { id: id.data, tenantId: tenant.id };
  const hasHistory = (await prisma.appointment.count({ where: { staffMemberId: id.data, tenantId: tenant.id } })) > 0;
  if (hasHistory) await prisma.staffMember.updateMany({ where, data: { active: false } });
  else await prisma.staffMember.deleteMany({ where });
  revalidateStaff();
  return {};
}

// ── Disponibilidad ────────────────────────────────────────────

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function findTenantStaff(tenantId: string, raw: string) {
  const id = idSchema.safeParse(raw);
  if (!id.success) return null;
  return prisma.staffMember.findFirst({ where: { id: id.data, tenantId }, select: { id: true } });
}

/** Reemplaza el horario semanal del estilista (un rango por día; vacío = no trabaja ese día). */
export async function saveAvailability(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const staff = await findTenantStaff(tenant.id, text(formData, "staffMemberId"));
  if (!staff) return;

  const rows = [];
  for (const weekday of WEEKDAYS) {
    const start = text(formData, `${weekday}-start`);
    const end = text(formData, `${weekday}-end`);
    if (!start && !end) continue;
    // "00:00" como cierre = medianoche (fin del día)
    const startMinutes = timeSchema.safeParse(start).success ? timeToMinutes(start) : NaN;
    const endMinutes = timeSchema.safeParse(end).success ? timeToMinutes(end) || 1440 : NaN;
    if (!(startMinutes < endMinutes)) return; // rango incompleto o invertido: no se guarda nada
    rows.push({ staffMemberId: staff.id, weekday, startMinutes, endMinutes });
  }

  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { staffMemberId: staff.id } }),
    prisma.availability.createMany({ data: rows }),
  ]);
  revalidatePath("/admin/availability");
}

/** Bloquea días completos (sin horas) o un rango horario concreto. */
export async function createTimeOff(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const staff = await findTenantStaff(tenant.id, text(formData, "staffMemberId"));
  if (!staff) return;

  const fromDay = daySchema.safeParse(text(formData, "fromDay"));
  const toDay = daySchema.safeParse(text(formData, "toDay") || text(formData, "fromDay"));
  if (!fromDay.success || !toDay.success || toDay.data < fromDay.data) return;

  const fromTime = text(formData, "fromTime");
  const toTime = text(formData, "toTime");
  const allDay = !fromTime && !toTime;
  if (!allDay && !(timeSchema.safeParse(fromTime).success && timeSchema.safeParse(toTime).success)) return;

  const tz = tenant.business.timezone;
  const startTime = zonedLocalToUtc(`${fromDay.data}T${allDay ? "00:00" : fromTime}`, tz);
  const endTime = allDay ? zonedLocalToUtc(`${shiftDay(toDay.data, 1)}T00:00`, tz) : zonedLocalToUtc(`${toDay.data}T${toTime}`, tz);
  if (!startTime || !endTime || endTime <= startTime) return;

  await prisma.timeOff.create({
    data: { staffMemberId: staff.id, startTime, endTime, reason: nullable(formData, "reason")?.slice(0, 200) ?? null },
  });
  revalidatePath("/admin/availability");
}

export async function deleteTimeOff(formData: FormData) {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const id = idSchema.safeParse(text(formData, "id"));
  if (!id.success) return;

  await prisma.timeOff.deleteMany({ where: { id: id.data, staffMember: { tenantId: tenant.id } } });
  revalidatePath("/admin/availability");
}

// ── Settings ──────────────────────────────────────────────────

export interface SettingsState {
  status: "idle" | "saved" | "error";
  message?: string;
}

export async function updateSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const tenant = await getCurrentTenant();

  const terminology = nullable(formData, "terminology");
  if (terminology) {
    try {
      JSON.parse(terminology) as Partial<Terminology>;
    } catch {
      return { status: "error", message: "La terminología no es un JSON válido." };
    }
  }

  const timezone = nullable(formData, "timezone");
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      return { status: "error", message: `Zona horaria inválida: ${timezone}` };
    }
  }

  try {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: nullable(formData, "name"),
        tagline: nullable(formData, "tagline"),
        description: nullable(formData, "description"),
        phone: nullable(formData, "phone")?.replace(/\D/g, "") || null,
        address: nullable(formData, "address"),
        timezone,
        primaryColor: nullable(formData, "primaryColor"),
        accentColor: nullable(formData, "accentColor"),
        whatsappPhoneNumberId: nullable(formData, "whatsappPhoneNumberId"),
        systemPrompt: nullable(formData, "systemPrompt"),
        terminology,
      },
    });
  } catch (err) {
    console.error("[admin] settings update failed", err);
    return { status: "error", message: "No se pudo guardar. ¿El phone_number_id ya está en uso por otro tenant?" };
  }

  revalidatePath("/", "layout");
  return { status: "saved", message: "Cambios guardados." };
}
