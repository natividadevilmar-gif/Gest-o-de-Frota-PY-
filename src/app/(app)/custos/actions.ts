"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";

const despesa = z.object({
  caminhaoId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.enum(["DIESEL", "PNEUS", "MANUTENCAO", "PEDAGIO", "OUTROS"]),
  valorUsd: z.coerce.number().positive(),
  litros: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().positive().optional()),
  descricao: z.string().trim().max(200).optional(),
});

export type Resultado = { ok: boolean; msg: string } | null;

export async function lancarDespesa(_: Resultado, form: FormData): Promise<Resultado> {
  const { cliente } = await clienteAtual();
  const p = despesa.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira caminhão, data, tipo e valor." };
  if (p.data.categoria === "DIESEL" && !p.data.litros) return { ok: false, msg: "Para diesel, informe os litros abastecidos." };
  const cam = await db.caminhao.findFirst({ where: { id: p.data.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  await db.despesa.create({
    data: { ...p.data, data: new Date(`${p.data.data}T00:00:00Z`), litros: p.data.categoria === "DIESEL" ? p.data.litros : null },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${usd(p.data.valorUsd, 2)} lançado em ${cam.placa}${p.data.litros ? ` (${num(p.data.litros)} litros)` : ""}.` };
}
