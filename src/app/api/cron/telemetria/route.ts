import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fonteTelemetria } from "@/lib/telemetria";
import { sincronizarDia } from "@/lib/telemetria/sincronizar";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

// Chamado todo dia pela Vercel (vercel.json) logo depois da meia-noite do Paraguai:
// resume o dia anterior de cada caminhão em km, litros e alertas.
// Pode receber ?dia=AAAA-MM-DD para refazer um dia específico.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const autorizado = segredo
    ? req.headers.get("authorization") === `Bearer ${segredo}`
    : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!autorizado) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const param = req.nextUrl.searchParams.get("dia");
  const hoje = diaNoParaguai(new Date());
  const dia = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? new Date(`${param}T00:00:00Z`) : new Date(hoje.getTime() - 86_400_000);
  const fonte = fonteTelemetria();
  const r = await sincronizarDia(db, fonte, dia);
  return NextResponse.json({ dia: dia.toISOString().slice(0, 10), fonte: fonte.nome, ...r });
}
