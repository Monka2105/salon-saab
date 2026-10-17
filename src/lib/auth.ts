import type { StaffMember, User } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "./db";

// RBAC. El JWT solo prueba quién es; el rol se relee de la BD en cada petición,
// así un usuario degradado o eliminado pierde el acceso al instante.

/** Usuario de la sesión actual (memoizado por request) o null. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
});

/** Para páginas y Server Actions de cliente. */
export async function requireUser(callbackUrl = "/"): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/** Úsalo en layouts Y en cada Server Action del admin (las acciones son endpoints POST públicos). */
export async function requireAdmin(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/**
 * Panel del estilista. Exige rol STAFF (o un ADMIN que también atiende) y una ficha de estilista activa
 * vinculada a la cuenta: todo lo que ve y confirma queda limitado a esa ficha.
 */
export async function requireStaff(tenantId: string): Promise<{ user: User; staff: StaffMember }> {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/staff");
  if (user.role !== "STAFF" && user.role !== "ADMIN") redirect("/");

  const staff = await prisma.staffMember.findFirst({ where: { userId: user.id, tenantId, active: true } });
  if (!staff) redirect(user.role === "ADMIN" ? "/admin" : "/");
  return { user, staff };
}
