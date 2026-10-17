import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { signInWithPhone } from "@/modules/auth/identity";
import { credentialsLoginSchema, phoneLoginSchema } from "@/modules/auth/schemas";

const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

// Hash fijo para comparar cuando el email no existe: el tiempo de respuesta no revela qué cuentas existen.
const DUMMY_HASH = "$2b$12$iWezoDddmhpstZ8/zPC5y.fi.gXRTHZtRnQv8eEkXhNV5evNmHFlm";

/**
 * Auth.js v5 con dos proveedores sobre la misma tabla User:
 * - "credentials": email + contraseña (bcrypt).
 * - "phone-otp":   celular + código de 6 dígitos enviado por WhatsApp/SMS.
 * Sesión JWT en cookie HttpOnly, SameSite=Lax y Secure (prefijo __Secure-) en HTTPS.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsLoginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user?.passwordHash || !valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Credentials({
      id: "phone-otp",
      name: "Celular",
      credentials: { phone: {}, code: {}, name: {} },
      async authorize(raw) {
        const parsed = phoneLoginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await signInWithPhone(parsed.data.phone, parsed.data.code, parsed.data.name);
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
