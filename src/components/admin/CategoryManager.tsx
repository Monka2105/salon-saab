"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCategory, deleteCategory, moveCategory, renameCategory, type CategoryFormState } from "@/app/admin/actions";
import { FormMessage } from "@/components/auth/fields";
import { ConfirmDelete } from "./ConfirmDelete";

export interface CategoryItem {
  id: string;
  name: string;
  serviceCount: number;
}

/** Categorías del catálogo (Corte, Barba, Cejas, Uñas…): alta, renombrar, ordenar y eliminar. */
export function CategoryManager({ categories }: { categories: CategoryItem[] }) {
  const [state, action] = useActionState(createCategory, {} as CategoryFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vacía el campo tras crear la categoría.
  useEffect(() => {
    if (!state.error) formRef.current?.reset();
  }, [state]);

  return (
    <section className="space-y-4 bg-white p-6 sm:p-8">
      <div>
        <h2 className="font-serif text-2xl">Categorías</h2>
        <p className="mt-1 text-[14px] text-ash">Organizan el catálogo y los filtros del inicio. El orden de esta lista es el que ve el cliente.</p>
      </div>

      <form ref={formRef} action={action} className="flex flex-wrap gap-4">
        <input name="name" required maxLength={40} placeholder="Nueva categoría (p. ej. Uñas)" className="input min-w-0 flex-1" />
        <SubmitButton idle="Agregar categoría" busy="Agregando…" />
      </form>
      <FormMessage state={state} />

      <ul className="border-b border-stone">
        {categories.map((c, i) =>
          editingId === c.id ? (
            <RenameRow key={c.id} category={c} onClose={() => setEditingId(null)} />
          ) : (
            <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-stone py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{c.name}</p>
                <p className="micro-label mt-0.5 text-ash">
                  {c.serviceCount} {c.serviceCount === 1 ? "servicio" : "servicios"}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-6">
                <MoveButton id={c.id} direction="up" disabled={i === 0} />
                <MoveButton id={c.id} direction="down" disabled={i === categories.length - 1} />
                <button type="button" onClick={() => setEditingId(c.id)} className="btn-secondary">
                  Renombrar
                </button>
                <ConfirmDelete
                  action={deleteCategory}
                  id={c.id}
                  question={c.serviceCount ? `¿Eliminar «${c.name}»? Sus servicios quedarán sin categoría.` : `¿Eliminar «${c.name}»?`}
                />
              </div>
            </li>
          ),
        )}
        {!categories.length && <li className="border-t border-stone py-5 text-[15px] text-ash">Aún no hay categorías.</li>}
      </ul>
    </section>
  );
}

function RenameRow({ category, onClose }: { category: CategoryItem; onClose: () => void }) {
  const [error, setError] = useState<string>();

  return (
    <li className="space-y-3 border-t border-stone py-4">
      <form
        action={async (fd) => {
          const result = await renameCategory(fd);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="flex flex-wrap gap-4"
      >
        <input type="hidden" name="id" value={category.id} />
        <input name="name" required maxLength={40} defaultValue={category.name} aria-label="Nombre" autoFocus className="input min-w-0 flex-1" />
        <SubmitButton idle="Guardar" busy="Guardando…" />
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
      </form>
      <FormMessage state={{ error }} />
    </li>
  );
}

function MoveButton({ id, direction, disabled }: { id: string; direction: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveCategory}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        disabled={disabled}
        aria-label={direction === "up" ? "Subir" : "Bajar"}
        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? busy : idle}
    </button>
  );
}
