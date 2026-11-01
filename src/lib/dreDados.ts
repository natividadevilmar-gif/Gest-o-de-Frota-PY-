import "server-only";
import { indicadoresFrota } from "@/lib/dados";
import { db } from "@/lib/db";
import { linhaDre, totalDre } from "@/lib/dre";
import { intervaloMes } from "@/lib/indicadores";

/** DRE do mês: receita dos fretes do caminhão, custos do mês (variáveis e fixos) e contas da empresa pagas no mês. */
export async function dreDoMes(clienteId: string, mes: string) {
  const { inicio, fim } = intervaloMes(mes);
  const [ind, fretes, admin] = await Promise.all([
    indicadoresFrota(clienteId, mes),
    db.viagem.groupBy({ by: ["caminhaoId"], where: { caminhao: { clienteId }, data: { gte: inicio, lt: fim } }, _sum: { freteUsd: true, custosExtrasUsd: true }, _count: true }),
    // Contas sem caminhão pagas no mês, menos parcelas de financiamento (o caminhão já entra pela depreciação).
    db.contaPagar.aggregate({ where: { clienteId, caminhaoId: null, categoria: { not: "PARCELA" }, pagoEm: { gte: inicio, lt: fim } }, _sum: { valorUsd: true } }),
  ]);
  const porCaminhao = new Map(fretes.map((f) => [f.caminhaoId, { receita: f._sum.freteUsd ?? 0, extras: f._sum.custosExtrasUsd ?? 0, fretes: f._count }]));
  const linhas = ind
    .map((c) => linhaDre({ id: c.id, placa: c.placa, km: c.km, composicao: c.composicao }, porCaminhao.get(c.id) ?? { receita: 0, extras: 0, fretes: 0 }))
    .sort((a, b) => b.resultado - a.resultado);
  return { linhas, total: totalDre(linhas, admin._sum.valorUsd ?? 0) };
}
