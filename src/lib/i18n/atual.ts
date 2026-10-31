import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";
import { COOKIE_IDIOMA, idiomaValido, type Idioma } from "./idiomas";

/**
 * Idioma das telas: o escolhido pelo usuário (guardado no cadastro dele),
 * senão o escolhido neste aparelho antes do login, senão o do cliente para o
 * motorista, senão português.
 */
export const idiomaAtual = cache(async (): Promise<Idioma> => {
  const jar = await cookies();
  const doAparelho = idiomaValido(jar.get(COOKIE_IDIOMA)?.value);
  const sessao = await lerSessao(jar.get(COOKIE_SESSAO)?.value);
  if (!sessao) return doAparelho ?? "pt";
  try {
    const u = await db.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { idioma: true, cliente: { select: { idioma: true } } } });
    if (u?.idioma) return u.idioma;
    if (doAparelho) return doAparelho;
    if (sessao.papel === "MOTORISTA" && u?.cliente?.idioma) return u.cliente.idioma;
  } catch {
    // Sem banco, a tela sai no idioma do aparelho.
  }
  return doAparelho ?? "pt";
});
