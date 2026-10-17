# Atelier · Peluquería & Barbería con agente de WhatsApp

Next.js (App Router) + Prisma/PostgreSQL + Auth.js v5 + agente de WhatsApp con IA (function calling).
Se adapta a cualquier nicho editando **`src/config/tenant.ts`**, sin tocar la lógica central.

## Inicio rápido

```bash
cp .env.example .env      # completa AUTH_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD como mínimo
npm install
docker compose up -d      # PostgreSQL local
npm run db:push           # crea las tablas
npm run db:seed           # admin + servicios y estilistas de ejemplo
npm run dev
npm run whatsapp          # (opcional) bot vía WhatsApp Web, escaneando un QR
```

- App: http://localhost:3000 · Catálogo: `/catalog` · Cuenta: `/account`
- Admin: http://localhost:3000/admin (entra con `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Con `OTP_CHANNEL=console` el código OTP se imprime en la terminal de `npm run dev`.

## Autenticación y seguridad

- **Auth.js v5** (`src/auth.ts`) con dos proveedores sobre la tabla `User`: email + contraseña (bcrypt, coste 12)
  y celular + OTP de 6 dígitos (`src/modules/auth/otp.ts`). Sesión JWT en cookie HttpOnly / SameSite=Lax / Secure en HTTPS.
- **OTP**: solo se guarda un HMAC del código; caduca en 10 min, un solo uso, máx. 5 intentos, reenvío cada 60 s y 5 envíos/hora.
  Canal configurable con `OTP_CHANNEL` (`console`, `whatsapp-web`, `whatsapp-cloud`).
- **Identidad omnicanal**: el agente de WhatsApp identifica al cliente por `phoneNumber`. Si escribe sin cuenta se crea un
  perfil "sombra"; al verificar ese celular en `/account` se fusiona con su cuenta web (`src/modules/auth/identity.ts`).
- **RBAC**: `requireUser()` / `requireAdmin()` (`src/lib/auth.ts`) en páginas y en cada Server Action; el rol se relee de la BD.
- **Validación**: Zod en toda entrada; Prisma parametriza las consultas.

## Estructura

```
prisma/schema.prisma       User · VerificationToken · StaffMember · Service · Appointment · Message · Tenant
src/
  auth.ts                  Configuración de Auth.js (credentials + phone-otp)
  config/tenant.ts         Configuración white-label (marca, terminología, horario, prompt)
  lib/                     auth (RBAC) · tenant · phone · format · db
  modules/
    auth/                  schemas (Zod) · otp · otp-sender · identity
    appointments/          createAppointment (sin solapes) · completeAppointment (notas + 1–3 fotos) · markNoShow
    whatsapp/              Cloud API: parser · signature · client
    agent/                 router · run-agent · prompt · tools
  components/services/     ServicesView · ServiceBlock · StaffPicker (vista de catálogo)
  app/                     / · catalog · new · login · register · account · admin · api/auth · api/webhook/whatsapp
scripts/whatsapp-web.ts    Bot vía WhatsApp Web (Baileys) + API local de envío de OTP
```

## Personalizar el negocio

Edita `src/config/tenant.ts`: nombre, `terminology` (servicio/cita/estilista/estados), `openingHours`,
`maxDaysAhead` y `agent.systemPrompt`.

Nombre, colores, teléfono, prompt y terminología también se pueden sobrescribir en `/admin/settings`
(se guardan en BD; un campo vacío vuelve al valor del archivo).

## Conectar WhatsApp (Meta)

1. En Meta for Developers crea una app tipo *Business* y añade el producto **WhatsApp**.
2. Expón tu servidor (p. ej. `ngrok http 3000`) y configura el webhook:
   - Callback URL: `https://<tu-dominio>/api/webhook/whatsapp` (la antigua `/api/webhook` sigue funcionando)
   - Verify token: el valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo `messages`.
3. Completa `WHATSAPP_APP_SECRET` y `WHATSAPP_ACCESS_TOKEN` (token permanente de System User).
4. (Multi-tenant) Guarda el `phone_number_id` de cada número en `/admin/settings`; el webhook enruta por él.

## IA

Usa el SDK de OpenAI. Cualquier proveedor compatible funciona con `OPENAI_BASE_URL`
(p. ej. OpenRouter: `https://openrouter.ai/api/v1`). El modelo se define en `tenant.ts` o con `AI_MODEL`.

## Producción

Usa `prisma migrate dev` / `prisma migrate deploy` en lugar de `db push`, `OTP_CHANNEL` distinto de `console`
(la app lo rechaza en producción) y HTTPS para que la cookie de sesión lleve `Secure`.

## Pendientes conocidos

- Agrupar mensajes enviados en ráfaga (debounce) antes de llamar a la IA.
- Handoff a humano (pausar el agente por conversación).
- `checkAvailability` del agente (TODO) y herramientas para consultar/cancelar citas desde WhatsApp.
- Subida de fotos con URLs firmadas (S3/Cloudinary) y formulario de cierre de servicio en el admin.
- Ficha del cliente `/admin/clients/[id]` (bitácora de citas, notas y fotos).
- Límite de intentos por IP en el login con contraseña y en la solicitud de OTP.
