"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { normalizarLogin } from "@/lib/login";

export type Resultado = { ok: boolean; msg: string } | null;

const acesso = z.object({
  motoristaId: z.string(),
  nome: z.string().trim().max(80).optional(),
  caminhaoId: z.string().optional(),
  celular: z.string().transform(normalizarLogin).pipe(z.string().regex(/^\d{8,15}$/)),
  pin: z.string().regex(/^\d{6,8}$/),
});

/** Cria o acesso de um motorista (e o motorista, se for novo) com celular e PIN. */
export async function criarAcesso(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Só o gestor cria acessos." };
  const p = acesso.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira: celular só com números (com DDD) e PIN de 6 a 8 dígitos." };
  const d = p.data;
  if (await db.usuario.findUnique({ where: { email: d.celular } })) return { ok: false, msg: "Esse celular já tem acesso." };

  let motoristaId = d.motoristaId;
  if (motoristaId === "novo") {
    if (!d.nome || d.nome.length < 2) return { ok: false, msg: "Informe o nome do motorista." };
    motoristaId = (await db.motorista.create({ data: { clienteId: cliente.id, nome: d.nome } })).id;
  }
  const mot = await db.motorista.findFirst({ where: { id: motoristaId, clienteId: cliente.id }, include: { acesso: true } });
  if (!mot) return { ok: false, msg: "Motorista não encontrado." };
  if (mot.acesso) return { ok: false, msg: `${mot.nome} já tem acesso.` };
  if (d.caminhaoId) await db.caminhao.updateMany({ where: { id: d.caminhaoId, clienteId: cliente.id }, data: { motoristaId: mot.id } });

  await db.usuario.create({
    data: { email: d.celular, nome: mot.nome, senhaHash: await bcrypt.hash(d.pin, 10), papel: "MOTORISTA", clienteId: cliente.id, motoristaId: mot.id },
  });
  revalidatePath("/motoristas");
  return { ok: true, msg: `Acesso criado. ${mot.nome} entra com o celular ${d.celular} e o PIN informado.` };
}

export async function novoPin(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const pin = z.string().regex(/^\d{6,8}$/).safeParse(form.get("pin"));
  if (!pin.success) return;
  await db.usuario.updateMany({
    where: { id: String(form.get("id")), clienteId: cliente.id, papel: "MOTORISTA" },
    data: { senhaHash: await bcrypt.hash(pin.data, 10) },
  });
  revalidatePath("/motoristas");
}

export async function removerAcesso(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  await db.usuario.deleteMany({ where: { id: String(form.get("id")), clienteId: cliente.id, papel: "MOTORISTA" } });
  revalidatePath("/motoristas");
}
