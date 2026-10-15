"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createStaff, deleteStaff, updateStaff } from "@/app/admin/actions";
import { ConfirmDelete } from "./ConfirmDelete";

interface Staff {
  id: string;
  name: string;
  specialty: string | null;
}

/** Ficha del estilista seleccionado en Disponibilidad: ver, editar en su sitio o eliminar. */
export function StaffEditor({ staff, label }: { staff: Staff; label: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={async (fd) => {
          await updateStaff(fd);
          setEditing(false);
        }}
        className="grid gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8"
      >
        <input type="hidden" name="id" value={staff.id} />
        <StaffFields staff={staff} />
        <div className="flex gap-6 sm:col-span-2">
          <SubmitButton idle="Guardar cambios" pending="Guardando…" />
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-6">
      <div>
        <p className="micro-label text-ash">{label}</p>
        <p className="mt-2 font-serif text-[28px] leading-[1.1]">{staff.name}</p>
        {staff.specialty && <p className="micro-label mt-2 text-ash">{staff.specialty}</p>}
      </div>
      <div className="flex flex-wrap items-baseline gap-6">
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary">
          Editar
        </button>
        {/* key: al cambiar de estilista se reinicia la confirmación */}
        <ConfirmDelete key={staff.id} action={deleteStaff} id={staff.id} question={`¿Eliminar a ${staff.name}?`} />
      </div>
    </div>
  );
}

/** "+ Agregar" junto a las pestañas; se despliega en un formulario corto. */
export function AddStaff({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        + Agregar {label.toLowerCase()}
      </button>
    );
  }

  return (
    <form action={createStaff} className="grid w-full gap-5 bg-white p-6 sm:grid-cols-2 sm:p-8">
      <StaffFields />
      <div className="flex gap-6 sm:col-span-2">
        <SubmitButton idle="Agregar" pending="Agregando…" />
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function StaffFields({ staff }: { staff?: Staff }) {
  return (
    <>
      <input name="name" required minLength={2} maxLength={80} placeholder="Nombre" defaultValue={staff?.name} className="input" />
      <input name="specialty" maxLength={80} placeholder="Especialidad (opcional)" defaultValue={staff?.specialty ?? ""} className="input" />
    </>
  );
}

function SubmitButton({ idle, pending: pendingLabel }: { idle: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? pendingLabel : idle}
    </button>
  );
}
