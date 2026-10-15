"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/phone";
import { requestOtp } from "@/modules/auth/otp";
import { otpCodeSchema, phoneSchema, registerSchema, safeCallbackUrl } from "@/modules/auth/schemas";

export interface AuthFormState {
  error?: string;
  info?: string;
  /** Flujo por celular: tras enviar el código se pasa al paso "code" */
  step?: "phone" | "code";
  phone?: string;
}

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");

/** signIn() lanza un redirect en éxito (hay que dejarlo propagar) y AuthError en credenciales inválidas. */
async function trySignIn(provider: string, data: Record<string, string>, onError: AuthFormState): Promise<AuthFormState> {
  try {
    await signIn(provider, data);
    return {};
  } catch (err) {
    if (err instanceof AuthError) return onError;
    throw err;
  }
}

export async function loginWithEmail(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  return trySignIn(
    "credentials",
    { email: field(fd, "email"), password: field(fd, "password"), redirectTo: safeCallbackUrl(fd.get("callbackUrl")) },
    { error: "Email o contraseña incorrectos." },
  );
}

export async function requestPhoneCode(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = phoneSchema.safeParse(field(fd, "phone"));
  if (!parsed.success) return { step: "phone", error: parsed.error.issues[0].message };

  const result = await requestOtp(parsed.data);
  if (!result.ok) {
    return {
      step: "phone",
      error:
        result.error === "TOO_MANY_REQUESTS"
          ? `Espera ${result.retryAfterSec} s antes de pedir otro código.`
          : "No pudimos enviar el código. Intenta de nuevo en un momento.",
    };
  }
  return { step: "code", phone: parsed.data, info: `Enviamos un código de 6 dígitos a ${maskPhone(parsed.data)}.` };
}

export async function verifyPhoneCode(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const phone = field(fd, "phone");
  const code = otpCodeSchema.safeParse(field(fd, "code"));
  if (!code.success) return { step: "code", phone, error: code.error.issues[0].message };

  return trySignIn(
    "phone-otp",
    { phone, code: code.data, redirectTo: safeCallbackUrl(fd.get("callbackUrl")) },
    { step: "code", phone, error: "Código incorrecto o vencido." },
  );
}

export async function register(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({ name: field(fd, "name"), email: field(fd, "email"), password: field(fd, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "No pudimos crear la cuenta con ese email. Si ya tienes una, inicia sesión." };
  }

  await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12) } });

  return trySignIn(
    "credentials",
    { email, password, redirectTo: safeCallbackUrl(fd.get("callbackUrl"), "/account") },
    { error: "Cuenta creada. Inicia sesión para continuar." },
  );
}
