// Conversão de moeda local para USD. Funções puras; a busca da cotação fica em cotacao.ts.

export type Moeda = "USD" | "PYG" | "BRL" | "ARS";
export type Cotacoes = { pygPorUsd: number; brlPorUsd: number; arsPorUsd: number };

export function paraUsd(valor: number, moeda: Moeda, c: Cotacoes): number {
  const t = taxa(moeda, c);
  const usd = t === null ? valor : valor / t;
  return Math.round(usd * 100) / 100;
}

export function taxa(moeda: Moeda, c: Cotacoes): number | null {
  return { USD: null, PYG: c.pygPorUsd, BRL: c.brlPorUsd, ARS: c.arsPorUsd }[moeda];
}

export const SIMBOLO: Record<Moeda, string> = { USD: "USD", PYG: "₲", BRL: "R$", ARS: "AR$" };
