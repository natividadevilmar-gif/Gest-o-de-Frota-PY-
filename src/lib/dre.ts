// Resultado do mês (DRE simples) por caminhão e da empresa.

export const VARIAVEIS = ["Combustível", "Alimentação", "Pedágio", "Manutenção", "Borracharia", "Outros"] as const;
export const FIXOS = ["Motorista", "Seguro", "Depreciação"] as const;

export type LinhaDre = {
  id: string;
  placa: string;
  fretes: number;
  receita: number;
  variaveis: Record<string, number>;
  extras: number;
  totalVariavel: number;
  contribuicao: number;
  fixos: Record<string, number>;
  totalFixo: number;
  resultado: number;
  margemPct: number | null;
  km: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = (o: Record<string, number>) => Object.values(o).reduce((t, v) => t + v, 0);

export function linhaDre(c: { id: string; placa: string; km: number; composicao: Record<string, number> }, f: { receita: number; extras: number; fretes: number }): LinhaDre {
  const variaveis = Object.fromEntries(VARIAVEIS.map((k) => [k, r2(c.composicao[k] ?? 0)]));
  const fixos = Object.fromEntries(FIXOS.map((k) => [k, r2(c.composicao[k] ?? 0)]));
  const totalVariavel = r2(soma(variaveis) + f.extras);
  const totalFixo = r2(soma(fixos));
  const contribuicao = r2(f.receita - totalVariavel);
  const resultado = r2(contribuicao - totalFixo);
  return {
    id: c.id, placa: c.placa, km: c.km, fretes: f.fretes, receita: r2(f.receita), variaveis, extras: r2(f.extras), totalVariavel, contribuicao, fixos, totalFixo, resultado,
    margemPct: f.receita > 0 ? Math.round((resultado / f.receita) * 1000) / 10 : null,
  };
}

/** Soma da frota e o resultado da empresa depois das despesas administrativas (sem caminhão). */
export function totalDre(linhas: LinhaDre[], administrativas: number) {
  const s = (k: (l: LinhaDre) => number) => r2(linhas.reduce((t, l) => t + k(l), 0));
  const receita = s((l) => l.receita);
  const resultadoFrota = s((l) => l.resultado);
  const liquido = r2(resultadoFrota - administrativas);
  return {
    receita,
    variaveis: Object.fromEntries(VARIAVEIS.map((k) => [k, s((l) => l.variaveis[k])])),
    extras: s((l) => l.extras),
    totalVariavel: s((l) => l.totalVariavel),
    contribuicao: s((l) => l.contribuicao),
    fixos: Object.fromEntries(FIXOS.map((k) => [k, s((l) => l.fixos[k])])),
    totalFixo: s((l) => l.totalFixo),
    resultadoFrota,
    administrativas: r2(administrativas),
    liquido,
    margemPct: receita > 0 ? Math.round((liquido / receita) * 1000) / 10 : null,
    km: s((l) => l.km),
  };
}
