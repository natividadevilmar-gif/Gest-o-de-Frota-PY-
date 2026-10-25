"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { TIPOS_CERCA } from "@/lib/monitoramento";

// A equipe KM Cero atua em qualquer cliente; os demais só no próprio.
async function escopo() {
  const { sessao, cliente } = await clienteAtual();
  return { sessao, cliente, filtro: sessao.papel === "ADMIN" ? {} : { clienteId: cliente.id } };
}

export async function atenderOcorrencia(id: string) {
  const { sessao, filtro } = await escopo();
  await db.ocorrencia.updateMany({ where: { id, status: "aberta", ...filtro }, data: { status: "atendimento", atendidaPor: sessao.nome, atendidaEm: new Date() } });
  revalidatePath("/monitoramento");
}

export async function resolverOcorrencia(id: string, observacao: string) {
  const { sessao, filtro } = await escopo();
  const obs = observacao.trim().slice(0, 500) || null;
  const o = await db.ocorrencia.findFirst({ where: { id, ...filtro }, select: { atendidaPor: true } });
  if (!o) return;
  await db.ocorrencia.updateMany({
    where: { id, ...filtro },
    data: { status: "resolvida", resolvidaEm: new Date(), observacao: obs, atendidaPor: o.atendidaPor ?? sessao.nome, atendidaEm: o.atendidaPor ? undefined : new Date() },
  });
  revalidatePath("/monitoramento");
}

const novaCerca = z.object({
  nome: z.string().trim().min(2).max(60),
  tipo: z.string().refine((t) => Object.hasOwn(TIPOS_CERCA, t)),
  lat: z.coerce.number().min(-60).max(15),
  lng: z.coerce.number().min(-85).max(-30),
  raioM: z.coerce.number().int().min(100).max(50_000),
});

export type Resultado = { ok: boolean; msg: string } | null;

export async function criarCerca(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await escopo();
  if (sessao.papel === "OPERADOR") return { ok: false, msg: "Seu perfil não pode criar cercas." };
  const p = novaCerca.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Dê um nome, escolha o tipo e clique no mapa para marcar o centro." };
  await db.cerca.create({ data: { ...p.data, clienteId: cliente.id } });
  revalidatePath("/monitoramento");
  return { ok: true, msg: `Cerca "${p.data.nome}" criada para ${cliente.nome}.` };
}

export async function alternarCerca(id: string) {
  const { sessao, filtro } = await escopo();
  if (sessao.papel === "OPERADOR") return;
  const c = await db.cerca.findFirst({ where: { id, ...filtro }, select: { ativa: true } });
  if (c) await db.cerca.update({ where: { id }, data: { ativa: !c.ativa } });
  revalidatePath("/monitoramento");
}

export async function excluirCerca(id: string) {
  const { sessao, filtro } = await escopo();
  if (sessao.papel === "OPERADOR") return;
  await db.cerca.deleteMany({ where: { id, ...filtro } });
  await db.caminhao.updateMany({ where: { cercaAtualId: id }, data: { cercaAtualId: "fora" } });
  revalidatePath("/monitoramento");
}
