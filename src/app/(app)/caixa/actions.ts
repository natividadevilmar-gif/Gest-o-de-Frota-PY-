"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { num } from "@/lib/formato";

export type Resultado = { ok: boolean; msg: string } | null;

const caixa = z.object({
  motoristaId: z.string().min(1),
  caminhaoId: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moeda: z.enum(["USD", "PYG", "BRL", "ARS"]),
  valor: z.coerce.number().positive(),
  observacao: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(200).optional()),
});

export async function entregarCaixa(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Sem permissão." };
  const p = caixa.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Escolha o motorista e informe o valor entregue." };
  const d = p.data;
  const motorista = await db.motorista.findFirst({ where: { id: d.motoristaId, clienteId: cliente.id } });
  if (!motorista) return { ok: false, msg: "Motorista não encontrado." };
  const cam = d.caminhaoId ? await db.caminhao.findFirst({ where: { id: d.caminhaoId, clienteId: cliente.id } }) : null;
  const valorUsd = paraUsd(d.valor, d.moeda as Moeda, await cotacaoDoDia());
  await db.caixaViagem.create({
    data: {
      clienteId: cliente.id,
      motoristaId: motorista.id,
      caminhaoId: cam?.id ?? null,
      data: new Date(`${d.data}T00:00:00Z`),
      moeda: d.moeda,
      valorOriginal: d.valor,
      valorUsd,
      observacao: d.observacao ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Caixa de ${d.moeda} ${num(d.valor, 2)} entregue a ${motorista.nome}.` };
}

export async function fecharCaixa(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  await db.caixaViagem.updateMany({ where: { id: String(form.get("id")), clienteId: cliente.id, fechadoEm: null }, data: { fechadoEm: hoje } });
  revalidatePath("/", "layout");
}
