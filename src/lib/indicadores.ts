// Cálculos do módulo próprio: custo por km, consumo, revisões, margem e cobrança.
// Funções puras, sem banco, para serem testadas e reutilizadas nas telas e nos relatórios.

export type Plano = "BASICO" | "GESTAO" | "VIDEO";

export const PRECO_MENSAL: Record<Plano, number> = { BASICO: 16, GESTAO: 28, VIDEO: 52 };
export const NOME_PLANO: Record<Plano, string> = { BASICO: "Básico", GESTAO: "Gestão", VIDEO: "Vídeo" };
const ORDEM_PLANO: Plano[] = ["BASICO", "GESTAO", "VIDEO"];

export type Modulo = "painel" | "caminhoes" | "despesas" | "custos" | "consumo" | "revisoes" | "viagens" | "video";

const PLANO_MINIMO: Record<Modulo, Plano> = {
  painel: "BASICO",
  caminhoes: "BASICO",
  // Lançar despesa vale em todos os planos; o relatório de custo por km continua no Gestão.
  despesas: "BASICO",
  custos: "GESTAO",
  consumo: "GESTAO",
  revisoes: "GESTAO",
  viagens: "GESTAO",
  video: "VIDEO",
};

export function planoPermite(plano: Plano, modulo: Modulo): boolean {
  return ORDEM_PLANO.indexOf(plano) >= ORDEM_PLANO.indexOf(PLANO_MINIMO[modulo]);
}

export function planoMinimo(modulo: Modulo): Plano {
  return PLANO_MINIMO[modulo];
}

// ---- Custo por km ----

export type CustosMes = {
  variaveis: { categoria: string; valorUsd: number }[];
  salarioMotorista: number;
  seguroMensal: number;
  depreciacaoMensal: number;
};

export function composicaoCusto(c: CustosMes): Record<string, number> {
  const out: Record<string, number> = {
    Combustível: 0,
    Alimentação: 0,
    Pedágio: 0,
    Manutenção: 0,
    Borracharia: 0,
    Outros: 0,
    Motorista: c.salarioMotorista,
    Seguro: c.seguroMensal,
    Depreciação: c.depreciacaoMensal,
  };
  const nome: Record<string, string> = {
    DIESEL: "Combustível",
    ARLA32: "Combustível",
    ALIMENTACAO: "Alimentação",
    PNEUS: "Borracharia",
    MANUTENCAO: "Manutenção",
    PEDAGIO: "Pedágio",
    OUTROS: "Outros",
  };
  for (const d of c.variaveis) out[nome[d.categoria] ?? "Outros"] += d.valorUsd;
  return out;
}

/** Categorias lançadas como despesa, na ordem do relatório. Os custos fixos vêm depois. */
export const CATEGORIAS_DESPESA = ["Combustível", "Alimentação", "Pedágio", "Manutenção", "Borracharia", "Outros"] as const;
export const CATEGORIAS_FIXAS = ["Motorista", "Seguro", "Depreciação"] as const;

export const NOME_CATEGORIA: Record<string, string> = {
  DIESEL: "Combustível: diesel",
  ARLA32: "Combustível: Arla 32",
  ALIMENTACAO: "Alimentação",
  PEDAGIO: "Pedágio",
  MANUTENCAO: "Manutenção",
  PNEUS: "Borracharia",
  OUTROS: "Outros",
};

export function custoTotal(c: CustosMes): number {
  return Object.values(composicaoCusto(c)).reduce((a, b) => a + b, 0);
}

/** Custo do mês dividido pelo km rodado medido pelo GPS. Null quando o caminhão não rodou. */
export function custoPorKm(custoTotalUsd: number, km: number): number | null {
  return km > 0 ? custoTotalUsd / km : null;
}

// ---- Consumo ----

export function kmPorLitro(km: number, litros: number | null): number | null {
  return litros && litros > 0 ? km / litros : null;
}

/** Diferença percentual entre litros abastecidos e litros consumidos medidos pela CAN. */
export function desvioCombustivelPct(litrosAbastecidos: number, litrosCan: number | null): number | null {
  if (!litrosCan || litrosCan <= 0) return null;
  return ((litrosAbastecidos - litrosCan) / litrosCan) * 100;
}

export const LIMITE_DESVIO_PCT = 3;

export function suspeitaDesvio(desvioPct: number | null): boolean {
  return desvioPct !== null && desvioPct > LIMITE_DESVIO_PCT;
}

/** Percentual acima (positivo) ou abaixo (negativo) do consumo de referência do modelo. */
export function comparacaoReferenciaPct(kmL: number | null, refKmL: number): number | null {
  return kmL === null || refKmL <= 0 ? null : (kmL / refKmL - 1) * 100;
}

export type Abastecimento = { data: Date; litros: number; odometroKm: number | null; tanqueCheio: boolean };

/**
 * Consumo medido pelo método do tanque cheio: entre dois abastecimentos de tanque
 * cheio, km rodado (diferença de odômetro) ÷ litros colocados depois do primeiro.
 * Devolve o km/l no abastecimento que fecha cada intervalo, ou null quando não dá
 * para medir (sem odômetro, tanque não completado ou sem tanque cheio anterior).
 * Resultados fora de 0,5 a 8 km/l indicam odômetro digitado errado e também viram null.
 */
const KM_L_MIN = 0.5;
const KM_L_MAX = 8;

export function consumoPorAbastecimento(abast: Abastecimento[]): (number | null)[] {
  const ordem = abast.map((a, i) => ({ a, i })).sort((x, y) => x.a.data.getTime() - y.a.data.getTime() || (x.a.odometroKm ?? 0) - (y.a.odometroKm ?? 0));
  const out: (number | null)[] = abast.map(() => null);
  let ultimoCheio: number | null = null;
  let litros = 0;
  for (const { a, i } of ordem) {
    if (ultimoCheio !== null) litros += a.litros;
    if (a.tanqueCheio && a.odometroKm !== null) {
      if (ultimoCheio !== null && litros > 0 && a.odometroKm > ultimoCheio) {
        const kmL = (a.odometroKm - ultimoCheio) / litros;
        out[i] = kmL >= KM_L_MIN && kmL <= KM_L_MAX ? kmL : null;
      }
      ultimoCheio = a.odometroKm;
      litros = 0;
    }
  }
  return out;
}

/** Litros gastos a mais do que gastaria rodando na referência do modelo. */
export function litrosExcedentes(km: number, litros: number | null, refKmL: number): number {
  if (!litros || refKmL <= 0) return 0;
  return Math.max(0, litros - km / refKmL);
}

// ---- Revisões ----

export type ItemRevisaoEntrada =
  | { gatilho: "KM"; intervaloKm: number; ultimoKm: number }
  | { gatilho: "DATA"; vencimento: Date }
  | { gatilho: "FALHA"; resolvido: boolean };

export type SituacaoRevisao = "vencida" | "proxima" | "em_dia";

export type StatusRevisao = {
  situacao: SituacaoRevisao;
  /** Km que faltam (negativo = passou). Só para gatilho KM. */
  kmRestantes?: number;
  /** Dias que faltam (negativo = venceu). Só para gatilho DATA. */
  diasRestantes?: number;
  /** Quanto do intervalo já foi usado, de 0 a 1. */
  usoIntervalo: number;
  venceAosKm?: number;
};

export const AVISO_KM = 1000;
export const AVISO_DIAS = 15;
const DIA_MS = 86_400_000;

export function statusRevisao(item: ItemRevisaoEntrada, odometroKm: number, hoje: Date): StatusRevisao {
  if (item.gatilho === "FALHA") {
    return { situacao: item.resolvido ? "em_dia" : "vencida", usoIntervalo: item.resolvido ? 0 : 1 };
  }
  if (item.gatilho === "DATA") {
    const dias = Math.round((inicioDoDia(item.vencimento) - inicioDoDia(hoje)) / DIA_MS);
    return {
      situacao: dias < 0 ? "vencida" : dias <= AVISO_DIAS ? "proxima" : "em_dia",
      diasRestantes: dias,
      usoIntervalo: clamp01(1 - dias / 90),
    };
  }
  const venceAosKm = item.ultimoKm + item.intervaloKm;
  const resto = venceAosKm - odometroKm;
  return {
    situacao: resto < 0 ? "vencida" : resto <= AVISO_KM ? "proxima" : "em_dia",
    kmRestantes: resto,
    venceAosKm,
    usoIntervalo: clamp01((odometroKm - item.ultimoKm) / item.intervaloKm),
  };
}

// ---- Viagens ----

export type Margem = { kmTotal: number; custoUsd: number; margemUsd: number; margemPct: number | null };

/** Frete recebido menos custo por km vezes a distância total, incluindo o retorno vazio. */
export function margemViagem(freteUsd: number, kmCarregado: number, kmVazio: number, custoKm: number, extrasUsd = 0): Margem {
  const kmTotal = kmCarregado + kmVazio;
  const custoUsd = kmTotal * custoKm + extrasUsd;
  const margemUsd = freteUsd - custoUsd;
  return { kmTotal, custoUsd, margemUsd, margemPct: freteUsd > 0 ? (margemUsd / freteUsd) * 100 : null };
}

/** Menor frete por tonelada que cobre o custo da viagem. */
export function freteMinimoPorTonelada(toneladas: number, kmCarregado: number, kmVazio: number, custoKm: number): number | null {
  return toneladas > 0 ? ((kmCarregado + kmVazio) * custoKm) / toneladas : null;
}

export type EntradaSimulacao = {
  toneladas: number;
  freteTonelada: number;
  kmIda: number;
  voltaVazio: boolean;
  kmLCarregado: number;
  kmLVazio: number;
  precoDiesel: number;
  /** Custo por km sem o diesel: manutenção, pneus, motorista, seguro... */
  outrosKm: number;
  pedagioIda: number;
  extras: number;
};

/**
 * Simulação de um frete antes de aceitar. Voltando vazio, a volta entra no custo
 * (km, diesel com o km/l de vazio e pedágio); voltando carregado, ela é outro frete.
 */
export function simularFrete(e: EntradaSimulacao) {
  const kmVolta = e.voltaVazio ? e.kmIda : 0;
  const kmTotal = e.kmIda + kmVolta;
  const litros = (e.kmLCarregado > 0 ? e.kmIda / e.kmLCarregado : 0) + (e.kmLVazio > 0 ? kmVolta / e.kmLVazio : 0);
  const diesel = litros * e.precoDiesel;
  const outros = kmTotal * e.outrosKm;
  const pedagio = e.pedagioIda * (e.voltaVazio ? 2 : 1);
  const custo = diesel + outros + pedagio + e.extras;
  const frete = e.toneladas * e.freteTonelada;
  const margem = frete - custo;
  return {
    kmVolta,
    kmTotal,
    litros,
    diesel,
    outros,
    pedagio,
    custo,
    frete,
    margem,
    margemPct: frete > 0 ? (margem / frete) * 100 : null,
    custoKm: kmTotal > 0 ? custo / kmTotal : null,
    freteMinimoTonelada: e.toneladas > 0 ? custo / e.toneladas : null,
  };
}

/** Frete por tonelada que deixa a margem pedida (em %) sobre o custo da simulação. */
export function freteSugeridoTonelada(custo: number, toneladas: number, margemPct: number): number | null {
  return toneladas > 0 && margemPct < 100 ? custo / (1 - margemPct / 100) / toneladas : null;
}

// ---- Cobrança (visão interna) ----

export const DIAS_PARA_BLOQUEIO = 15;

export type SituacaoPagamento = "em_dia" | "atrasado" | "bloqueado";

export function situacaoPagamento(diasEmAtraso: number): SituacaoPagamento {
  if (diasEmAtraso <= 0) return "em_dia";
  return diasEmAtraso > DIAS_PARA_BLOQUEIO ? "bloqueado" : "atrasado";
}

export function mensalidadeTotal(planos: Plano[]): number {
  return planos.reduce((a, p) => a + PRECO_MENSAL[p], 0);
}

// ---- utilidades ----

function inicioDoDia(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Primeiro dia do mês (UTC) e primeiro dia do mês seguinte, a partir de "AAAA-MM". */
export function intervaloMes(mes: string): { inicio: Date; fim: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) throw new Error(`Mês inválido: ${mes}`);
  const ano = Number(m[1]);
  const idx = Number(m[2]) - 1;
  return { inicio: new Date(Date.UTC(ano, idx, 1)), fim: new Date(Date.UTC(ano, idx + 1, 1)) };
}

/**
 * Fração do mês já decorrida, para ratear os custos fixos mensais num mês em andamento.
 * Conta os dias completos antes de hoje (a telemetria chega com um dia de atraso).
 * Meses passados valem 1; meses futuros, 0.
 */
export function fracaoMes(mes: string, hoje = new Date()): number {
  const { inicio, fim } = intervaloMes(mes);
  const dia = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (dia >= fim.getTime()) return 1;
  if (dia <= inicio.getTime()) return 0;
  return (dia - inicio.getTime()) / (fim.getTime() - inicio.getTime());
}

export function mesAtual(hoje = new Date()): string {
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;
}
