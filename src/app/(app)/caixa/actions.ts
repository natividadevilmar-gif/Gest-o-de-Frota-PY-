"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { nomeMes, usd } from "@/lib/formato";

export type Resultado = { ok: boolean; msg: string } | null;

const caixa = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  moeda: z.enum(["USD", "PYG", "BRL", "ARS"]),
  valor: z.coerce.number().min(0),
  observacao: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(200).optional()),
});

export async function salvarCaixa(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Sem permissão." };
  const p = caixa.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Informe o valor do caixa inicial." };
  const { mes, moeda, valor, observacao } = p.data;
  const valorUsd = paraUsd(valor, moeda as Moeda, await cotacaoDoDia());
  const dados = { moeda, valorOriginal: valor, valorUsd, observacao: observacao ?? null };
  await db.caixaInicial.upsert({ where: { clienteId_mes: { clienteId: cliente.id, mes } }, create: { clienteId: cliente.id, mes, ...dados }, update: dados });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Caixa inicial de ${nomeMes(mes)} salvo: ${usd(valorUsd, 2)}.` };
}
