import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Autoriza al bot de WhatsApp Web (scripts/whatsapp-web.ts) con WHATSAPP_BRIDGE_SECRET.
 * null = puente desactivado (sin secreto configurado).
 */
export function bridgeAuthorized(authorization: string | null): boolean | null {
  const secret = process.env.WHATSAPP_BRIDGE_SECRET;
  if (!secret) return null;
  return timingSafeEqual(digest(authorization ?? ""), digest(`Bearer ${secret}`));
}
