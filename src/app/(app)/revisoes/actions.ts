"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";

export type Resultado = { ok: boolean; msg: string } | null;

const servico = z.object({
  itemId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  custoUsd: z.coerce.number().min(0),
  odometroKm: z.coerce.number().int().min(0),
  proximoVencimento: z.string().optional(),
});

/** Registra um serviço feito: zera o intervalo do item e lança o custo como manutenção. */
export async function registrarServico(_: Resultado, form: FormData): Promise<Resultado> {
  const { cliente } = await clienteAtual();
  const p = servico.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira data, odômetro e custo." };
  const item = await db.itemRevisao.findFirst({ where: { id: p.data.itemId, caminhao: { clienteId: cliente.id } }, include: { caminhao: true } });
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const data = new Date(`${p.data.data}T00:00:00Z`);
  const prox = p.data.proximoVencimento && /^\d{4}-\d{2}-\d{2}$/.test(p.data.proximoVencimento) ? new Date(`${p.data.proximoVencimento}T00:00:00Z`) : null;
  if (item.gatilho === "DATA" && !prox) return { ok: false, msg: "Informe o novo vencimento." };

  await db.$transaction([
    db.servicoRevisao.create({ data: { itemId: item.id, data, odometroKm: p.data.odometroKm, custoUsd: p.data.custoUsd } }),
    db.itemRevisao.update({
      where: { id: item.id },
      data: item.gatilho === "KM" ? { ultimoKm: p.data.odometroKm } : item.gatilho === "DATA" ? { vencimento: prox } : { resolvido: true },
    }),
    ...(p.data.custoUsd > 0
      ? [db.despesa.create({ data: { caminhaoId: item.caminhaoId, data, categoria: "MANUTENCAO", valorUsd: p.data.custoUsd, descricao: item.nome } })]
      : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, msg: `${item.nome} registrado em ${item.caminhao.placa}.` };
}

const novoItem = z.object({
  caminhaoId: z.string().min(1),
  nome: z.string().trim().min(2),
  gatilho: z.enum(["KM", "DATA"]),
  intervaloKm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  ultimoKm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).optional()),
  vencimento: z.string().optional(),
});

export async function criarItem(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Seu perfil não pode alterar o plano de revisões." };
  const p = novoItem.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira os campos." };
  const cam = await db.caminhao.findFirst({ where: { id: p.data.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  if (p.data.gatilho === "KM" && !p.data.intervaloKm) return { ok: false, msg: "Informe o intervalo em km." };
  if (p.data.gatilho === "DATA" && !p.data.vencimento) return { ok: false, msg: "Informe o vencimento." };
  await db.itemRevisao.create({
    data:
      p.data.gatilho === "KM"
        ? { caminhaoId: cam.id, nome: p.data.nome, gatilho: "KM", intervaloKm: p.data.intervaloKm, ultimoKm: p.data.ultimoKm ?? cam.odometroKm }
        : { caminhaoId: cam.id, nome: p.data.nome, gatilho: "DATA", vencimento: new Date(`${p.data.vencimento}T00:00:00Z`) },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${p.data.nome} adicionado ao plano de ${cam.placa}.` };
}
