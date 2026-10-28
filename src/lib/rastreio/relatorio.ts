import "server-only";
import { db } from "@/lib/db";
import { ehImei, relatorioDoDia, type PontoDia, type RelatorioDia } from "@/lib/telemetria/posicoes";
import { espelharSeDevido } from "./wialon";
import { trajetoDemo } from "./rotas";

export type LinhaRelatorio = {
  id: string;
  placa: string;
  modelo: string;
  motorista: string | null;
  demo: boolean;
  relatorio: RelatorioDia | null;
};

/** Período mais longo do relatório: cada dia de um caminhão com Wialon tem milhares de posições. */
export const MAX_DIAS_RELATORIO = 7;

/**
 * Relatório de viagens da frota entre dois dias do Paraguai (`de` e `ate` = meia-noite UTC dessas datas),
 * com os mesmos campos do relatório do Wialon: km, diesel, km/l, tanque, horas de motor, velocidades.
 */
export async function relatorioDaFrota(clienteId: string, de: Date, ate: Date, agora = new Date()): Promise<LinhaRelatorio[]> {
  await espelharSeDevido(db, agora);
  const caminhoes = await db.caminhao.findMany({
    where: { clienteId, rastreadorId: { not: null } },
    include: { motorista: { select: { nome: true } } },
    orderBy: { placa: "asc" },
  });
  const ini = new Date(de.getTime() + 3 * 3600_000);
  const fim = new Date(ate.getTime() + 27 * 3600_000);
  const linhas: LinhaRelatorio[] = [];
  for (const c of caminhoes) {
    const base = { id: c.id, placa: c.placa, modelo: c.modelo, motorista: c.motorista?.nome ?? null };
    if (!ehImei(c.rastreadorId)) {
      const pts: PontoDia[] = [];
      for (let d = de.getTime(); d <= ate.getTime(); d += 86_400_000) {
        for (const p of trajetoDemo(c.id, new Date(d), agora)) {
          pts.push({ data: p.data, lat: p.lat, lng: p.lng, velocidadeKmh: p.velocidadeKmh, ignicao: p.ignicao, odometroKm: null, litrosTotal: null, rpm: p.rpm, evento: null });
        }
      }
      linhas.push({ ...base, demo: true, relatorio: relatorioDoDia(pts) });
      continue;
    }
    const pts = await db.posicao.findMany({
      where: { caminhaoId: c.id, data: { gte: ini, lt: fim } },
      orderBy: { data: "asc" },
      select: { data: true, lat: true, lng: true, velocidadeKmh: true, ignicao: true, odometroKm: true, litrosTotal: true, nivelCombustivelL: true, rpm: true, evento: true },
    });
    linhas.push({ ...base, demo: false, relatorio: relatorioDoDia(pts) });
  }
  return linhas;
}
