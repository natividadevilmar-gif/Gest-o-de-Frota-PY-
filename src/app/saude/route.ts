import { db } from "@/lib/db";

// Diagnóstico do deploy: diz o que está configurado, sem expor segredos.
export const dynamic = "force-dynamic";

export async function GET() {
  const segredo = (process.env.SESSION_SECRET ?? "").length >= 32 || Boolean(process.env.DATABASE_URL);
  let banco: string;
  let dadosDeExemplo = false;
  try {
    dadosDeExemplo = (await db.usuario.count()) > 0;
    banco = "ok";
  } catch (e) {
    const codigo = (e as { code?: string; errorCode?: string }).code ?? (e as { errorCode?: string }).errorCode;
    banco = `erro ${codigo ?? (e as Error).name}`;
  }
  const ok = segredo && banco === "ok" && dadosDeExemplo;
  return Response.json({ ok, segredoDeSessao: segredo, banco, dadosDeExemplo }, { status: ok ? 200 : 503 });
}
