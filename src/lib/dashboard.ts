// Dashboard: séries por dia e por semana dos últimos dias, para os gráficos da operação e do financeiro.

const DIA = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const diaUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export const PERIODOS = [30, 60, 90] as const;
export type Periodo = (typeof PERIODOS)[number];

export function periodoValido(p: string | undefined): Periodo {
  const n = Number(p);
  return (PERIODOS as readonly number[]).includes(n) ? (n as Periodo) : 30;
}

/** Primeiro dia da janela: `dias` dias contando hoje. */
export function inicioJanela(hoje: Date, dias: number): Date {
  return new Date(diaUtc(hoje) - (dias - 1) * DIA);
}

export type PontoDia = { dia: Date; valor: number };

/** Soma por dia, com zero nos dias sem registro, do primeiro ao último dia da janela. */
export function porDia(itens: { data: Date; valor: number }[], inicio: Date, dias: number): PontoDia[] {
  const d0 = diaUtc(inicio);
  const out = Array.from({ length: dias }, (_, i) => ({ dia: new Date(d0 + i * DIA), valor: 0 }));
  for (const it of itens) {
    const i = Math.round((diaUtc(it.data) - d0) / DIA);
    if (i >= 0 && i < dias) out[i].valor += it.valor;
  }
  return out.map((p) => ({ ...p, valor: r2(p.valor) }));
}

export type Semana = { inicio: Date; fim: Date; fretes: number; despesas: number };

/**
 * Fretes e despesas por semana, em blocos de 7 dias que terminam hoje (a última semana é a atual).
 * Com uma janela que não divide por 7, a primeira semana fica mais curta.
 */
export function porSemana(fretes: { data: Date; valor: number }[], despesas: { data: Date; valor: number }[], hoje: Date, dias: number): Semana[] {
  const fim = diaUtc(hoje);
  const n = Math.ceil(dias / 7);
  const ini = fim - (dias - 1) * DIA;
  const out: Semana[] = Array.from({ length: n }, (_, k) => {
    const f = fim - (n - 1 - k) * 7 * DIA;
    return { inicio: new Date(Math.max(ini, f - 6 * DIA)), fim: new Date(f), fretes: 0, despesas: 0 };
  });
  const idx = (d: Date) => {
    const t = diaUtc(d);
    if (t < ini || t > fim) return -1;
    return n - 1 - Math.floor((fim - t) / (7 * DIA));
  };
  for (const x of fretes) { const i = idx(x.data); if (i >= 0) out[i].fretes += x.valor; }
  for (const x of despesas) { const i = idx(x.data); if (i >= 0) out[i].despesas += x.valor; }
  return out.map((s) => ({ ...s, fretes: r2(s.fretes), despesas: r2(s.despesas) }));
}

/** Soma por chave, da maior para a menor, sem as chaves zeradas. */
export function somaPor<T>(itens: T[], chave: (x: T) => string, valor: (x: T) => number): { nome: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const x of itens) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
  return [...m.entries()].map(([nome, v]) => ({ nome, valor: r2(v) })).filter((x) => x.valor !== 0).sort((a, b) => b.valor - a.valor);
}

/** Média móvel de `janela` dias (para a linha de tendência do km rodado). */
export function mediaMovel(pontos: PontoDia[], janela = 7): PontoDia[] {
  return pontos.map((p, i) => {
    const de = Math.max(0, i - janela + 1);
    const fatia = pontos.slice(de, i + 1);
    return { dia: p.dia, valor: r2(fatia.reduce((t, x) => t + x.valor, 0) / fatia.length) };
  });
}

/** Faixas de vencimento do que falta receber: vencido há mais de 30 dias, vencido, vence em 7 dias, depois. */
export function faixasReceber(itens: { vencimento: Date; saldo: number }[], hoje: Date) {
  const faixas = [
    { nome: "Vencido há mais de 30 dias", valor: 0 },
    { nome: "Vencido até 30 dias", valor: 0 },
    { nome: "Vence em até 7 dias", valor: 0 },
    { nome: "Vence depois", valor: 0 },
  ];
  const h = diaUtc(hoje);
  for (const x of itens) {
    if (x.saldo <= 0) continue;
    const d = Math.round((diaUtc(x.vencimento) - h) / DIA);
    faixas[d < -30 ? 0 : d < 0 ? 1 : d <= 7 ? 2 : 3].valor += x.saldo;
  }
  return faixas.map((f) => ({ ...f, valor: r2(f.valor) }));
}
