import { cookies } from "next/headers";
import { db } from "@/lib/db";

/** Lembra no navegador de qual cliente é quem entrou, para a tela de login mostrar o fundo dele depois de sair. */
export const COOKIE_FUNDO = "gf_fundo";

/** Fundos de login por cliente (imagens em public/marca, liberadas sem login). */
const FUNDOS: Record<string, string> = { svm: "/marca/fundo-svm.jpg" };

function chaveDoCliente(nome: string): string | null {
  return /\bsvm\b/i.test(nome) ? "svm" : null;
}

/** Guarda (ou apaga) o fundo do cliente do usuário; usado ao entrar e ao sair. */
export async function lembrarFundo(clienteId: string | null) {
  const jar = await cookies();
  const cliente = clienteId ? await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } }) : null;
  const chave = cliente ? chaveDoCliente(cliente.nome) : null;
  if (chave) jar.set(COOKIE_FUNDO, chave, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  else jar.delete(COOKIE_FUNDO);
}

/** Imagem de fundo da tela de login neste navegador, se houver. */
export async function fundoDoLogin(): Promise<string | null> {
  const chave = (await cookies()).get(COOKIE_FUNDO)?.value;
  return (chave && FUNDOS[chave]) || null;
}
