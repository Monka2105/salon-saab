"use client";

import Link from "next/link";
import { useState } from "react";

export interface CatalogService {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  price: string | null;
  categoryId: string | null;
}

export interface CatalogCategory {
  id: string;
  name: string;
}

interface Props {
  services: CatalogService[];
  /** Filtros, en el orden que definió el admin. Solo se muestran los que tienen servicios. */
  categories: CatalogCategory[];
  title: string;
}

/** Catálogo del inicio: tarjetas con filtros. "Seleccionar fecha" abre la página del servicio (estilista + disponibilidad). */
export function ServiceCatalog({ services, categories, title }: Props) {
  const [filter, setFilter] = useState<string | null>(null);

  const activeFilters = categories.filter((c) => services.some((s) => s.categoryId === c.id));
  const visible = filter ? services.filter((s) => s.categoryId === filter) : services;

  return (
    <section id="servicios" className="scroll-mt-8">
      <div className="text-center">
        <h2 className="font-serif text-[36px] leading-[1.1] sm:text-[40px]">{title}</h2>
        <p className="mt-2 text-[14px] text-ash">Descubre</p>
        {activeFilters.length > 0 && (
          <div className="micro-label mt-5 flex flex-wrap justify-center gap-x-2 gap-y-2">
            {[{ id: null, name: "Todos" }, ...activeFilters].map((f, i) => (
              <span key={f.id ?? "all"} className="flex items-center gap-2">
                {i > 0 && <span className="text-ash">/</span>}
                <button
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`cursor-pointer border-b pb-0.5 transition-colors ${filter === f.id ? "border-carbon text-carbon" : "border-transparent text-ink hover:text-carbon"}`}
                >
                  {f.name}
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
