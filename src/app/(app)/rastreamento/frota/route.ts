import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { frotaNoMapa } from "@/lib/rastreio/dados";

// Posição atual de cada caminhão, pedida pelo mapa a cada 30 segundos.
export const dynamic = "force-dynamic";

export async function GET() {
  const { cliente } = await clienteAtual();
  return NextResponse.json(await frotaNoMapa(cliente.id));
}
