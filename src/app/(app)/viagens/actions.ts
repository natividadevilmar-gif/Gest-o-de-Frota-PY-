"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { calcularRota } from "@/lib/rastreio/rotaFrete";

const cidades = z.object({
  origem: z.string().trim().min(2).max(80),
  paisOrigem: z.string().regex(/^[A-Z]{2}$/),
  destino: z.string().trim().min(2).max(80),
  paisDestino: z.string().regex(/^[A-Z]{2}$/),
});

/** Km de estrada entre duas cidades (OpenStreetMap), para o simulador. */
export async function kmEntreCidades(c: z.infer<typeof cidades>): Promise<{ km: number } | { erro: string }> {
  await clienteAtual();
  const p = cidades.safeParse(c);
  if (!p.success) return { erro: "Informe a cidade de origem e a de destino." };
  const r = await calcularRota(p.data);
  return "erro" in r ? r : { km: r.km };
}

const rota = cidades.extend({
  km: z.coerce.number().int().positive(),
  rotaPedagioId: z.string().optional(),
});

/** Guarda a rota para escolher de novo no simulador. */
export async function salvarRota(r: z.infer<typeof rota>): Promise<{ ok: boolean; msg: string; id?: string }> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return { ok: false, msg: "Sem permissão." };
  const p = rota.safeParse(r);
  if (!p.success) return { ok: false, msg: "Informe origem, destino e km de ida." };
  const nova = await db.rotaFrete.create({ data: { ...p.data, rotaPedagioId: p.data.rotaPedagioId || null, clienteId: cliente.id } });
  revalidatePath("/viagens");
  return { ok: true, msg: `Rota ${p.data.origem} → ${p.data.destino} salva.`, id: nova.id };
}

export async function excluirRota(id: string) {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return;
  await db.rotaFrete.deleteMany({ where: { id, clienteId: cliente.id } });
  revalidatePath("/viagens");
}
