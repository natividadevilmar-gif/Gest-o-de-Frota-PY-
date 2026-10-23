import "server-only";
import { db } from "@/lib/db";
import {
  comparacaoReferenciaPct,
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
    include: { caminhao: { select: { id: true, placa: true } } },
    orderBy: { data: "desc" },
  });
  const custoKm = new Map(ind.map((i) => [i.id, i.custoKm]));
  return viagens.map((v) => {
    const ck = custoKm.get(v.caminhaoId) ?? null;
    return { ...v, custoKm: ck, margem: ck === null ? null : margemViagem(v.freteUsd, v.kmCarregado, v.kmVazio, ck) };
  });
}

function soma(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}
