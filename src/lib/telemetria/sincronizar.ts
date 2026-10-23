import type { PrismaClient } from "@prisma/client";
import type { FonteTelemetria } from "./fonte";

/** Busca o dia na fonte para cada caminhão com rastreador e grava no banco. */
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
      const d = await fonte.buscarDia(
        { rastreadorId: c.rastreadorId!, odometroAnteriorKm: anterior?.odometroKm ?? c.odometroKm, leCan: c.plano !== "BASICO" },
        dia,
      );
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
