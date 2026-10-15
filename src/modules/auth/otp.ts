import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendOtp } from "./otp-sender";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function otpSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return secret;
}

/** HMAC ligado al número: un hash filtrado no sirve para otro celular ni sin el secreto del servidor. */
function hashCode(phone: string, code: string): Buffer {
  return createHmac("sha256", otpSecret()).update(`${phone}:${code}`).digest();
}

export type RequestOtpResult =
  | { ok: true }
  | { ok: false; error: "TOO_MANY_REQUESTS"; retryAfterSec: number }
  | { ok: false; error: "SEND_FAILED" };

/** Genera, guarda (hasheado) y envía un código de 6 dígitos. `phone` ya debe venir normalizado. */
export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const now = Date.now();
  const recent = await prisma.verificationToken.findMany({
    where: { identifier: phone, createdAt: { gt: new Date(now - 60 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const last = recent[0]?.createdAt.getTime();
  if (last && now - last < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "TOO_MANY_REQUESTS", retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000) };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    const oldest = recent[recent.length - 1].createdAt.getTime();
    return { ok: false, error: "TOO_MANY_REQUESTS", retryAfterSec: Math.ceil((oldest + 60 * 60_000 - now) / 1000) };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  // Un solo código vivo por número: los anteriores quedan invalidados.
  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { identifier: phone, consumedAt: null },
      data: { consumedAt: new Date(now) },
    }),
    prisma.verificationToken.create({
      data: { identifier: phone, codeHash: hashCode(phone, code).toString("hex"), expiresAt: new Date(now + CODE_TTL_MS) },
    }),
  ]);

  try {
    await sendOtp(phone, code);
  } catch (err) {
    console.error("[otp] send failed", err);
    return { ok: false, error: "SEND_FAILED" };
  }
  return { ok: true };
}

/**
 * Valida y consume el código. Devuelve true una sola vez por código.
 * Tras MAX_ATTEMPTS fallos el código queda inutilizable (anti fuerza bruta: 5 intentos sobre 10^6).
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const token = await prisma.verificationToken.findFirst({
    where: { identifier: phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.attempts >= MAX_ATTEMPTS) return false;

  const expected = Buffer.from(token.codeHash, "hex");
  const actual = hashCode(phone, code);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prisma.verificationToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return false;
  }

  // Consumo atómico: si dos peticiones llegan a la vez con el mismo código, solo una gana.
  const { count } = await prisma.verificationToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count === 1;
}
