import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { espelharWialon, Wialon } from "@/lib/rastreio/wialon";

// Traz as posições novas do Wialon. Quem roda o receptor próprio não precisa desta rota:
// ele já espelha o Wialon a cada minuto. Ela serve para chamar de fora (cron externo,
// ou a Vercel no plano Pro, que aceita agendamento por minuto).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const autorizado = segredo
    ? req.headers.get("authorization") === `Bearer ${segredo}`
    : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!autorizado) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  if (!process.env.WIALON_TOKEN) return NextResponse.json({ erro: "WIALON_TOKEN não definido" }, { status: 503 });

  const api = Wialon.doAmbiente();
  try {
    return NextResponse.json(await espelharWialon(db, api));
  } finally {
    await api.sair();
  }
}
