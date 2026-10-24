"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { exigirSessao } from "@/lib/acesso";
import { db } from "@/lib/db";

export type Resultado = { ok: boolean; msg: string } | null;

const troca = z.object({ atual: z.string().min(1), nova: z.string().min(8), confirma: z.string() });

export async function trocarSenha(_: Resultado, form: FormData): Promise<Resultado> {
  const sessao = await exigirSessao();
  const p = troca.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (p.data.nova !== p.data.confirma) return { ok: false, msg: "A confirmação não é igual à nova senha." };
  const u = await db.usuario.findUnique({ where: { id: sessao.usuarioId } });
  if (!u || !(await bcrypt.compare(p.data.atual, u.senhaHash))) return { ok: false, msg: "Senha atual incorreta." };
  await db.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(p.data.nova, 10) } });
  return { ok: true, msg: "Senha trocada. Use a nova senha no próximo acesso." };
}
