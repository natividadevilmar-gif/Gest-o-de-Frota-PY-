// Conversão de moeda local para USD. Funções puras; a busca da cotação fica em cotacao.ts.

export type Moeda = "USD" | "PYG" | "BRL";
export type Cotacoes = { pygPorUsd: number; brlPorUsd: number };

export function paraUsd(valor: number, moeda: Moeda, c: Cotacoes): number {
  const usd = moeda === "USD" ? valor : moeda === "PYG" ? valor / c.pygPorUsd : valor / c.brlPorUsd;
  return Math.round(usd * 100) / 100;
}

export function taxa(moeda: Moeda, c: Cotacoes): number | null {
  return moeda === "USD" ? null : moeda === "PYG" ? c.pygPorUsd : c.brlPorUsd;
}

export const SIMBOLO: Record<Moeda, string> = { USD: "USD", PYG: "₲", BRL: "R$" };
