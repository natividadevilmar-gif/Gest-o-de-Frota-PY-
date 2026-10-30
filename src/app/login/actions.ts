"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lembrarFundo } from "@/lib/fundoLogin";
import { normalizarLogin } from "@/lib/login";
import { assinarSessao, COOKIE_CLIENTE, COOKIE_SESSAO, lerSessao, MAX_AGE_SESSAO } from "@/lib/sessao";

export type EstadoLogin = { erro: string; email: string } | null;

export async function entrar(_: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = normalizarLogin(String(form.get("email") ?? ""));
  const senha = String(form.get("senha") ?? "");
  let u, token;
  try {
    u = await db.usuario.findUnique({ where: { email } });
  } catch (e) {
    console.error("login: banco", e);
    return { erro: "Não foi possível conectar ao banco de dados. Tente de novo em instantes.", email };
  }
  if (!u || !(await bcrypt.compare(senha, u.senhaHash))) return { erro: "Login ou senha incorretos.", email };
  try {
    token = await assinarSessao({ usuarioId: u.id, nome: u.nome, papel: u.papel, clienteId: u.clienteId });
  } catch (e) {
    console.error("login: sessão", e);
    return { erro: "O servidor está sem a configuração SESSION_SECRET. Avise o suporte.", email };
  }
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE_SESSAO, path: "/" });
  // A equipe KM Cero não muda o fundo: o navegador pode ser também de um cliente.
  if (u.papel !== "ADMIN") await lembrarFundo(u.clienteId).catch((e) => console.error("login: fundo", e));
  redirect(u.papel === "ADMIN" ? "/empresa" : u.papel === "MOTORISTA" ? "/despesas" : "/painel");
}

export async function sair() {
  const jar = await cookies();
  // Quem já estava logado antes do fundo existir passa a tê-lo ao sair.
  const sessao = await lerSessao(jar.get(COOKIE_SESSAO)?.value);
  if (sessao && sessao.papel !== "ADMIN") await lembrarFundo(sessao.clienteId).catch((e) => console.error("sair: fundo", e));
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_CLIENTE);
  redirect("/login");
}
