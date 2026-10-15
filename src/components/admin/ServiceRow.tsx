"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteService, updateService } from "@/app/admin/actions";
import { ConfirmDelete } from "./ConfirmDelete";
import { ServiceFields, type ServiceDefaults } from "./ServiceFields";

export interface ServiceItem {
  id: string;
  /** "60 min · US$65.00" */
  summary: string;
  defaults: ServiceDefaults;
}

/** Catálogo editable en su sitio. Solo un servicio en edición a la vez: abrir otro cierra el anterior. */
export function ServiceList({ services, currency }: { services: ServiceItem[]; currency: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return services.map((s) => (
    <ServiceRow
      key={s.id}
      service={s}
      currency={currency}
      editing={editingId === s.id}
      onEdit={() => setEditingId(s.id)}
      onClose={() => setEditingId(null)}
    />
  ));
}

interface RowProps {
  service: ServiceItem;
  currency: string;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}

/** Fila que se edita sin navegar, así la página no salta al inicio. */
function ServiceRow({ service: { id, summary, defaults }, currency, editing, onEdit, onClose }: RowProps) {
  if (editing) {
    return (
      <li className="border-t border-stone py-6">
        <form
          action={async (fd) => {
            await updateService(fd);
            onClose();
          }}
          className="grid gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8"
        >
          <input type="hidden" name="id" value={id} />
          <ServiceFields currency={currency} defaults={defaults} />
          <div className="flex gap-6 sm:col-span-2">
            <SaveButton />
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-6 border-t border-stone py-5">
      <div className="min-w-0 flex-1">
        <p className="font-serif text-xl">{defaults.title}</p>
        <p className="micro-label mt-1 text-ash">{summary}</p>
      </div>
      <div className="flex flex-wrap items-baseline gap-6">
        <button type="button" onClick={onEdit} className="btn-secondary">
          Editar
        </button>
        <ConfirmDelete action={deleteService} id={id} question={`¿Eliminar «${defaults.title}»?`} />
      </div>
    </li>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

