"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import type { AuthFormState } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { maskPhone } from "@/lib/phone";
import { linkPhoneToUser } from "@/modules/auth/identity";
import { requestOtp } from "@/modules/auth/otp";
import { otpCodeSchema, phoneSchema } from "@/modules/auth/schemas";

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");

export async function requestLinkCode(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  await requireUser("/account");
  const parsed = phoneSchema.safeParse(field(fd, "phone"));
  if (!parsed.success) return { step: "phone", error: parsed.error.issues[0].message };

  const result = await requestOtp(parsed.data);
  if (!result.ok) {
    return {
      step: "phone",
      error: result.error === "TOO_MANY_REQUESTS" ? `Espera ${result.retryAfterSec} s antes de pedir otro código.` : "No pudimos enviar el código.",
    };
  }
  return { step: "code", phone: parsed.data, info: `Enviamos un código a ${maskPhone(parsed.data)}.` };
}

export async function confirmLinkCode(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const user = await requireUser("/account");
  const phone = phoneSchema.safeParse(field(fd, "phone"));
  const code = otpCodeSchema.safeParse(field(fd, "code"));
  if (!phone.success || !code.success) return { step: "code", phone: field(fd, "phone"), error: "Código inválido." };

  const result = await linkPhoneToUser(user.id, phone.data, code.data);
  if (!result.ok) {
    return {
      step: "code",
      phone: phone.data,
      error:
        result.error === "PHONE_IN_USE"
          ? "Ese número ya pertenece a otra cuenta. Escríbenos para revisarlo."
          : "Código incorrecto o vencido.",
    };
  }
  revalidatePath("/account");
  return { info: "Celular verificado." };
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
