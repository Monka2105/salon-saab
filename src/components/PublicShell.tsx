import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { describeOpeningHours } from "@/lib/format";
import type { ResolvedTenant } from "@/lib/tenant";
import { WhatsAppButton } from "./WhatsAppButton";

interface Props {
  tenant: ResolvedTenant;
  children: ReactNode;
  /** Bloques a todo el ancho entre el contenido y el footer (p. ej. la franja de WhatsApp del inicio). */
  after?: ReactNode;
}

/** "573001234567" → "+57 300 123 4567"; otros formatos se muestran tal cual. */
function displayPhone(phone: string): string {
  const m = /^(\d{2})(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export async function PublicShell({ tenant, children, after }: Props) {
  const { business, terminology: terms, landing, records } = tenant;
  const user = await getSessionUser();
  const hours = describeOpeningHours(records.openingHours, business.locale);

  const links = [
    { href: "/#servicios", label: terms.item.plural },
    ...(user ? [{ href: "/appointments", label: "Mi historial" }] : []),
    ...(user?.role === "STAFF" ? [{ href: "/staff", label: "Mi agenda" }] : []),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {landing.announcement && (
        <p className="micro-label border-b border-stone bg-[#ece6dd] px-4 py-2.5 text-center text-ink">{landing.announcement}</p>
      )}

      <header className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 sm:px-10">
        <Link href="/" className="truncate font-serif text-[26px] leading-none tracking-[0.04em] uppercase">
          {business.name}
        </Link>
        <nav className="micro-label flex flex-wrap items-center gap-x-6 gap-y-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-carbon">
              {l.label}
            </Link>
          ))}
          <Link href={user ? "/account" : "/login"} className="border border-ink px-3 py-2 transition-colors hover:bg-ink hover:text-cream">
            {user ? "Mi cuenta" : "Iniciar sesión"}
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-20 px-4 pt-4 pb-16 sm:space-y-24 sm:px-10">{children}</main>

      {after}

      <footer className="border-t border-stone">
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 text-[14px] sm:grid-cols-3 sm:px-10">
          <div>
            <p className="micro-label">Dirección</p>
            <p className="mt-3 text-ash">{business.address || "—"}</p>
          </div>
          <div>
            <p className="micro-label">Horarios</p>
            <ul className="mt-3 space-y-1 text-ash">
              {hours.length ? hours.map(({ day, ranges }) => <li key={day}>{`${day}: ${ranges}`}</li>) : <li>—</li>}
            </ul>
          </div>
          <div>
            <p className="micro-label">Contacto</p>
            {business.phone ? (
              <a href={`https://wa.me/${business.phone}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-ash hover:text-carbon">
                {displayPhone(business.phone)}
              </a>
            ) : (
              <p className="mt-3 text-ash">—</p>
            )}
          </div>
        </div>
        <p className="pb-10 text-center text-[12px] text-ash">
          © {new Date().getFullYear()} {business.name}. Todos los derechos reservados.
        </p>
      </footer>

      {business.phone && <WhatsAppButton phone={business.phone} />}
    </div>
  );
}
