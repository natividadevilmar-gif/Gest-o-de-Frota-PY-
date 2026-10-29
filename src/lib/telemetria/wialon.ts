import type { FonteTelemetria } from "./fonte";
import { resumirDia } from "./posicoes";
import { paraPosicaoWialon, Wialon } from "../rastreio/wialon";

// Resumo do dia lido direto do Wialon, para quem usa TELEMETRIA_FONTE=wialon.
// No dia a dia o espelho (src/lib/rastreio/wialon.ts) já grava as posições em Posicao
// e o resumo sai delas; esta fonte serve para refazer um dia sem depender do espelho.
let api: Wialon | null = null;

export const wialon: FonteTelemetria = {
  nome: "wialon",
  async buscarDia(eq, dia) {
    api ??= Wialon.doAmbiente();
    const [u] = await api.unidades({ uid: eq.rastreadorId });
    if (!u) throw new Error(`Unidade com IMEI ${eq.rastreadorId} não encontrada no Wialon.`);
    // Dia do Paraguai: 00h às 24h de lá (UTC-3).
    const ini = new Date(dia.getTime() + 3 * 3600_000);
    const fim = new Date(ini.getTime() + 24 * 3600_000 - 1000);
    const pontos = (await api.mensagens(u, ini, fim)).map(paraPosicaoWialon).filter((p) => p !== null);
    return resumirDia(pontos, eq.odometroAnteriorKm);
  },
};
