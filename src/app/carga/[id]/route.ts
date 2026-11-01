import { clienteAtual, motoristaDaSessao } from "@/lib/acesso";
import { db } from "@/lib/db";
import { faixaPedida } from "@/lib/registroCarga";

/** Entrega a foto ou o vídeo da carga, com suporte a Range para o vídeo tocar no iPhone. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const { id } = await params;
  // O motorista só abre o que ele mesmo enviou.
  const doMotorista = (await motoristaDaSessao(sessao)) !== null;
  const r = await db.registroCarga.findFirst({
    where: { id, clienteId: cliente.id, ...(doMotorista ? { usuarioId: sessao.usuarioId } : {}) },
    select: { conteudo: true, formato: true, tipo: true, criadoEm: true },
  });
  if (!r) return new Response("Arquivo não encontrado", { status: 404 });
  const dados = new Uint8Array(r.conteudo);
  const total = dados.length;
  const nome = `carga-${r.criadoEm.toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${r.formato === "image/jpeg" ? "jpg" : r.formato === "video/mp4" ? "mp4" : "webm"}`;
  const base = {
    "Content-Type": r.formato,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Content-Disposition": `${new URL(req.url).searchParams.has("baixar") ? "attachment" : "inline"}; filename="${nome}"`,
  };
  const faixa = faixaPedida(req.headers.get("range"), total);
  if (faixa) {
    return new Response(dados.slice(faixa.inicio, faixa.fim + 1), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${faixa.inicio}-${faixa.fim}/${total}`, "Content-Length": String(faixa.fim - faixa.inicio + 1) },
    });
  }
  return new Response(dados, { headers: { ...base, "Content-Length": String(total) } });
}
