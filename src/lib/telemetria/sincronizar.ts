import type { PrismaClient } from "@prisma/client";
import type { FonteTelemetria } from "./fonte";
import { diaNoParaguai } from "../rastreio/rotas";
import { ehImei, resumirDia } from "./posicoes";

/**
 * Grava o dia de cada caminhão com rastreador. Caminhões com aparelho próprio (IMEI)
 * usam as posições recebidas pelo nosso receptor; os demais usam a fonte configurada.
 * `dia` é a data do Paraguai (meia-noite UTC); o dia vai das 00h às 24h de lá (UTC-3).
 */
export async function sincronizarDia(db: PrismaClient, fonte: FonteTelemetria, dia: Date) {
  const caminhoes = await db.caminhao.findMany({ where: { rastreadorId: { not: null } } });
  let gravados = 0;
  const erros: string[] = [];
  for (const c of caminhoes) {
    try {
      if (await gravarDia(db, fonte, c, dia)) gravados++;
    } catch (e) {
      erros.push(`${c.placa}: ${(e as Error).message}`);
    }
  }
  return { gravados, erros };
}

type CaminhaoDia = { id: string; rastreadorId: string | null; odometroKm: number; plano: string };

/** Resume e grava um dia de um caminhão. Devolve false quando não há dados no dia. */
export async function gravarDia(db: PrismaClient, fonte: FonteTelemetria | null, c: CaminhaoDia, dia: Date) {
  const anterior = await db.telemetriaDia.findFirst({
    where: { caminhaoId: c.id, data: { lt: dia } },
    orderBy: { data: "desc" },
  });
  const odometroAnteriorKm = anterior?.odometroKm ?? c.odometroKm;
  let d;
  if (ehImei(c.rastreadorId)) {
    const ini = new Date(dia.getTime() + 3 * 3600_000);
    const fim = new Date(ini.getTime() + 24 * 3600_000);
    const pontos = await db.posicao.findMany({
      where: { caminhaoId: c.id, data: { gte: ini, lt: fim } },
      select: { data: true, lat: true, lng: true, velocidadeKmh: true, ignicao: true, odometroKm: true, litrosTotal: true, rpm: true, evento: true },
    });
    d = resumirDia(pontos, odometroAnteriorKm);
  } else if (fonte && c.rastreadorId) {
    d = await fonte.buscarDia({ rastreadorId: c.rastreadorId, odometroAnteriorKm, leCan: c.plano !== "BASICO" }, dia);
  }
  if (!d) return false;
  await db.telemetriaDia.upsert({
    where: { caminhaoId_data: { caminhaoId: c.id, data: dia } },
    create: { caminhaoId: c.id, data: dia, ...d },
    update: d,
  });
  if (d.odometroKm > c.odometroKm) {
    await db.caminhao.update({ where: { id: c.id }, data: { odometroKm: d.odometroKm } });
  }
  return true;
}

/** Dias do Paraguai (meia-noite UTC, como em TelemetriaDia) que as datas tocam. */
export function diasDoParaguai(datas: Date[]) {
  const dias = new Set(datas.map((d) => diaNoParaguai(d).getTime()));
  return [...dias].sort((a, b) => a - b).map((t) => new Date(t));
}
