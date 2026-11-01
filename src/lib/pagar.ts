// Contas a pagar: vencimentos, parcelas e situação de cada conta.

const DIA = 86_400_000;

export const CATEGORIAS_PAGAR = {
  PARCELA: "Parcela de caminhão",
  SEGURO: "Seguro",
  SALARIO: "Salário",
  OFICINA: "Oficina e peças",
  IMPOSTO: "Imposto e taxa",
  ALUGUEL: "Aluguel",
  OUTRO: "Outro",
} as const;
export type CategoriaPagar = keyof typeof CATEGORIAS_PAGAR;

/** Datas das parcelas: mesmo dia de cada mês; num mês mais curto, cai no último dia. */
export function datasParcelas(primeira: Date, quantas: number): Date[] {
  const dia = primeira.getUTCDate();
  return Array.from({ length: quantas }, (_, i) => {
    const ano = primeira.getUTCFullYear();
    const mes = primeira.getUTCMonth() + i;
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo)));
  });
}

export function diasAte(venc: Date, hoje: Date): number {
  const d0 = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.round((venc.getTime() - d0) / DIA);
}

export type SituacaoPagar = "vencida" | "hoje" | "semana" | "mes" | "depois";

export function situacaoPagar(venc: Date, hoje: Date): SituacaoPagar {
  const d = diasAte(venc, hoje);
  if (d < 0) return "vencida";
  if (d === 0) return "hoje";
  if (d <= 7) return "semana";
  if (d <= 30) return "mes";
  return "depois";
}

type Conta = { valorUsd: number; vencimento: Date; pagoEm: Date | null };

export function totaisPagar(contas: Conta[], hoje: Date) {
  const abertas = contas.filter((c) => !c.pagoEm);
  const soma = (xs: Conta[]) => Math.round(xs.reduce((t, c) => t + c.valorUsd, 0) * 100) / 100;
  const sit = (c: Conta) => situacaoPagar(c.vencimento, hoje);
  const inicioMes = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1);
  return {
    vencido: soma(abertas.filter((c) => sit(c) === "vencida")),
    semana: soma(abertas.filter((c) => sit(c) === "hoje" || sit(c) === "semana")),
    trintaDias: soma(abertas.filter((c) => sit(c) !== "depois")),
    pagoNoMes: soma(contas.filter((c) => c.pagoEm && c.pagoEm.getTime() >= inicioMes)),
  };
}
