import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { resumoDoCaminhao, trajetoDoDia } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const q = new URL(req.url).searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(q.get("dia") ?? "") ? new Date(`${q.get("dia")}T00:00:00Z`) : diaNoParaguai(new Date());
  const dono = sessao.papel === "ADMIN" ? null : cliente.id;
  const id = q.get("caminhao") ?? "";
  const [t, resumo] = await Promise.all([trajetoDoDia(dono, id, dia), resumoDoCaminhao(dono, id)]);
  return t ? NextResponse.json({ ...t, resumo }) : NextResponse.json({ erro: "caminhão sem rastreador" }, { status: 404 });
}
