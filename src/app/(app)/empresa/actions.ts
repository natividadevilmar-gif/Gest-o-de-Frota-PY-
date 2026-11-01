"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/acesso";
import { definirCotacao } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { COOKIE_CLIENTE } from "@/lib/sessao";
import { TEMAS } from "@/lib/temas";
import { LOGIN_APRESENTACAO, recriarApresentacao } from "@/lib/apresentacao";

const pais = z.string().refine((v) => Object.hasOwn(TEMAS, v));

export async function escolherCliente(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("clienteId") ?? "");
  if (await db.cliente.findUnique({ where: { id } })) {
    (await cookies()).set(COOKIE_CLIENTE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  // Continua na mesma tela, agora com o cliente novo. Telas de um registro (/caixa/<id>)
  // voltam para a lista, porque o registro é do cliente anterior. De Minha empresa, abre o painel.
  const tela = /^\/([a-z-]+)/.exec(String(form.get("voltar") ?? ""))?.[1];
  redirect(tela && tela !== "empresa" ? `/${tela}` : "/painel");
}

export type Resultado = { ok: boolean; msg: string; contratoId?: string } | null;

const novoCliente = z.object({
  nome: z.string().trim().min(2),
  cidade: z.string().trim().min(2),
  ruc: z.string().trim().optional(),
  idioma: z.enum(["pt", "es"]),
  pais,
  gestorNome: z.string().trim().min(2),
  gestorEmail: z.string().trim().toLowerCase().email(),
  senha: z.string().min(8),
  planoContratado: z.enum(["BASICO", "GESTAO", "VIDEO"]),
  caminhoesContratados: z.coerce.number().int().min(1).max(2000),
  prazoMeses: z.coerce.number().int().min(1).max(60),
  diaVencimento: z.coerce.number().int().min(1).max(28),
  endereco: z.string().trim().max(200).optional(),
});

export async function criarCliente(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const p = novoCliente.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira os campos e escolha o plano. A senha precisa ter pelo menos 8 caracteres." };
  if (await db.usuario.findUnique({ where: { email: p.data.gestorEmail } })) return { ok: false, msg: "Esse e-mail já tem acesso." };
  const senhaHash = await bcrypt.hash(p.data.senha, 10);
  const novo = await db.cliente.create({
    data: {
      nome: p.data.nome,
      cidade: p.data.cidade,
      ruc: p.data.ruc || null,
      idioma: p.data.idioma,
      pais: p.data.pais,
      planoContratado: p.data.planoContratado,
      caminhoesContratados: p.data.caminhoesContratados,
      prazoMeses: p.data.prazoMeses,
      diaVencimento: p.data.diaVencimento,
      endereco: p.data.endereco || null,
      contratoInicio: new Date(),
      usuarios: { create: { nome: p.data.gestorNome, email: p.data.gestorEmail, senhaHash, papel: "GESTOR" } },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${p.data.nome} cadastrado. O gestor entra com ${p.data.gestorEmail}.`, contratoId: novo.id };
}

export async function atualizarAtraso(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id"));
  const dias = z.coerce.number().int().min(0).max(365).parse(form.get("diasEmAtraso"));
  await db.cliente.update({ where: { id }, data: { diasEmAtraso: dias } });
  revalidatePath("/empresa");
}

export async function salvarCotacao(form: FormData) {
  await exigirAdmin();
  const pyg = z.coerce.number().positive().parse(form.get("pygPorUsd"));
  const brl = z.coerce.number().positive().parse(form.get("brlPorUsd"));
  const ars = z.coerce.number().positive().parse(form.get("arsPorUsd"));
  await definirCotacao(pyg, brl, ars);
  revalidatePath("/", "layout");
}

export async function atualizarPais(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("id"));
  await db.cliente.update({ where: { id }, data: { pais: pais.parse(form.get("pais")) } });
  revalidatePath("/", "layout");
}

const novoGestor = z.object({
  clienteId: z.string().min(1),
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(8),
});

/** Mais um acesso de gestor para um cliente que já existe. */
export async function criarGestor(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const p = novoGestor.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Escolha o cliente e confira nome e e-mail. A senha precisa ter pelo menos 8 caracteres." };
  const cliente = await db.cliente.findUnique({ where: { id: p.data.clienteId }, select: { nome: true } });
  if (!cliente) return { ok: false, msg: "Cliente não encontrado." };
  if (await db.usuario.findUnique({ where: { email: p.data.email } })) return { ok: false, msg: "Esse e-mail já tem acesso." };
  await db.usuario.create({
    data: { nome: p.data.nome, email: p.data.email, senhaHash: await bcrypt.hash(p.data.senha, 10), papel: "GESTOR", clienteId: p.data.clienteId },
  });
  revalidatePath("/empresa");
  return { ok: true, msg: `Acesso criado. ${p.data.nome} entra na ${cliente.nome} com ${p.data.email}.` };
}

/** Senha nova para um gestor que esqueceu a dele. */
export async function novaSenhaGestor(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, msg: "A senha precisa ter pelo menos 8 caracteres." };
  const u = await db.usuario.findFirst({ where: { id, papel: "GESTOR" }, select: { email: true } });
  if (!u) return { ok: false, msg: "Acesso não encontrado." };
  await db.usuario.update({ where: { id }, data: { senhaHash: await bcrypt.hash(senha, 10) } });
  return { ok: true, msg: `Senha trocada. Entra com ${u.email}.` };
}

/** Tira o acesso de um gestor. */
export async function removerGestor(form: FormData) {
  await exigirAdmin();
  await db.usuario.deleteMany({ where: { id: String(form.get("id") ?? ""), papel: "GESTOR" } });
  revalidatePath("/empresa");
}

/**
 * Cria (ou recria, com as datas de hoje) a empresa de apresentação e já abre o painel dela.
 * Devolve o login de gestor para mostrar no celular do cliente.
 */
export async function recriarEmpresaApresentacao(_: Resultado): Promise<Resultado> {
  await exigirAdmin();
  const { senha, clienteId } = await recriarApresentacao();
  (await cookies()).set(COOKIE_CLIENTE, clienteId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Pronta! Ela já está escolhida no seletor do topo. Login para mostrar no celular do cliente: ${LOGIN_APRESENTACAO} · senha ${senha}` };
}
