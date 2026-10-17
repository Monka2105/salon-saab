import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyOtp } from "./otp";

// Un mismo celular = una misma persona en la web y en WhatsApp.
// El agente busca al usuario por `phoneNumber`; `isPhoneVerified` indica que la web lo comprobó con OTP.

/**
 * Login/registro passwordless: valida el OTP y devuelve (o crea) el usuario dueño del celular.
 * `name` (desde el registro) solo se guarda si la cuenta aún no tiene nombre: no pisa uno existente.
 */
export async function signInWithPhone(phone: string, code: string, name?: string): Promise<User | null> {
  if (!(await verifyOtp(phone, code))) return null;

  const user = await prisma.user.upsert({
    where: { phoneNumber: phone },
    create: { phoneNumber: phone, isPhoneVerified: true, name },
    update: { isPhoneVerified: true },
  });
  if (name && !user.name) return prisma.user.update({ where: { id: user.id }, data: { name } });
  return user;
}

export type LinkPhoneResult = { ok: true } | { ok: false; error: "INVALID_CODE" | "PHONE_IN_USE" };

/**
 * Vincula un celular verificado a una cuenta existente (p. ej. registrada con email).
 * Si el número pertenecía a un perfil "sombra" creado por el agente de WhatsApp (sin email ni contraseña),
 * se fusiona: sus citas y conversaciones pasan a esta cuenta.
 */
export async function linkPhoneToUser(userId: string, phone: string, code: string): Promise<LinkPhoneResult> {
  if (!(await verifyOtp(phone, code))) return { ok: false, error: "INVALID_CODE" };

  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({ where: { phoneNumber: phone } });

    if (owner && owner.id !== userId) {
      // Una cuenta con credenciales propias no se absorbe: requiere intervención del admin.
      if (owner.email || owner.passwordHash || owner.role !== "USER") return { ok: false, error: "PHONE_IN_USE" } as const;

      await tx.appointment.updateMany({ where: { userId: owner.id }, data: { userId } });
      await tx.message.updateMany({ where: { userId: owner.id }, data: { userId } });
      await tx.user.delete({ where: { id: owner.id } });
      await tx.user.update({ where: { id: userId }, data: { noShowCount: { increment: owner.noShowCount } } });
    }

    await tx.user.update({ where: { id: userId }, data: { phoneNumber: phone, isPhoneVerified: true } });
    return { ok: true } as const;
  });
}
