import "server-only";
import { db } from "@/lib/db";
import type { Cotacoes } from "@/lib/cambio";

const FONTE_URL = "https://open.er-api.com/v6/latest/USD";

export type CotacaoDia = Cotacoes & { data: string; fonte: string };

function hojeUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Cotação de hoje. Busca uma vez por dia na fonte pública e guarda no banco.
 * Se a fonte falhar, usa a última cotação guardada e, sem nenhuma, os valores do .env.
 */
export async function cotacaoDoDia(): Promise<CotacaoDia> {
  const hoje = hojeUtc();
  const salva = await db.cotacao.findUnique({ where: { data: hoje } });
  // Cotações guardadas antes do peso argentino não têm ARS: busca de novo só para completar.
  if (salva && (salva.arsPorUsd !== null || salva.fonte === "manual")) return formatar(salva);

  try {
    const r = await fetch(FONTE_URL, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { rates?: Record<string, number> };
      const pyg = j.rates?.PYG;
      const brl = j.rates?.BRL;
      const ars = j.rates?.ARS;
      if (pyg && brl && ars) {
        const nova = await db.cotacao.upsert({
          where: { data: hoje },
          create: { data: hoje, pygPorUsd: pyg, brlPorUsd: brl, arsPorUsd: ars, fonte: "open.er-api.com" },
          update: { arsPorUsd: ars },
        });
        return formatar(nova);
      }
    }
  } catch {
    // segue para a última cotação conhecida
  }

  if (salva) return formatar(salva);
  const ultima = await db.cotacao.findFirst({ orderBy: { data: "desc" } });
  if (ultima) return formatar(ultima);
  return {
    data: hoje.toISOString().slice(0, 10),
    pygPorUsd: Number(process.env.COTACAO_PYG_POR_USD ?? 7300),
    brlPorUsd: Number(process.env.COTACAO_BRL_POR_USD ?? 5.4),
    arsPorUsd: arsPadrao(),
    fonte: "valor padrão do sistema",
  };
}

/** Cotação informada à mão pela equipe interna; vale para o dia de hoje. */
export async function definirCotacao(pygPorUsd: number, brlPorUsd: number, arsPorUsd: number) {
  const hoje = hojeUtc();
  await db.cotacao.upsert({
    where: { data: hoje },
    create: { data: hoje, pygPorUsd, brlPorUsd, arsPorUsd, fonte: "manual" },
    update: { pygPorUsd, brlPorUsd, arsPorUsd, fonte: "manual" },
  });
}

function arsPadrao() {
  return Number(process.env.COTACAO_ARS_POR_USD ?? 1450);
}

function formatar(c: { data: Date; pygPorUsd: number; brlPorUsd: number; arsPorUsd: number | null; fonte: string }): CotacaoDia {
  return {
    data: c.data.toISOString().slice(0, 10),
    pygPorUsd: c.pygPorUsd,
    brlPorUsd: c.brlPorUsd,
    arsPorUsd: c.arsPorUsd ?? arsPadrao(),
    fonte: c.fonte,
  };
}
