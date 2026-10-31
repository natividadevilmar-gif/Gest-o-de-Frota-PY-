"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";
import { COOKIE_IDIOMA, idiomaValido } from "./idiomas";

/** Guarda o idioma escolhido no seletor: neste aparelho e no cadastro de quem está logado. */
export async function trocarIdioma(valor: string) {
  const idioma = idiomaValido(valor);
  if (!idioma) return;
  const jar = await cookies();
  jar.set(COOKIE_IDIOMA, idioma, { sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  const sessao = await lerSessao(jar.get(COOKIE_SESSAO)?.value);
  if (sessao) await db.usuario.update({ where: { id: sessao.usuarioId }, data: { idioma } }).catch(() => undefined);
}
