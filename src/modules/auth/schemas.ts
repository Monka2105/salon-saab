import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

// Validación de toda entrada de autenticación. Prisma ya parametriza las consultas (anti-SQLi);
// Zod garantiza tipos, longitudes y formato antes de tocar la BD.

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(128, "La contraseña es demasiado larga.");

export const phoneSchema = z
  .string()
  .max(32)
  .transform((raw, ctx) => {
    const phone = normalizePhone(raw);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ingresa un celular válido con indicativo de país." });
      return z.NEVER;
    }
    return phone;
  });

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos.");

export const credentialsLoginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export const nameSchema = z.string().trim().min(2, "Ingresa tu nombre.").max(80);

/** `name` solo llega desde el registro; en el login por celular va vacío. */
export const phoneLoginSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  name: z.preprocess((v) => (v === "" ? undefined : v), nameSchema.optional()),
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** Solo rutas relativas internas: evita open redirects vía ?callbackUrl=https://evil.com o //evil.com */
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : fallback;
}
