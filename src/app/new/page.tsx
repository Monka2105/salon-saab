import { redirect } from "next/navigation";

/**
 * La reserva vive ahora en /servicios/[id]. Esta ruta solo redirige, para no romper
 * enlaces antiguos (/new?service=…&staff=…&day=…&slot=…).
 */
export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; staff?: string; day?: string; slot?: string }>;
}) {
  const { service, ...rest } = await searchParams;
  if (!service || !/^[a-z0-9]+$/.test(service)) redirect("/#servicios");

  const query = new URLSearchParams(Object.entries(rest).filter((e): e is [string, string] => typeof e[1] === "string"));
  redirect(`/servicios/${service}${query.size ? `?${query}` : ""}`);
}
