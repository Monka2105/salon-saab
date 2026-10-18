/** Campos compartidos por "Agregar" y "Editar" servicio. Sin hooks: sirve en Server y Client Components. */
export interface ServiceDefaults {
  title: string;
  /** Precio ya convertido a texto editable ("65.00"). */
  price: string;
  description: string;
  durationMinutes: number;
  /** "" = sin categoría */
  categoryId: string;
  /** Estilistas que pueden hacerlo; vacío = cualquiera */
  staffIds: string[];
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

interface Props {
  currency: string;
  categories: CategoryOption[];
  staff: StaffOption[];
  defaults?: ServiceDefaults;
}

export function ServiceFields({ currency, categories, staff, defaults }: Props) {
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
      {staff.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className="micro-label">¿Quién lo puede hacer?</legend>
          <p className="mt-1 text-[13px] text-ash">
            Sin marcar = cualquiera. Si marcas a alguien, el cliente solo podrá reservarlo con esa persona.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {staff.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2 text-[15px]">
                <input type="checkbox" name="staffIds" value={m.id} defaultChecked={defaults?.staffIds.includes(m.id)} className="h-4 w-4 accent-carbon" />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
