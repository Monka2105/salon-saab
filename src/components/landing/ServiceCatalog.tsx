"use client";

import Link from "next/link";
import { useState } from "react";

export interface CatalogService {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  price: string | null;
}

interface Props {
  services: CatalogService[];
  /** Cada filtro muestra los servicios cuyo nombre contiene esa palabra. */
  filters: string[];
  title: string;
}

/** Catálogo del inicio: tarjetas con filtros. "Seleccionar fecha" abre la página del servicio (estilista + disponibilidad). */
export function ServiceCatalog({ services, filters, title }: Props) {
  const [filter, setFilter] = useState<string | null>(null);

  const matches = (s: CatalogService, f: string) => s.title.toLowerCase().includes(f.toLowerCase());
  const activeFilters = filters.filter((f) => services.some((s) => matches(s, f)));
  const visible = filter ? services.filter((s) => matches(s, filter)) : services;

  return (
    <section id="servicios" className="scroll-mt-8">
      <div className="text-center">
        <h2 className="font-serif text-[36px] leading-[1.1] sm:text-[40px]">{title}</h2>
        <p className="mt-2 text-[14px] text-ash">Descubre</p>
        {activeFilters.length > 0 && (
          <div className="micro-label mt-5 flex flex-wrap justify-center gap-x-2 gap-y-2">
            {[null, ...activeFilters].map((f, i) => (
              <span key={f ?? "all"} className="flex items-center gap-2">
                {i > 0 && <span className="text-ash">/</span>}
                <button
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`cursor-pointer border-b pb-0.5 transition-colors ${filter === f ? "border-carbon text-carbon" : "border-transparent text-ink hover:text-carbon"}`}
                >
                  {f ?? "Todos"}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <article key={s.id} className="flex flex-col border border-ink/40 p-6 transition-colors hover:border-ink">
            <h3 className="text-[15px] font-medium tracking-[0.02em] uppercase">{s.title}</h3>
            <p className="micro-label mt-1.5 text-ash">{s.durationMinutes} minutos</p>
            {s.price && <p className="mt-3 text-[17px]">{s.price}</p>}
            {s.description && <p className="mt-3 text-[13px] leading-[1.45] text-ink/80">{s.description}</p>}
            <Link href={`/servicios/${s.id}`} className="link-cta mt-auto self-start pt-6">
              Seleccionar fecha
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
