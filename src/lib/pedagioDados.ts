import "server-only";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { dataBr, usd } from "@/lib/formato";
import { passagensPedagio, previstoRota, taxasPedagio, type RotaComPracas } from "@/lib/pedagio";
import { diaNoParaguai, trajetoDemo } from "@/lib/rastreio/rotas";
import { ehImei } from "@/lib/telemetria/posicoes";

const uyuPorUsd = () => Number(process.env.COTACAO_UYU_POR_USD ?? 40);

export async function taxasDoDia() {
  return taxasPedagio(await cotacaoDoDia(), uyuPorUsd());
}

/** Rotas com as praças na ordem da ida. */
export async function rotasPedagio(): Promise<RotaComPracas[]> {
  const [rotas, pracas] = await Promise.all([
    db.rotaPedagio.findMany({ orderBy: { nome: "asc" } }),
    db.pracaPedagio.findMany(),
  ]);
  const porId = new Map(pracas.map((p) => [p.id, p]));
  return rotas.map((r) => ({
    id: r.id,
    nome: r.nome,
    km: r.km,
    paises: r.paises,
    pracas: r.pracas.flatMap((id) => {
      const p = porId.get(id);
      return p ? [{ id: p.id, pais: p.pais, rodovia: p.rodovia, nome: p.nome, moeda: p.moeda, tarifaEixo: p.tarifaEixo, tarifaFixa: p.tarifaFixa }] : [];
    }),
  }));
}

/** Horas que o motorista tem para lançar o pedágio depois de passar pela praça. */
export const PRAZO_LANCAR_PEDAGIO_H = 4;
const ULTIMA_VERIFICACAO = new Map<string, number>();

export type AlertaPedagio = {
  clienteId: string; caminhaoId: string; tipo: "pedagio_sem_registro"; gravidade: "media";
  titulo: string; detalhe: string; lat: number; lng: number; velocidadeKmh: null; chave: string;
};

/**
 * Passagens por praça de pedágio (pelo GPS de ontem e de hoje) sem a despesa de pedágio
 * lançada. Compara por dia: o previsto das praças passadas há mais de 4 horas com o
 * pedágio lançado naquele dia e no seguinte. Roda no máximo a cada 10 minutos por cliente.
 */
export async function pedagiosSemRegistro(clienteId: string | null, agora = new Date()): Promise<AlertaPedagio[]> {
  const chaveCache = clienteId ?? "*";
  if (agora.getTime() - (ULTIMA_VERIFICACAO.get(chaveCache) ?? 0) < 10 * 60_000) return [];
  ULTIMA_VERIFICACAO.set(chaveCache, agora.getTime());

  const [pracas, caminhoes, taxas] = await Promise.all([
    db.pracaPedagio.findMany(),
    db.caminhao.findMany({ where: { rastreadorId: { not: null }, ...(clienteId ? { clienteId } : {}) }, select: { id: true, placa: true, clienteId: true, rastreadorId: true, eixos: true } }),
    taxasDoDia(),
  ]);
  if (!pracas.length || !caminhoes.length) return [];
  const porId = new Map(pracas.map((p) => [p.id, p]));
  const hoje = diaNoParaguai(agora);
  const ontem = new Date(hoje.getTime() - 86_400_000);
  const limite = agora.getTime() - PRAZO_LANCAR_PEDAGIO_H * 3600_000;

  const lancados = await db.despesa.findMany({
    where: { categoria: "PEDAGIO", caminhaoId: { in: caminhoes.map((c) => c.id) }, data: { gte: ontem } },
    select: { caminhaoId: true, data: true, valorUsd: true },
  });

  const alertas: AlertaPedagio[] = [];
  for (const c of caminhoes) {
    const pontos = ehImei(c.rastreadorId)
      ? await db.posicao.findMany({
          where: { caminhaoId: c.id, data: { gte: new Date(ontem.getTime() + 3 * 3600_000), lte: agora } },
          orderBy: { data: "asc" },
          select: { lat: true, lng: true, data: true },
        })
      : [...trajetoDemo(c.id, ontem, agora), ...trajetoDemo(c.id, hoje, agora)];
    const passagens = passagensPedagio(pontos, pracas).filter((x) => x.data.getTime() <= limite);

    for (const dia of [ontem, hoje]) {
      const doDia = passagens.filter((x) => diaNoParaguai(x.data).getTime() === dia.getTime());
      if (!doDia.length) continue;
      const pracasDia = doDia.map((x) => porId.get(x.pracaId)!);
      const previsto = previstoRota(pracasDia, c.eixos, taxas).usd;
      const ate = dia.getTime() + 86_400_000;
      const lancado = lancados.filter((d) => d.caminhaoId === c.id && d.data.getTime() >= dia.getTime() && d.data.getTime() <= ate).reduce((a, d) => a + d.valorUsd, 0);
      if (!previsto || lancado >= previsto * 0.8) continue;
      const ultima = pracasDia.at(-1)!;
      const nomes = [...new Set(pracasDia.map((p) => p.nome))].join(", ");
      alertas.push({
        clienteId: c.clienteId, caminhaoId: c.id, tipo: "pedagio_sem_registro", gravidade: "media",
        titulo: `${c.placa} sem registrar pedágio`,
        detalhe: `Passou por ${nomes} em ${dataBr(dia)} (previsto ${usd(previsto, 2)}) e lançou ${usd(lancado, 2)}.`,
        lat: ultima.lat, lng: ultima.lng, velocidadeKmh: null, chave: `${c.id}:pedagio:${dia.toISOString().slice(0, 10)}`,
      });
    }
  }
  return alertas;
}
