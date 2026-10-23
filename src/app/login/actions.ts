"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assinarSessao, COOKIE_CLIENTE, COOKIE_SESSAO, MAX_AGE_SESSAO } from "@/lib/sessao";

export type EstadoLogin = { erro: string; email: string } | null;

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const u = await db.usuario.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(senha, u.senhaHash))) return { erro: "E-mail ou senha incorretos.", email };

  const token = await assinarSessao({ usuarioId: u.id, nome: u.nome, papel: u.papel, clienteId: u.clienteId });
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE_SESSAO, path: "/" });
  redirect(u.papel === "ADMIN" ? "/empresa" : "/painel");
}

export async function sair() {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_CLIENTE);
  redirect("/login");
}
