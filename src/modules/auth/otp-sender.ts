import { sendAuthTemplate } from "@/modules/whatsapp/client";

/**
 * Canal de entrega del OTP (env OTP_CHANNEL):
 * - "whatsapp-cloud": plantilla de autenticación de Meta (obligatoria para mensajes iniciados por el negocio).
 * - "whatsapp-web":   el bot de scripts/whatsapp-web.ts lo envía desde tu WhatsApp (API local con secreto compartido).
 * - "console":        solo desarrollo; imprime el código en la terminal del servidor.
 */
type OtpChannel = "whatsapp-cloud" | "whatsapp-web" | "console";

function channel(): OtpChannel {
  const value = process.env.OTP_CHANNEL ?? "console";
  if (value !== "whatsapp-cloud" && value !== "whatsapp-web" && value !== "console") {
    throw new Error(`OTP_CHANNEL inválido: ${value}`);
  }
  if (value === "console" && process.env.NODE_ENV === "production") {
    throw new Error("OTP_CHANNEL=console no está permitido en producción");
  }
  return value;
}

function message(code: string): string {
  return `${code} es tu código de verificación. Vence en 10 minutos. No lo compartas con nadie.`;
}

async function sendViaWhatsAppWeb(phone: string, code: string): Promise<void> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET no está configurado");
  const port = process.env.WHATSAPP_WEB_PORT || "3010";

  const res = await fetch(`http://127.0.0.1:${port}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, text: message(code) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`whatsapp-web ${res.status}: ${await res.text()}`);
}

export async function sendOtp(phone: string, code: string): Promise<void> {
  switch (channel()) {
    case "whatsapp-cloud":
      return sendAuthTemplate(phone, code);
    case "whatsapp-web":
      return sendViaWhatsAppWeb(phone, code);
    case "console":
      console.info(`[otp] ${phone} → ${code}`);
  }
}
