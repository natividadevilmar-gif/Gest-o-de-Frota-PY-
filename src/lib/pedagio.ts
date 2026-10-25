// Pedágio previsto de uma rota: soma das praças do caminho pelo número de eixos do caminhão.
// Funções puras; as praças e rotas ficam no banco (PracaPedagio, RotaPedagio).

export type Praca = {
  id: string; pais: string; rodovia: string; nome: string; moeda: string;
  tarifaEixo: number | null; tarifaFixa: number | null;
};

/** Valor de uma praça para um caminhão com `eixos` eixos, na moeda da praça. */
export function valorPraca(p: Praca, eixos: number): number {
  if (p.tarifaEixo != null) return Math.round(p.tarifaEixo * eixos * 100) / 100;
  return p.tarifaFixa ?? 0;
}

/** Unidades da moeda por 1 dólar (USD = 1). */
export type Taxas = Record<string, number>;

export type Previsto = {
  porMoeda: { moeda: string; valor: number }[];
  usd: number;
  itens: (Praca & { valor: number; usd: number })[];
  /** Praças sem tarifa ou com moeda sem cotação: ficam fora do total. */
  semValor: string[];
};

export function previstoRota(pracas: Praca[], eixos: number, taxas: Taxas): Previsto {
  const soma = new Map<string, number>();
  const itens: Previsto["itens"] = [];
  const semValor: string[] = [];
  let usd = 0;
  for (const p of pracas) {
    const valor = valorPraca(p, eixos);
    const t = taxas[p.moeda];
    if (!valor || !t) {
      semValor.push(p.nome);
      continue;
    }
    const emUsd = Math.round((valor / t) * 100) / 100;
    usd += emUsd;
    soma.set(p.moeda, (soma.get(p.moeda) ?? 0) + valor);
    itens.push({ ...p, valor, usd: emUsd });
  }
  return {
    porMoeda: [...soma].map(([moeda, valor]) => ({ moeda, valor: Math.round(valor * 100) / 100 })),
    usd: Math.round(usd * 100) / 100,
    itens,
    semValor,
  };
}

export const SIMBOLO_PEDAGIO: Record<string, string> = { USD: "USD", PYG: "₲", BRL: "R$", ARS: "AR$", UYU: "$U" };

/** Taxas do dia para o pedágio. O peso uruguaio não está na cotação diária: usa um valor fixo. */
export function taxasPedagio(c: { pygPorUsd: number; brlPorUsd: number; arsPorUsd: number }, uyuPorUsd: number): Taxas {
  return { USD: 1, PYG: c.pygPorUsd, BRL: c.brlPorUsd, ARS: c.arsPorUsd, UYU: uyuPorUsd };
}

export type RotaComPracas = { id: string; nome: string; km: number; paises: string; pracas: Praca[] };
