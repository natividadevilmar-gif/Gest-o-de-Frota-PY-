import "server-only";
import { db } from "@/lib/db";
import {
  comparacaoReferenciaPct,
  consumoPorAbastecimento,
  composicaoCusto,
  custoPorKm,
  desvioCombustivelPct,
  fracaoMes,
  intervaloMes,
  kmPorLitro,
  litrosExcedentes,
  margemViagem,
  statusRevisao,
  suspeitaDesvio,
  type ItemRevisaoEntrada,
  type Plano,
} from "@/lib/indicadores";

export type IndicadoresCaminhao = Awaited<ReturnType<typeof indicadoresFrota>>[number];

/** Indicadores do mês de cada caminhão de um cliente. */
export async function indicadoresFrota(clienteId: string, mes: string, hoje = new Date()) {
  const { inicio, fim } = intervaloMes(mes);
  // Num mês em andamento, os custos fixos entram proporcionais aos dias já rodados.
  const fracao = fracaoMes(mes, hoje);
  const caminhoes = await db.caminhao.findMany({
    where: { clienteId },
    orderBy: { placa: "asc" },
    include: {
      motorista: true,
      despesas: { where: { data: { gte: inicio, lt: fim } } },
      telemetria: { where: { data: { gte: inicio, lt: fim } } },
    },
  });

  return caminhoes.map((c) => {
    const km = soma(c.telemetria.map((t) => t.km));
    const temCan = c.telemetria.some((t) => t.litrosCan !== null);
    const litrosCan = temCan ? soma(c.telemetria.map((t) => t.litrosCan ?? 0)) : null;
    const litrosAbastecidos = soma(c.despesas.filter((d) => d.categoria === "DIESEL").map((d) => d.litros ?? 0));
    const composicao = composicaoCusto({
      variaveis: c.despesas,
      salarioMotorista: c.salarioMotorista * fracao,
      seguroMensal: c.seguroMensal * fracao,
      depreciacaoMensal: c.depreciacaoMensal * fracao,
    });
    const total = soma(Object.values(composicao));
    const kmL = kmPorLitro(km, litrosCan);
    const desvio = desvioCombustivelPct(litrosAbastecidos, litrosCan);
    const dias = c.telemetria.length || 1;
    return {
      id: c.id,
      placa: c.placa,
      modelo: c.modelo,
      plano: c.plano as Plano,
      motorista: c.motorista?.nome ?? null,
      odometroKm: c.odometroKm,
      consumoRefKmL: c.consumoRefKmL,
      km,
      litrosCan,
      litrosAbastecidos,
      composicao,
      custoTotal: total,
      custoKm: custoPorKm(total, km),
      kmL,
      vsReferenciaPct: comparacaoReferenciaPct(kmL, c.consumoRefKmL),
      litrosExcedentes: litrosExcedentes(km, litrosCan, c.consumoRefKmL),
      desvioPct: desvio,
      suspeitaDesvio: suspeitaDesvio(desvio),
      marchaLentaPct: soma(c.telemetria.map((t) => t.marchaLentaPct)) / dias,
      rpmAltoPct: soma(c.telemetria.map((t) => t.rpmAltoPct)) / dias,
      excessosVelocidade: soma(c.telemetria.map((t) => t.excessosVelocidade)),
      frenagensBruscas: soma(c.telemetria.map((t) => t.frenagensBruscas)),
    };
  });
}

export function totaisFrota(ind: IndicadoresCaminhao[]) {
  const km = soma(ind.map((i) => i.km));
  const custo = soma(ind.map((i) => i.custoTotal));
  const comCan = ind.filter((i) => i.litrosCan !== null);
  const litros = soma(comCan.map((i) => i.litrosCan ?? 0));
  return {
    km,
    custo,
    custoKm: custoPorKm(custo, km),
    kmL: kmPorLitro(soma(comCan.map((i) => i.km)), litros),
  };
}

export async function revisoesCliente(clienteId: string, hoje = new Date()) {
  const itens = await db.itemRevisao.findMany({
    where: { caminhao: { clienteId } },
    include: { caminhao: { select: { id: true, placa: true, odometroKm: true, plano: true } } },
  });
  const ordem = { vencida: 0, proxima: 1, em_dia: 2 } as const;
  return itens
    .map((i) => {
      const entrada: ItemRevisaoEntrada =
        i.gatilho === "KM"
          ? { gatilho: "KM", intervaloKm: i.intervaloKm ?? 0, ultimoKm: i.ultimoKm ?? 0 }
          : i.gatilho === "DATA"
            ? { gatilho: "DATA", vencimento: i.vencimento ?? hoje }
            : { gatilho: "FALHA", resolvido: i.resolvido };
      return { ...i, status: statusRevisao(entrada, i.caminhao.odometroKm, hoje) };
    })
    .sort((a, b) => ordem[a.status.situacao] - ordem[b.status.situacao]);
}

export async function viagensCliente(clienteId: string, mes: string, ind: IndicadoresCaminhao[]) {
  const { inicio, fim } = intervaloMes(mes);
  const viagens = await db.viagem.findMany({
    where: { caminhao: { clienteId }, data: { gte: inicio, lt: fim } },
    include: { caminhao: { select: { id: true, placa: true, eixos: true } }, motorista: { select: { nome: true } } },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  const custoKm = new Map(ind.map((i) => [i.id, i.custoKm]));
  return viagens.map((v) => {
    const ck = custoKm.get(v.caminhaoId) ?? null;
    return { ...v, custoKm: ck, margem: ck === null ? null : margemViagem(v.freteUsd, v.kmCarregado, v.kmVazio, ck, v.custosExtrasUsd) };
  });
}

/** Despesas do mês, com o km/l medido pelo método do tanque cheio nos abastecimentos de diesel. */
export async function lancamentosMes(clienteId: string, mes: string, caminhoes: Set<string>, usuarioId?: string) {
  const { inicio, fim } = intervaloMes(mes);
  const despesas = await db.despesa.findMany({
    where: { caminhao: { clienteId }, data: { gte: inicio, lt: fim }, ...(usuarioId ? { usuarioId } : {}) },
    include: { caminhao: { select: { placa: true } } },
    omit: { recibo: true },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  // Abastecimentos desde 60 dias antes do mês, para achar o tanque cheio anterior.
  const desde = new Date(inicio.getTime() - 60 * 86_400_000);
  const diesel = await db.despesa.findMany({
    where: { caminhao: { clienteId }, categoria: "DIESEL", data: { gte: desde, lt: fim } },
    select: { id: true, caminhaoId: true, data: true, litros: true, odometroKm: true, tanqueCheio: true },
  });
  const kmL = new Map<string, number>();
  for (const id of new Set(diesel.map((d) => d.caminhaoId))) {
    const doCaminhao = diesel.filter((d) => d.caminhaoId === id);
    const r = consumoPorAbastecimento(doCaminhao.map((d) => ({ data: d.data, litros: d.litros ?? 0, odometroKm: d.odometroKm, tanqueCheio: d.tanqueCheio })));
    doCaminhao.forEach((d, i) => r[i] !== null && kmL.set(d.id, r[i]!));
  }
  const comRecibo = new Set(
    (await db.despesa.findMany({ where: { id: { in: despesas.map((d) => d.id) }, recibo: { not: null } }, select: { id: true } })).map((d) => d.id),
  );
  return despesas
    .filter((d) => caminhoes.has(d.caminhaoId))
    .map((d) => ({ ...d, placa: d.caminhao.placa, kmLTanque: kmL.get(d.id) ?? null, temRecibo: comRecibo.has(d.id) }));
}

function soma(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

/** Despesas de um motorista no mês: as do caminhão que ele dirige e as que ele lançou pelo app. */
export async function despesasMotorista(clienteId: string, motoristaId: string, mes: string) {
  const motorista = await db.motorista.findFirst({
    where: { id: motoristaId, clienteId },
    include: { caminhoes: { select: { placa: true } }, acesso: { select: { id: true, email: true } } },
  });
  if (!motorista) return null;
  const { inicio, fim } = intervaloMes(mes);
  const despesas = await db.despesa.findMany({
    where: {
      caminhao: { clienteId },
      data: { gte: inicio, lt: fim },
      OR: [{ caminhao: { motoristaId: motorista.id } }, ...(motorista.acesso ? [{ usuarioId: motorista.acesso.id }] : [])],
    },
    include: { caminhao: { select: { placa: true } }, usuario: { select: { nome: true, papel: true } } },
    omit: { recibo: true },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  return { motorista, despesas };
}

/** Saldo em caixa da empresa, acumulado mês a mês: saldo anterior + fretes do mês − despesas do mês. */
export async function saldoEmpresa(clienteId: string, mes: string) {
  const { inicio, fim } = intervaloMes(mes);
  const somaFretes = (data: { lt: Date; gte?: Date }) =>
    db.viagem.aggregate({ where: { caminhao: { clienteId }, data }, _sum: { freteUsd: true, custosExtrasUsd: true } });
  const somaDespesas = (data: { lt: Date; gte?: Date }) => db.despesa.aggregate({ where: { caminhao: { clienteId }, data }, _sum: { valorUsd: true } });
  const [fAntes, dAntes, fMes, dMes, aReceber] = await Promise.all([
    somaFretes({ lt: inicio }),
    somaDespesas({ lt: inicio }),
    somaFretes({ gte: inicio, lt: fim }),
    somaDespesas({ gte: inicio, lt: fim }),
    db.viagem.aggregate({ where: { caminhao: { clienteId }, data: { lt: fim }, recebido: false }, _sum: { freteUsd: true } }),
  ]);
  const anterior = (fAntes._sum.freteUsd ?? 0) - (fAntes._sum.custosExtrasUsd ?? 0) - (dAntes._sum.valorUsd ?? 0);
  const fretes = fMes._sum.freteUsd ?? 0;
  const despesas = (dMes._sum.valorUsd ?? 0) + (fMes._sum.custosExtrasUsd ?? 0);
  return { anterior, fretes, despesas, saldo: anterior + fretes - despesas, aReceber: aReceber._sum.freteUsd ?? 0 };
}

/**
 * Caixas de viagem dos motoristas, com quanto já gastaram de cada um. Contam as despesas lançadas
 * pelo login do motorista desde a entrega do dinheiro até o próximo caixa dele ou o fechamento;
 * motorista sem login conta as despesas do caminhão do caixa, menos manutenção e pneus.
 */
export async function caixasMotoristas(clienteId: string, filtro: { motoristaId?: string } = {}) {
  const caixas = await db.caixaViagem.findMany({
    where: { clienteId, ...(filtro.motoristaId ? { motoristaId: filtro.motoristaId } : {}) },
    include: { motorista: { select: { nome: true, acesso: { select: { id: true } } } }, caminhao: { select: { placa: true } } },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
  });
  return Promise.all(
    caixas.map(async (c) => {
      // O próximo caixa do mesmo motorista encerra este (a lista vem da data mais nova para a mais antiga).
      const proximo = caixas.filter((o) => o.motoristaId === c.motoristaId && (o.data > c.data || (+o.data === +c.data && o.criadoEm > c.criadoEm))).at(-1);
      const fim = c.fechadoEm ?? proximo?.data ?? null;
      // Manutenção e pneus a empresa paga direto; não saem do dinheiro do motorista.
      const quem = c.motorista.acesso
        ? { usuarioId: c.motorista.acesso.id }
        : c.caminhaoId ? { caminhaoId: c.caminhaoId, categoria: { notIn: ["MANUTENCAO" as const, "PNEUS" as const] } } : null;
      const despesasWhere = quem
        ? { ...quem, caminhao: { clienteId }, data: { gte: c.data, ...(fim ? (c.fechadoEm ? { lte: fim } : { lt: fim }) : {}) } }
        : null;
      const lista = despesasWhere ? await db.despesa.findMany({ where: despesasWhere, select: { valorUsd: true, moeda: true, valorOriginal: true } }) : [];
      const gastoUsd = lista.reduce((a, d) => a + d.valorUsd, 0);
      // Para mostrar na moeda do caixa: despesas na mesma moeda pelo valor pago, as outras em USD (converter com a cotação).
      const mesma = lista.filter((d) => d.moeda === c.moeda);
      const gastoMesmaMoeda = mesma.reduce((a, d) => a + (d.valorOriginal ?? d.valorUsd), 0);
      const gastoOutrasUsd = gastoUsd - mesma.reduce((a, d) => a + d.valorUsd, 0);
      return { ...c, aberto: !fim, gastoUsd, gastoMesmaMoeda, gastoOutrasUsd, nDespesas: lista.length, saldoUsd: c.valorUsd - gastoUsd, despesasWhere };
    }),
  );
}

/** Resultado de cada mês (fretes − despesas) e o saldo acumulado até o fim dele, dos últimos meses. */
export async function saldoPorMes(clienteId: string, ate: string, meses = 6) {
  const { fim } = intervaloMes(ate);
  const [fretes, despesas] = await Promise.all([
    db.viagem.findMany({ where: { caminhao: { clienteId }, data: { lt: fim } }, select: { data: true, freteUsd: true, custosExtrasUsd: true } }),
    db.despesa.findMany({ where: { caminhao: { clienteId }, data: { lt: fim } }, select: { data: true, valorUsd: true } }),
  ]);
  const porMes = new Map<string, { fretes: number; despesas: number }>();
  const em = (d: Date) => {
    const k = d.toISOString().slice(0, 7);
    if (!porMes.has(k)) porMes.set(k, { fretes: 0, despesas: 0 });
    return porMes.get(k)!;
  };
  fretes.forEach((f) => { const m = em(f.data); m.fretes += f.freteUsd; m.despesas += f.custosExtrasUsd; });
  despesas.forEach((d) => { em(d.data).despesas += d.valorUsd; });
  let acumulado = 0;
  const linhas = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => {
    acumulado += v.fretes - v.despesas;
    return { mes, ...v, resultado: v.fretes - v.despesas, saldo: acumulado };
  });
  return linhas.slice(-meses).reverse();
}
