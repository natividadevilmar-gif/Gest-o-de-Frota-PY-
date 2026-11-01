"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { lerValor } from "@/lib/formato";

const recebimento = z.object({
  viagemId: z.string().min(1),
  valor: z.coerce.number().positive().max(10_000_000),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().trim().max(200).optional(),
});

/** Lança um pagamento (total ou parcial) de um frete; quitado, o frete fica como recebido. */
export async function registrarRecebimento(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const p = recebimento.safeParse({
    viagemId: form.get("viagemId"),
    valor: lerValor(String(form.get("valor") ?? "")),
    data: form.get("data"),
    observacao: form.get("observacao") || undefined,
  });
  if (!p.success) return;
  const v = await db.viagem.findFirst({ where: { id: p.data.viagemId, caminhao: { clienteId: cliente.id } }, select: { id: true, freteUsd: true } });
  if (!v) return;
  await db.recebimento.create({ data: { viagemId: v.id, data: new Date(`${p.data.data}T00:00:00Z`), valorUsd: Math.round(p.data.valor * 100) / 100, observacao: p.data.observacao, usuarioId: sessao.usuarioId } });
  const total = await db.recebimento.aggregate({ where: { viagemId: v.id }, _sum: { valorUsd: true } });
  if ((total._sum.valorUsd ?? 0) >= v.freteUsd - 0.01) await db.viagem.update({ where: { id: v.id }, data: { recebido: true } });
  revalidatePath("/", "layout");
}

/** Desfaz um pagamento lançado por engano; o frete volta a ficar em aberto. */
export async function excluirRecebimento(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const r = await db.recebimento.findFirst({ where: { id: String(form.get("id")), viagem: { caminhao: { clienteId: cliente.id } } }, select: { id: true, viagemId: true } });
  if (!r) return;
  await db.recebimento.delete({ where: { id: r.id } });
  await db.viagem.update({ where: { id: r.viagemId }, data: { recebido: false } });
  revalidatePath("/", "layout");
}
