import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { trajetoDoDia } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const q = new URL(req.url).searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get("dia") ?? "") ? new Date(`${q.get("dia")}T00:00:00Z`) : diaNoParaguai(new Date());
  const t = await trajetoDoDia(sessao.papel === "ADMIN" ? null : cliente.id, q.get("caminhao") ?? "", dia);
  return t ? NextResponse.json(t) : NextResponse.json({ erro: "caminhão sem rastreador" }, { status: 404 });
}
