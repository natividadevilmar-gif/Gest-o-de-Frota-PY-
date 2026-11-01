import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { MAX_DIAS_TRAJETO, resumoDoCaminhao, trajetoDoDia } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const q = new URL(req.url).searchParams;
  const data = (x: string | null) => (/^\d{4}-\d{2}-\d{2}$/.test(x ?? "") ? new Date(`${x}T00:00:00Z`) : null);
  // `dia` é o primeiro dia e `ate` o último (sem `ate`, só o dia); no máximo MAX_DIAS_TRAJETO dias.
  const ate = data(q.get("ate")) ?? data(q.get("dia")) ?? diaNoParaguai(new Date());
  const inicio = data(q.get("dia")) ?? ate;
  const dia = new Date(Math.max(Math.min(inicio.getTime(), ate.getTime()), ate.getTime() - (MAX_DIAS_TRAJETO - 1) * 86_400_000));
  const dono = sessao.papel === "ADMIN" ? null : cliente.id;
  const id = q.get("caminhao") ?? "";
  const [t, resumo] = await Promise.all([trajetoDoDia(dono, id, dia, new Date(), ate), resumoDoCaminhao(dono, id)]);
  return t ? NextResponse.json({ ...t, resumo }) : NextResponse.json({ erro: "caminhão sem rastreador" }, { status: 404 });
}
