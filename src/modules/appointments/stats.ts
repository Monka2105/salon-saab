import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Seguimiento de servicios realizados. La fuente es la propia cita en estado COMPLETED:
// cliente (userId) + estilista (staffMemberId) + cuándo (completedAt) + quién confirmó (completedById).

export interface Period {
  from: Date;
  to: Date;
}

export interface StaffTotals {
  completed: number;
  /** Clientes distintos atendidos */
  clients: number;
}

function completedWhere(tenantId: string, period?: Period, staffMemberId?: string): Prisma.AppointmentWhereInput {
  return {
    tenantId,
    status: "COMPLETED",
    ...(staffMemberId && { staffMemberId }),
    ...(period && { completedAt: { gte: period.from, lt: period.to } }),
  };
}

/** Servicios realizados y clientes distintos por estilista (clave null = citas sin estilista). */
export async function completedByStaff(tenantId: string, period?: Period): Promise<Map<string | null, StaffTotals>> {
  const where = completedWhere(tenantId, period);
  const [services, pairs] = await Promise.all([
    prisma.appointment.groupBy({ by: ["staffMemberId"], where, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["staffMemberId", "userId"], where }),
  ]);

  const totals = new Map<string | null, StaffTotals>();
  for (const row of services) totals.set(row.staffMemberId, { completed: row._count._all, clients: 0 });
  for (const pair of pairs) totals.get(pair.staffMemberId)!.clients += 1;
  return totals;
}

/** Totales de un estilista (para su panel). */
export async function staffTotals(tenantId: string, staffMemberId: string, period?: Period): Promise<StaffTotals> {
  const where = completedWhere(tenantId, period, staffMemberId);
  const [completed, pairs] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({ by: ["userId"], where }),
  ]);
  return { completed, clients: pairs.length };
}

export interface ClientServed {
  userId: string;
  name: string | null;
  phoneNumber: string | null;
  email: string | null;
  services: number;
  lastVisit: Date | null;
}

/** Clientes que atendió un estilista, de más a menos servicios. */
export async function clientsServedBy(tenantId: string, staffMemberId: string, period?: Period): Promise<ClientServed[]> {
  const rows = await prisma.appointment.groupBy({
    by: ["userId"],
    where: completedWhere(tenantId, period, staffMemberId),
    _count: { _all: true },
    _max: { completedAt: true },
    orderBy: { _count: { userId: "desc" } },
    take: 200,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, phoneNumber: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = byId.get(r.userId);
    return {
      userId: r.userId,
      name: u?.name ?? null,
      phoneNumber: u?.phoneNumber ?? null,
      email: u?.email ?? null,
      services: r._count._all,
      lastVisit: r._max.completedAt,
    };
  });
}

export interface ServiceCount {
  serviceId: string;
  title: string;
  count: number;
}

/** Cuántas veces realizó un estilista cada servicio, de más a menos. */
export async function servicesByType(tenantId: string, staffMemberId: string, period?: Period): Promise<ServiceCount[]> {
  const rows = await prisma.appointment.groupBy({
    by: ["serviceId"],
    where: completedWhere(tenantId, period, staffMemberId),
    _count: { _all: true },
    orderBy: { _count: { serviceId: "desc" } },
  });
  const services = await prisma.service.findMany({ where: { id: { in: rows.map((r) => r.serviceId) } }, select: { id: true, title: true } });
  const titles = new Map(services.map((s) => [s.id, s.title]));
  return rows.map((r) => ({ serviceId: r.serviceId, title: titles.get(r.serviceId) ?? "Servicio eliminado", count: r._count._all }));
}

/** Cada servicio realizado por un estilista en el periodo, del más reciente al más antiguo. */
export async function completedServices(tenantId: string, staffMemberId: string, period?: Period, take = 200) {
  return prisma.appointment.findMany({
    where: completedWhere(tenantId, period, staffMemberId),
    orderBy: { completedAt: "desc" },
    take,
    select: {
      id: true,
      startTime: true,
      completedAt: true,
      executionNotes: true,
      user: { select: { name: true, phoneNumber: true } },
      service: { select: { title: true } },
      completedBy: { select: { name: true, email: true } },
    },
  });
}

export type CompletedService = Awaited<ReturnType<typeof completedServices>>[number];

export interface ServiceNote {
  id: string;
  startTime: Date;
  note: string;
  client: { name: string | null; phoneNumber: string | null };
}

/** Notas que dejó el estilista al confirmar, agrupadas por servicio (las más recientes primero). */
export async function notesByService(tenantId: string, staffMemberId: string, perService = 5): Promise<Map<string, ServiceNote[]>> {
  const rows = await prisma.appointment.findMany({
    where: { ...completedWhere(tenantId, undefined, staffMemberId), executionNotes: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 300,
    select: { id: true, serviceId: true, startTime: true, executionNotes: true, user: { select: { name: true, phoneNumber: true } } },
  });

  const byService = new Map<string, ServiceNote[]>();
  for (const r of rows) {
    const list = byService.get(r.serviceId) ?? [];
    if (list.length < perService) list.push({ id: r.id, startTime: r.startTime, note: r.executionNotes!, client: r.user });
    byService.set(r.serviceId, list);
  }
  return byService;
}
