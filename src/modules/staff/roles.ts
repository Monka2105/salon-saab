import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = { USER: "Cliente", STAFF: "Estilista", ADMIN: "Admin" };
export const ROLES = Object.keys(ROLE_LABELS) as Role[];
