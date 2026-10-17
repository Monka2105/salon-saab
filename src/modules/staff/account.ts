import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

// Vincula una ficha de estilista con la cuenta con la que inicia sesión.
// La cuenta pasa a rol STAFF; al desvincularla vuelve a USER. Un ADMIN conserva su rol.

export type StaffAccountError = "NO_ACCOUNT" | "ALREADY_LINKED";

/** Devuelve un error o null. Llamar dentro de una transacción. */
export async function setStaffAccount(
  tx: Prisma.TransactionClient,
  staffMemberId: string,
  email: string | null,
): Promise<StaffAccountError | null> {
  const staff = await tx.staffMember.findUniqueOrThrow({ where: { id: staffMemberId }, select: { userId: true } });

  const next = email ? await tx.user.findUnique({ where: { email }, include: { staffProfile: { select: { id: true } } } }) : null;
  if (email && !next) return "NO_ACCOUNT";
  if (next?.staffProfile && next.staffProfile.id !== staffMemberId) return "ALREADY_LINKED";
  if (staff.userId === (next?.id ?? null)) return null;

  if (staff.userId) await releaseStaffAccount(tx, staffMemberId);
  if (next) {
    await tx.staffMember.update({ where: { id: staffMemberId }, data: { userId: next.id } });
    if (next.role === "USER") await tx.user.update({ where: { id: next.id }, data: { role: "STAFF" } });
  }
  return null;
}

/** Desvincula la cuenta de la ficha (al cambiar de persona, archivar o eliminar al estilista). */
export async function releaseStaffAccount(tx: Prisma.TransactionClient, staffMemberId: string): Promise<void> {
  const staff = await tx.staffMember.findUnique({ where: { id: staffMemberId }, select: { userId: true } });
  if (!staff?.userId) return;
  await tx.staffMember.update({ where: { id: staffMemberId }, data: { userId: null } });
  await tx.user.updateMany({ where: { id: staff.userId, role: "STAFF" }, data: { role: "USER" } });
}

export type ChangeRoleError = "SELF" | "LAST_ADMIN" | "USER_NOT_FOUND" | "STAFF_NOT_FOUND" | "STAFF_TAKEN";

export interface ChangeRoleInput {
  tenantId: string;
  /** Admin que hace el cambio: no puede cambiar su propio rol. */
  actorId: string;
  userId: string;
  role: Role;
  /** Solo para STAFF: ficha a vincular, "new" = crear una con el nombre del usuario, undefined = conservar la actual. */
  staffMemberId?: string | "new";
}

/**
 * Cambia el rol de una cuenta desde Admin → Usuarios, manteniendo coherente la ficha de estilista:
 * STAFF siempre queda vinculado a una ficha; USER pierde su ficha (queda libre para otra persona);
 * ADMIN conserva la suya si la tenía (un admin puede atender).
 */
export async function changeUserRole(input: ChangeRoleInput): Promise<ChangeRoleError | null> {
  if (input.userId === input.actorId) return "SELF";

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, include: { staffProfile: { select: { id: true } } } });
    if (!user) return "USER_NOT_FOUND";
    if (user.role === "ADMIN" && input.role !== "ADMIN" && (await tx.user.count({ where: { role: "ADMIN" } })) <= 1) return "LAST_ADMIN";

    const current = user.staffProfile?.id ?? null;

    if (input.role === "USER") {
      if (current) await tx.staffMember.update({ where: { id: current }, data: { userId: null } });
    }

    if (input.role === "STAFF") {
      let target = current;
      if (input.staffMemberId === "new") {
        const created = await tx.staffMember.create({
          data: { tenantId: input.tenantId, name: user.name ?? user.email?.split("@")[0] ?? "Estilista" },
        });
        target = created.id;
      } else if (input.staffMemberId) {
        const staff = await tx.staffMember.findFirst({ where: { id: input.staffMemberId, tenantId: input.tenantId, active: true } });
        if (!staff) return "STAFF_NOT_FOUND";
        if (staff.userId && staff.userId !== user.id) return "STAFF_TAKEN";
        target = staff.id;
      }
      if (!target) return "STAFF_NOT_FOUND";

      if (current && current !== target) await tx.staffMember.update({ where: { id: current }, data: { userId: null } });
      if (current !== target) await tx.staffMember.update({ where: { id: target }, data: { userId: user.id } });
    }

    await tx.user.update({ where: { id: user.id }, data: { role: input.role } });
    return null;
  });
}
