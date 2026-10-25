import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { dadosCentral } from "@/lib/monitoramento";

// Pedido pela central a cada 15 segundos: verifica a frota, grava alertas novos e devolve a fila.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && new URL(req.url).searchParams.get("todos") === "1";
  return NextResponse.json(await dadosCentral(todos ? null : cliente.id));
}
