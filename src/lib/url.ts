/** URL absoluta de una ruta de la web (para enlaces enviados fuera del navegador, p. ej. por WhatsApp). */
export function publicUrl(path: string): string | null {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : null;
}
