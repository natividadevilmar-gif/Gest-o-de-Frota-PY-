"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { lerValor } from "@/lib/formato";
import { CATEGORIAS_PAGAR, datasParcelas } from "@/lib/pagar";

export type ResultadoPagar = { ok: boolean; msg: string } | null;

const conta = z.object({
  descricao: z.string().trim().min(2).max(120),
  categoria: z.enum(Object.keys(CATEGORIAS_PAGAR) as [keyof typeof CATEGORIAS_PAGAR, ...(keyof typeof CATEGORIAS_PAGAR)[]]),
  fornecedor: z.string().trim().max(120).optional(),
  caminhaoId: z.string().optional(),
  moeda: z.enum(["USD", "PYG", "BRL", "ARS"]),
  valor: z.coerce.number().positive().max(1e12),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parcelas: z.coerce.number().int().min(1).max(120),
});

/** Cria a conta ou as parcelas mensais (o valor informado é o de cada parcela). */
export async function criarConta(_: ResultadoPagar, form: FormData): Promise<ResultadoPagar> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Sem permissão." };
  const p = conta.safeParse({
    descricao: form.get("descricao"),
    categoria: form.get("categoria"),
    fornecedor: form.get("fornecedor") || undefined,
    caminhaoId: form.get("caminhaoId") || undefined,
    moeda: form.get("moeda"),
    valor: lerValor(String(form.get("valor") ?? "")),
    vencimento: form.get("vencimento"),
    parcelas: form.get("parcelas") || 1,
  });
  if (!p.success) return { ok: false, msg: "Confira descrição, valor e vencimento." };
  const c = p.data;
  const caminhao = c.caminhaoId ? await db.caminhao.findFirst({ where: { id: c.caminhaoId, clienteId: cliente.id }, select: { id: true } }) : null;
  const valorUsd = Math.round(paraUsd(c.valor, c.moeda as Moeda, await cotacaoDoDia()) * 100) / 100;
  const datas = datasParcelas(new Date(`${c.vencimento}T00:00:00Z`), c.parcelas);
  const grupo = c.parcelas > 1 ? randomBytes(8).toString("hex") : null;
  await db.contaPagar.createMany({
    data: datas.map((vencimento, i) => ({
      clienteId: cliente.id, caminhaoId: caminhao?.id ?? null, descricao: c.descricao, categoria: c.categoria, fornecedor: c.fornecedor,
      moeda: c.moeda, valorOriginal: c.valor, valorUsd, vencimento, grupo, parcela: grupo ? i + 1 : null, parcelas: grupo ? c.parcelas : null,
    })),
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: c.parcelas > 1 ? `${c.parcelas} parcelas lançadas.` : "Conta lançada." };
}

async function daEmpresa(id: string) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return null;
  return db.contaPagar.findFirst({ where: { id, clienteId: cliente.id }, select: { id: true, grupo: true, pagoEm: true } });
}

export async function pagarConta(form: FormData) {
  const c = await daEmpresa(String(form.get("id")));
  if (!c) return;
  const data = String(form.get("data") ?? "");
  const pagoEm = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  await db.contaPagar.update({ where: { id: c.id }, data: { pagoEm: c.pagoEm ? null : pagoEm } });
  revalidatePath("/", "layout");
}

/** Exclui a conta; com "todas", também as parcelas ainda não pagas do mesmo grupo. */
export async function excluirConta(form: FormData) {
  const c = await daEmpresa(String(form.get("id")));
  if (!c) return;
  if (form.get("todas") === "1" && c.grupo) await db.contaPagar.deleteMany({ where: { grupo: c.grupo, pagoEm: null } });
  else await db.contaPagar.delete({ where: { id: c.id } });
  revalidatePath("/", "layout");
}
