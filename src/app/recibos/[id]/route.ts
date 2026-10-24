import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { cliente } = await clienteAtual();
  const { id } = await params;
  const d = await db.despesa.findFirst({ where: { id, caminhao: { clienteId: cliente.id } }, select: { recibo: true, reciboTipo: true } });
  if (!d?.recibo) return new Response("Recibo não encontrado", { status: 404 });
  return new Response(new Uint8Array(d.recibo), {
    headers: { "Content-Type": d.reciboTipo ?? "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
