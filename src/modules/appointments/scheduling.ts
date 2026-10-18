import type { Prisma, PrismaClient } from "@prisma/client";
import { shiftDay, timeToMinutes, todayIn, weekdayOf, zonedDayMinutesToUtc } from "@/lib/format";
import type { ResolvedTenant } from "@/lib/tenant";
import { BLOCKING_STATUSES } from "./status";

// Motor de agendamiento (Smart Slots).
//
//   libre = Availability del día − TimeOff − citas que bloquean
//
// Dentro de cada tramo libre los horarios se encadenan con paso = duración del servicio:
// 09:00, 09:00 + d, 09:00 + 2d… mientras el servicio quepa completo. Como cada cita corta el
// tramo, el primer horario tras una cita es exactamente su endTime (60 min a las 9:00 → 10:00;
// 20 min a las 9:00 → 9:20).

type Db = PrismaClient | Prisma.TransactionClient;

const MINUTE = 60_000;

/** Intervalo semiabierto [start, end) en milisegundos epoch. */
export interface Interval {
  start: number;
  end: number;
}

/** Ordena y fusiona intervalos solapados o contiguos (9–12 + 12–18 = 9–18). */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const i of sorted) {
    const last = merged.at(-1);
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else merged.push({ ...i });
  }
  return merged;
}

/** base − cuts: devuelve los tramos de `base` que no toca ningún `cut`. */
export function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  let free = mergeIntervals(base);
  for (const cut of mergeIntervals(cuts)) {
    free = free.flatMap((f) => {
      if (cut.end <= f.start || cut.start >= f.end) return [f];
      const pieces: Interval[] = [];
      if (cut.start > f.start) pieces.push({ start: f.start, end: cut.start });
      if (cut.end < f.end) pieces.push({ start: cut.end, end: f.end });
      return pieces;
    });
  }
  return free;
}

export interface SlotInput {
  /** Horario de trabajo del día. */
  windows: Interval[];
  /** TimeOff + citas existentes. */
  busy: Interval[];
  durationMinutes: number;
  /** Se descartan inicios fuera de [notBefore, notAfter] (p. ej. horas ya pasadas). */
  notBefore?: number;
  notAfter?: number;
}

/** Inicios disponibles (ms epoch), ordenados. Función pura: no toca la base de datos. */
export function computeSlots({ windows, busy, durationMinutes, notBefore = -Infinity, notAfter = Infinity }: SlotInput): number[] {
  const duration = durationMinutes * MINUTE;
  if (!(duration > 0)) return [];

  const slots: number[] = [];
  for (const free of subtractIntervals(windows, busy)) {
    for (let t = free.start; t + duration <= free.end; t += duration) {
      if (t >= notBefore && t <= notAfter) slots.push(t);
    }
  }
  return slots;
}

// ── Carga desde la base de datos ─────────────────────────────

export interface DaySlot {
  start: Date;
  end: Date;
  /** Estilistas libres en ese horario, en orden de asignación. Vacío si el negocio no tiene estilistas. */
  staffMemberIds: string[];
}

export interface FindSlotsParams {
  tenant: ResolvedTenant;
  /** "YYYY-MM-DD" en la zona horaria del negocio. */
  day: string;
  durationMinutes: number;
  /** null = "Cualquiera": unión de los horarios de todos los estilistas. */
  staffMemberId: string | null;
  /** Si el servicio tiene estilistas asignados, solo ellos se ofrecen (y pedir otro no da horarios). */
  serviceId?: string;
  now?: Date;
}

/** Estilistas obligatorios del servicio; vacío = lo puede hacer cualquiera. */
export async function serviceStaffIds(db: Db, serviceId: string): Promise<string[]> {
  const rows = await db.staffMember.findMany({ where: { services: { some: { id: serviceId } } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function findAvailableSlots(db: Db, params: FindSlotsParams): Promise<DaySlot[]> {
  const { tenant, day, durationMinutes, staffMemberId } = params;
  const tz = tenant.business.timezone;
  const now = params.now ?? new Date();

  const today = todayIn(tz, now);
  if (day < today || day > shiftDay(today, tenant.records.maxDaysAhead)) return [];

  const dayStart = zonedDayMinutesToUtc(day, 0, tz);
  const dayEnd = zonedDayMinutesToUtc(day, 1440, tz);
  if (!dayStart || !dayEnd) return [];

  const toInterval = (startMinutes: number, endMinutes: number): Interval => ({
    start: zonedDayMinutesToUtc(day, startMinutes, tz)!.getTime(),
    end: zonedDayMinutesToUtc(day, endMinutes, tz)!.getTime(),
  });
  const weekday = weekdayOf(day);
  // Horario del negocio: respaldo para estilistas sin horario propio (o negocios sin estilistas).
  const openingWindows = (tenant.records.openingHours[weekday] ?? []).map(([a, b]) => toInterval(timeToMinutes(a), timeToMinutes(b)));
  const overlapsDay = { startTime: { lt: dayEnd }, endTime: { gt: dayStart } };
  const limits = { notBefore: now.getTime(), notAfter: now.getTime() + tenant.records.maxDaysAhead * 86_400_000 };

  const required = params.serviceId ? await serviceStaffIds(db, params.serviceId) : [];
  if (staffMemberId && required.length && !required.includes(staffMemberId)) return [];

  const staff = await db.staffMember.findMany({
    where: {
      tenantId: tenant.id,
      active: true,
      ...(staffMemberId ? { id: staffMemberId } : required.length && { id: { in: required } }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      availability: { where: { weekday }, select: { startMinutes: true, endMinutes: true } },
      timeOff: { where: overlapsDay, select: { startTime: true, endTime: true } },
    },
  });

  const appointments = await db.appointment.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: BLOCKING_STATUSES },
      ...overlapsDay,
      ...(staff.length && { staffMemberId: { in: staff.map((s) => s.id) } }),
    },
    select: { staffMemberId: true, startTime: true, endTime: true },
  });
  const asInterval = (r: { startTime: Date; endTime: Date }): Interval => ({ start: r.startTime.getTime(), end: r.endTime.getTime() });

  if (!staff.length) {
    // Estilista pedido (u obligatorio) inexistente o inactivo → sin horarios. Negocio sin estilistas → el salón es un único recurso.
    if (staffMemberId || required.length) return [];
    return computeSlots({ windows: openingWindows, busy: appointments.map(asInterval), durationMinutes, ...limits }).map((t) => ({
      start: new Date(t),
      end: new Date(t + durationMinutes * MINUTE),
      staffMemberIds: [],
    }));
  }

  const byStart = new Map<number, string[]>();
  for (const s of staff) {
    const windows = s.availability.length ? s.availability.map((a) => toInterval(a.startMinutes, a.endMinutes)) : openingWindows;
    const busy = [...s.timeOff, ...appointments.filter((a) => a.staffMemberId === s.id)].map(asInterval);
    for (const t of computeSlots({ windows, busy, durationMinutes, ...limits })) {
      byStart.set(t, [...(byStart.get(t) ?? []), s.id]);
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, staffMemberIds]) => ({ start: new Date(t), end: new Date(t + durationMinutes * MINUTE), staffMemberIds }));
}
