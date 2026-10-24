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

export async function escolherCliente(form: FormData) {
  await exigirAdmin();
  const id = String(form.get("clienteId") ?? "");
  if (await db.cliente.findUnique({ where: { id } })) {
    (await cookies()).set(COOKIE_CLIENTE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  redirect("/painel");
}

export type Resultado = { ok: boolean; msg: string } | null;

const novoCliente = z.object({
  nome: z.string().trim().min(2),
  cidade: z.string().trim().min(2),
  ruc: z.string().trim().optional(),
  idioma: z.enum(["pt", "es"]),
  gestorNome: z.string().trim().min(2),
  gestorEmail: z.string().trim().toLowerCase().email(),
  senha: z.string().min(8),
});

export async function criarCliente(_: Resultado, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const p = novoCliente.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira os campos. A senha precisa ter pelo menos 8 caracteres." };
  if (await db.usuario.findUnique({ where: { email: p.data.gestorEmail } })) return { ok: false, msg: "Esse e-mail já tem acesso." };
  const senhaHash = await bcrypt.hash(p.data.senha, 10);
  await db.cliente.create({
    data: {
      nome: p.data.nome,
      cidade: p.data.cidade,
      ruc: p.data.ruc || null,
      idioma: p.data.idioma,
      usuarios: { create: { nome: p.data.gestorNome, email: p.data.gestorEmail, senhaHash, papel: "GESTOR" } },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${p.data.nome} cadastrado. O gestor entra com ${p.data.gestorEmail}.` };
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
  await definirCotacao(pyg, brl);
  revalidatePath("/", "layout");
}
