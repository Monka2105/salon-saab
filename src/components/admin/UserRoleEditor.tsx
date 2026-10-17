"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changeRole } from "@/app/admin/actions";
import { FormMessage } from "@/components/auth/fields";
import { ROLE_LABELS, ROLES } from "@/modules/staff/roles";

interface Props {
  userId: string;
  role: Role;
  /** Ficha de estilista vinculada a esta cuenta, si tiene */
  staffProfileId: string | null;
  /** Fichas que puede tomar: las libres + la suya */
  staffOptions: { id: string; name: string }[];
  isSelf: boolean;
}

/** CAMBIAR ROL → Cliente / Estilista (+ ficha) / Admin, en la misma fila. */
export function UserRoleEditor({ userId, role, staffProfileId, staffOptions, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const [nextRole, setNextRole] = useState<Role>(role);
  const [error, setError] = useState<string>();

  if (isSelf) return <span className="micro-label text-ash">Tu cuenta</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        Cambiar rol
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setNextRole(role);
    setError(undefined);
  };

  return (
    <form
      action={async (fd) => {
        const result = await changeRole(fd);
        setError(result.error);
        if (!result.error) setOpen(false);
      }}
      className="w-full space-y-4 bg-white p-6"
    >
      <input type="hidden" name="userId" value={userId} />

      <fieldset className="flex flex-wrap gap-x-8 gap-y-3">
        <legend className="micro-label mb-3 text-ash">Nuevo rol</legend>
        {ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 text-[15px]">
            <input type="radio" name="role" value={r} checked={nextRole === r} onChange={() => setNextRole(r)} className="accent-carbon" />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </fieldset>

      {nextRole === "STAFF" && (
        <label className="block space-y-2">
          <span className="micro-label block">Ficha de estilista</span>
          <select name="staffMemberId" defaultValue={staffProfileId ?? (staffOptions.length ? staffOptions[0].id : "new")} className="input">
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="new">+ Crear ficha nueva con su nombre</option>
          </select>
        </label>
      )}

      <p className="text-[13px] leading-[1.45] text-ash">
        {nextRole === "USER" && "Pierde el acceso a «Mi agenda». Su ficha de estilista queda libre para otra persona, con su horario e historial."}
        {nextRole === "STAFF" && "Podrá entrar a «Mi agenda» y confirmar los servicios de esa ficha."}
        {nextRole === "ADMIN" && "Acceso total al panel de administración, incluido cambiar roles."}
      </p>

      <FormMessage state={{ error }} />

      <div className="flex flex-wrap gap-6">
        <SaveButton disabled={nextRole === role && nextRole !== "STAFF"} />
        <button type="button" onClick={close} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary">
      {pending ? "Guardando…" : "Guardar rol"}
    </button>
  );
}
