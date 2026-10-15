"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { cancelOwnAppointment } from "@/modules/appointments/service";

export interface CancelState {
  error?: string;
}

/** El userId sale de la sesión, nunca del formulario: un cliente solo puede cancelar sus propias citas. */
export async function cancelAppointment(_prev: CancelState, fd: FormData): Promise<CancelState> {
  const user = await requireUser("/appointments");
  const tenant = await getCurrentTenant();
  const id = z.string().cuid().safeParse(fd.get("id"));
  if (!id.success) return { error: "Cita inválida." };

  try {
    await cancelOwnAppointment(tenant.id, user.id, id.data);
  } catch {
    return { error: "Esta cita ya no se puede cancelar desde aquí. Escríbenos y lo resolvemos." };
  }
  revalidatePath("/appointments");
  revalidatePath("/account");
  return {};
}
