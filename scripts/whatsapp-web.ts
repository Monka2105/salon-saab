// Bot de WhatsApp sin Meta: se conecta como WhatsApp Web (Baileys) escaneando un QR.
// Uso: npm run whatsapp   (la sesión queda guardada en .wa-auth/)
// ⚠️ No es una API oficial: WhatsApp puede bloquear el número. Usa un número de pruebas.
try {
  process.loadEnvFile(".env");
} catch {
  // sin .env: se usan las variables del entorno
}

const AUTH_DIR = ".wa-auth";
const SEND_PORT = Number(process.env.WHATSAPP_WEB_PORT || 3010);
/**
 * Con WHATSAPP_BRIDGE_URL (p. ej. https://tu-sitio.netlify.app/api/whatsapp-web) cada mensaje lo
 * procesa la app publicada, con su base de datos; sin ella se usa la base local (DATABASE_URL).
 */
const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL?.trim() || null;

/** Cada cuánto el bot recoge los códigos OTP que deja la app publicada. */
const OUTBOX_POLL_MS = Number(process.env.WHATSAPP_OUTBOX_POLL_MS || 5000);

async function forwardToBridge(message: object): Promise<string[]> {
  const res = await fetch(BRIDGE_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_BRIDGE_SECRET ?? ""}` },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const { replies } = (await res.json()) as { replies: string[] };
  return replies;
}

async function main() {
  const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidBroadcast,
    isJidGroup,
    isJidStatusBroadcast,
    jidNormalizedUser,
    useMultiFileAuthState,
  } = await import("@whiskeysockets/baileys");
  const { default: pino } = await import("pino");
  const { default: qrcode } = await import("qrcode-terminal");
  // Import dinámico: los módulos leen process.env al cargarse, después de loadEnvFile.
  const { handleInboundMessage } = await import("@/modules/agent/router");
  const { renderAsText } = await import("@/modules/agent/reply");

  type WAMessage = import("@whiskeysockets/baileys").WAMessage;

  const logger = pino({ level: "silent" });

  function extractText(m: WAMessage): { type: string; text: string | null } {
    const content = m.message ?? {};
    const text =
      content.conversation ??
      content.extendedTextMessage?.text ??
      content.buttonsResponseMessage?.selectedDisplayText ??
      content.listResponseMessage?.title ??
      null;
    if (text !== null) return { type: "text", text };
    return { type: Object.keys(content)[0] ?? "unknown", text: null };
  }

  // Socket vigente; se reemplaza en cada reconexión.
  let current: ReturnType<typeof makeWASocket> | null = null;

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ auth: state, version, logger });
    current = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log("\nEscanea este QR en WhatsApp > Dispositivos vinculados > Vincular un dispositivo:\n");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        console.log(`[whatsapp-web] Conectado como ${sock.user?.id}. Esperando mensajes…`);
      }
      if (connection === "close") {
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          console.error(`[whatsapp-web] Sesión cerrada desde el teléfono. Borra la carpeta ${AUTH_DIR}/ y vuelve a ejecutar.`);
          process.exit(1);
        }
        console.warn(`[whatsapp-web] Conexión cerrada (${code ?? "?"}), reconectando…`);
        connect().catch((err) => console.error("[whatsapp-web] reconexión fallida", err));
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        const jid = m.key.remoteJid;
        if (!jid || m.key.fromMe || !m.message || !m.key.id) continue;
        if (isJidGroup(jid) || isJidBroadcast(jid) || isJidStatusBroadcast(jid)) continue;

        // Con identificadores @lid, el número real viene en remoteJidAlt.
        const phoneJid = [jid, m.key.remoteJidAlt].find((j) => j?.endsWith("@s.whatsapp.net")) ?? jid;
        const { type: msgType, text } = extractText(m);

        const inbound = {
          // El número propio sirve como phone_number_id: así se puede enrutar por tenant en /admin/settings.
          phoneNumberId: jidNormalizedUser(sock.user?.id).split("@")[0],
          from: phoneJid.split("@")[0],
          waMessageId: m.key.id,
          profileName: m.pushName ?? undefined,
          type: msgType,
          text,
          timestamp: new Date(Number(m.messageTimestamp ?? Date.now() / 1000) * 1000),
        };

        if (BRIDGE_URL) {
          sock.readMessages([m.key]).catch(() => undefined);
          forwardToBridge(inbound)
            .then(async (replies) => {
              for (const reply of replies) await sock.sendMessage(jid, { text: reply });
            })
            .catch((err) => console.error("[whatsapp-web] puente falló", err));
          continue;
        }

        handleInboundMessage(
          inbound,
          {
            // WhatsApp Web (Baileys) no envía listas ni botones de forma fiable: se mandan como texto con las opciones.
            send: async (reply) => {
              await sock.sendMessage(jid, { text: renderAsText(reply) });
            },
            markAsRead: () => sock.readMessages([m.key]),
          },
        ).catch((err) => console.error("[whatsapp-web] handler failed", err));
      }
    });
  }

  if (BRIDGE_URL) {
    console.log(`[whatsapp-web] Mensajes procesados por ${BRIDGE_URL} (datos de la app publicada).`);
  } else if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[whatsapp-web] ⚠ OPENAI_API_KEY está vacía en .env: la IA no puede responder y todo mensaje recibirá el texto de disculpa (fallbackMessage).",
    );
  }

  startSendServer(() => current);
  if (BRIDGE_URL) startOutboxPolling(() => current);
  await connect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/** Recoge de la app publicada los mensajes pendientes (códigos OTP) y los envía. */
function startOutboxPolling(getSocket: () => { user?: unknown; sendMessage: (jid: string, content: { text: string }) => Promise<unknown> } | null) {
  const url = `${BRIDGE_URL!.replace(/\/+$/, "")}/outbox`;
  let busy = false;

  setInterval(async () => {
    const sock = getSocket();
    // Sin conexión no se recoge nada: los mensajes esperan en la cola hasta que vencen.
    if (busy || !sock?.user) return;
    busy = true;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_BRIDGE_SECRET ?? ""}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const { messages } = (await res.json()) as { messages: { to: string; text: string }[] };
      for (const m of messages) {
        await sock.sendMessage(`${m.to}@s.whatsapp.net`, { text: m.text });
        console.log(`[whatsapp-web] Código enviado a ${m.to}`);
      }
    } catch (err) {
      console.error("[whatsapp-web] no se pudo recoger la cola de envío", err);
    } finally {
      busy = false;
    }
  }, OUTBOX_POLL_MS);
}

/**
 * API local para que la web envíe OTPs desde este WhatsApp (OTP_CHANNEL=whatsapp-web).
 * Solo escucha en 127.0.0.1 y exige INTERNAL_API_SECRET: no la expongas a internet.
 */
function startSendServer(getSocket: () => { sendMessage: (jid: string, content: { text: string }) => Promise<unknown> } | null) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.warn("[whatsapp-web] INTERNAL_API_SECRET no definido: API de envío de OTP desactivada.");
    return;
  }

  void import("node:http").then(({ createServer }) =>
    import("node:crypto").then(({ createHash, timingSafeEqual }) => {
      const digest = (v: string) => createHash("sha256").update(v).digest();
      const expected = digest(`Bearer ${secret}`);

      createServer((req, res) => {
        const reply = (status: number, body: string) => res.writeHead(status, { "Content-Type": "text/plain" }).end(body);
        if (req.method !== "POST" || req.url !== "/send") return reply(404, "not found");
        if (!timingSafeEqual(digest(req.headers.authorization ?? ""), expected)) return reply(401, "unauthorized");

        let raw = "";
        req.on("data", (chunk: Buffer) => {
          raw += chunk;
          if (raw.length > 4096) req.destroy();
        });
        req.on("end", async () => {
          try {
            const { to, text } = JSON.parse(raw) as { to?: unknown; text?: unknown };
            if (typeof to !== "string" || !/^\d{8,15}$/.test(to) || typeof text !== "string" || text.length > 1000) {
              return reply(400, "invalid payload");
            }
            const sock = getSocket();
            if (!sock) return reply(503, "whatsapp not connected");
            await sock.sendMessage(`${to}@s.whatsapp.net`, { text });
            reply(200, "ok");
          } catch (err) {
            console.error("[whatsapp-web] send failed", err);
            reply(500, "send failed");
          }
        });
      }).listen(SEND_PORT, "127.0.0.1", () => console.log(`[whatsapp-web] API de OTP en http://127.0.0.1:${SEND_PORT}/send`));
    }),
  );
}
