// Alias de compatibilidad: la ruta canónica es /api/webhook/whatsapp.
// Se mantiene para no romper un webhook ya configurado en Meta con la URL anterior.
export { GET, POST } from "./whatsapp/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
