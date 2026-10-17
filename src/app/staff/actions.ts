"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { completeAppointment } from "@/modules/appointments/service";

/**
 * El estilista confirma un servicio que realizó. El estilista y la cuenta salen de la sesión,
 * nunca del formulario: solo puede confirmar citas asignadas a su propia ficha.
 */
export async function confirmServiceDone(fd: FormData): Promise<{ error?: string }> {
  const tenant = await getCurrentTenant();
  const { user, staff } = await requireStaff(tenant.id);
  const id = z.string().cuid().safeParse(fd.get("id"));
  if (!id.success) return { error: "Cita inválida." };

  try {
    await completeAppointment({
      tenantId: tenant.id,
      appointmentId: id.data,
      actorUserId: user.id,
      staffMemberId: staff.id,
      details: { executionNotes: String(fd.get("executionNotes") ?? "") },
    });
  } catch {
    return { error: "No se pudo confirmar: la cita ya fue cerrada o todavía no ha empezado." };
  }
  revalidatePath("/staff");
  revalidatePath("/admin");
  revalidatePath("/admin/stats");
  return {};
}
