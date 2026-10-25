import type { PrismaClient } from "@prisma/client";
import type { FonteTelemetria } from "./fonte";
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
      } else {
        d = await fonte.buscarDia({ rastreadorId: c.rastreadorId!, odometroAnteriorKm, leCan: c.plano !== "BASICO" }, dia);
      }
      if (!d) continue;
      await db.telemetriaDia.upsert({
        where: { caminhaoId_data: { caminhaoId: c.id, data: dia } },
        create: { caminhaoId: c.id, data: dia, ...d },
        update: d,
      });
      if (d.odometroKm > c.odometroKm) {
        await db.caminhao.update({ where: { id: c.id }, data: { odometroKm: d.odometroKm } });
      }
      gravados++;
    } catch (e) {
      erros.push(`${c.placa}: ${(e as Error).message}`);
    }
  }
  return { gravados, erros };
}
