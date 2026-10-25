import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";

// Arquivo de uma foto ou vídeo recebido da câmera. Aceita Range para o player do Safari.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const { id } = await params;
  const m = await db.midia.findFirst({
    where: { id, ...(sessao.papel === "ADMIN" ? {} : { clienteId: cliente.id }) },
    select: { conteudo: true, formato: true, tipo: true, data: true, caminhao: { select: { placa: true } } },
  });
  if (!m?.conteudo) return new Response("Arquivo não encontrado", { status: 404 });
  const dados = Buffer.from(m.conteudo);
  const ext = m.formato === "image/jpeg" ? "jpg" : m.formato === "video/mp4" ? "mp4" : "h265";
  const nome = `${m.caminhao.placa.replace(/\s+/g, "")}-${m.data.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
  const cab: Record<string, string> = {
    "content-type": m.formato ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=86400",
    "content-disposition": `${new URL(req.url).searchParams.has("baixar") ? "attachment" : "inline"}; filename="${nome}"`,
  };
  const faixa = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (faixa) {
    const ini = faixa[1] ? Number(faixa[1]) : Math.max(0, dados.length - Number(faixa[2]));
    const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), dados.length - 1) : dados.length - 1;
    if (ini >= dados.length || ini > fim) return new Response(null, { status: 416, headers: { "content-range": `bytes */${dados.length}` } });
    return new Response(dados.subarray(ini, fim + 1), { status: 206, headers: { ...cab, "content-range": `bytes ${ini}-${fim}/${dados.length}`, "content-length": String(fim - ini + 1) } });
  }
  return new Response(dados, { headers: { ...cab, "content-length": String(dados.length) } });
}
