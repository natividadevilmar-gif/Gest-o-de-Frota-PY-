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
  if (salva) return formatar(salva);

  try {
    const r = await fetch(FONTE_URL, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { rates?: Record<string, number> };
      const pyg = j.rates?.PYG;
      const brl = j.rates?.BRL;
      if (pyg && brl) {
        const nova = await db.cotacao.upsert({
          where: { data: hoje },
          create: { data: hoje, pygPorUsd: pyg, brlPorUsd: brl, fonte: "open.er-api.com" },
          update: {},
        });
        return formatar(nova);
      }
    }
  } catch {
    // segue para a última cotação conhecida
  }

  const ultima = await db.cotacao.findFirst({ orderBy: { data: "desc" } });
  if (ultima) return formatar(ultima);
  return {
    data: hoje.toISOString().slice(0, 10),
    pygPorUsd: Number(process.env.COTACAO_PYG_POR_USD ?? 7300),
    brlPorUsd: Number(process.env.COTACAO_BRL_POR_USD ?? 5.4),
    fonte: "valor padrão do sistema",
  };
}

/** Cotação informada à mão pela equipe interna; vale para o dia de hoje. */
export async function definirCotacao(pygPorUsd: number, brlPorUsd: number) {
  const hoje = hojeUtc();
  await db.cotacao.upsert({
    where: { data: hoje },
    create: { data: hoje, pygPorUsd, brlPorUsd, fonte: "manual" },
    update: { pygPorUsd, brlPorUsd, fonte: "manual" },
  });
}

function formatar(c: { data: Date; pygPorUsd: number; brlPorUsd: number; fonte: string }): CotacaoDia {
  return { data: c.data.toISOString().slice(0, 10), pygPorUsd: c.pygPorUsd, brlPorUsd: c.brlPorUsd, fonte: c.fonte };
}
