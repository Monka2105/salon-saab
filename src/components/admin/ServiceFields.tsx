/** Campos compartidos por "Agregar" y "Editar" servicio. Sin hooks: sirve en Server y Client Components. */
export interface ServiceDefaults {
  title: string;
  /** Precio ya convertido a texto editable ("65.00"). */
  price: string;
  description: string;
  durationMinutes: number;
}

export function ServiceFields({ currency, defaults }: { currency: string; defaults?: ServiceDefaults }) {
  return (
    <>
      <input name="title" required maxLength={120} placeholder="Título" defaultValue={defaults?.title} className="input" />
      <input name="price" required inputMode="numeric" placeholder={`Precio (${currency})`} defaultValue={defaults?.price} className="input" />
      <input name="description" maxLength={1000} placeholder="Descripción" defaultValue={defaults?.description} className="input sm:col-span-2" />
      <input
        name="durationMinutes"
        required
        type="number"
        min={5}
        max={600}
        placeholder="Duración (min)"
        defaultValue={defaults?.durationMinutes}
        className="input sm:col-span-2"
      />
    </>
  );
}
