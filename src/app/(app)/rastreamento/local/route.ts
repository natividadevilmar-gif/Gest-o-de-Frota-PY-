import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { nomeDoLocal } from "@/lib/rastreio/local";

export const dynamic = "force-dynamic";

/** Nome do lugar de um ponto do mapa (?lat=&lng=), para a dica dos alertas do trajeto. */
export async function GET(req: Request) {
  await clienteAtual();
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat")), lng = Number(q.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ erro: "ponto inválido" }, { status: 400 });
  }
  return NextResponse.json({ local: await nomeDoLocal(lat, lng) });
}
