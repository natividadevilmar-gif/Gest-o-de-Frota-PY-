"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";

export type Resultado = { ok: boolean; msg: string } | null;

const viagem = z.object({
  caminhaoId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  origem: z.string().trim().min(2),
  destino: z.string().trim().min(2),
  carga: z.string().trim().min(2),
  toneladas: z.coerce.number().positive(),
  freteUsd: z.coerce.number().positive(),
  kmCarregado: z.coerce.number().positive(),
  kmVazio: z.coerce.number().min(0),
});

export async function registrarViagem(_: Resultado, form: FormData): Promise<Resultado> {
  const { cliente } = await clienteAtual();
  const p = viagem.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Preencha todos os campos da viagem." };
  const cam = await db.caminhao.findFirst({ where: { id: p.data.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  await db.viagem.create({ data: { ...p.data, data: new Date(`${p.data.data}T00:00:00Z`) } });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Viagem ${p.data.origem} → ${p.data.destino} registrada.` };
}
