/**
 * Celular en formato internacional, solo dígitos (igual que el wa_id de WhatsApp): "+57 300 123-4567" → "573001234567".
 * Devuelve null si no parece un número E.164 válido (8–15 dígitos, sin 0 inicial).
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** "573001234567" → "+57 •••• 4567" para mostrar sin exponer el número completo. */
export function maskPhone(phone: string): string {
  return `+${phone.slice(0, 2)} •••• ${phone.slice(-4)}`;
}

/** Cómo mostrar a un cliente en listas internas: nombre, o su celular enmascarado. */
export function customerLabel(user: { name: string | null; phoneNumber: string | null }): string {
  return user.name ?? (user.phoneNumber ? maskPhone(user.phoneNumber) : "Sin nombre");
}
