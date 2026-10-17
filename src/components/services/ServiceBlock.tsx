import type { Service } from "@prisma/client";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ResolvedTenant } from "@/lib/tenant";

interface Props {
  service: Service;
  index: number;
  tenant: ResolvedTenant;
}

/** Bloque editorial: flota sobre el lienzo crema, sin tarjeta; solo un hairline inferior lo cierra. */
export function ServiceBlock({ service, index, tenant }: Props) {
  const price = formatPrice(service.price, tenant.business);

  return (
    <article className="flex flex-col border-b border-stone pb-8">
      {service.imageUrl ? (
        <img src={service.imageUrl} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
      ) : (
        <span className="micro-label text-ash">{String(index + 1).padStart(2, "0")}</span>
      )}

      <h3 className={`font-serif text-2xl leading-[1.1] tracking-[-0.005em] ${service.imageUrl ? "mt-6" : "mt-4"}`}>
        {service.title}
      </h3>

      {service.description && <p className="mt-3 max-w-[420px] text-[15px] leading-[1.45] text-ash">{service.description}</p>}

      <div className="mt-auto flex items-end justify-between gap-4 pt-8">
        <p className="micro-label">
          {service.durationMinutes} min{price && <span className="text-ash"> · {price}</span>}
        </p>
        <Link href={`/servicios/${service.id}`} className="link-cta">
          {tenant.terminology.ctaPrimary}
        </Link>
      </div>
    </article>
  );
}
