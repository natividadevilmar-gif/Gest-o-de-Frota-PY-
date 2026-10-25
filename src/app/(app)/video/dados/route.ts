import { NextResponse } from "next/server";
import { clienteAtual } from "@/lib/acesso";
import { processarComandos } from "@/lib/comandos/dados";
import { dadosVideo } from "@/lib/video";

// Pedido pela tela de vídeo: avança os pedidos de foto e vídeo e devolve a galeria.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && new URL(req.url).searchParams.get("todos") === "1";
  await processarComandos(todos ? null : cliente.id);
  return NextResponse.json(await dadosVideo(todos ? null : cliente.id));
}
