/** Campos compartidos por "Agregar" y "Editar" servicio. Sin hooks: sirve en Server y Client Components. */
export interface ServiceDefaults {
  title: string;
  /** Precio ya convertido a texto editable ("65.00"). */
  price: string;
  description: string;
  durationMinutes: number;
  /** "" = sin categoría */
  categoryId: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  currency: string;
  categories: CategoryOption[];
  defaults?: ServiceDefaults;
}

export function ServiceFields({ currency, categories, defaults }: Props) {
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
        className="input"
      />
      <select name="categoryId" aria-label="Categoría" defaultValue={defaults?.categoryId ?? ""} className="input">
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </>
  );
}
