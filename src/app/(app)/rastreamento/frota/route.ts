import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { frotaNoMapa } from "@/lib/rastreio/dados";

// Posição atual de cada caminhão, pedida pelo mapa a cada 30 segundos.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && new URL(req.url).searchParams.get("todos") === "1";
  return NextResponse.json(await frotaNoMapa(todos ? null : cliente.id));
}
