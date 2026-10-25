import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { dadosComandos } from "@/lib/comandos/dados";

// Pedido pela tela de comandos enquanto ela está aberta: avança a fila e devolve o histórico.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && new URL(req.url).searchParams.get("todos") === "1";
  return NextResponse.json(await dadosComandos(todos ? null : cliente.id));
}
