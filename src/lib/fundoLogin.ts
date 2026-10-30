import { db } from "@/lib/db";

/** Fundos da tela de login por cliente (imagens em public/marca, liberadas sem login). */
const FUNDOS: Record<string, string> = { svm: "/marca/fundo-svm.jpg" };

/** Chave do fundo do cliente do usuário que está saindo, se o cliente tiver um. */
export async function fundoDoCliente(clienteId: string | null): Promise<string | null> {
  if (!clienteId) return null;
  const c = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  return c && /\bsvm\b/i.test(c.nome) ? "svm" : null;
}

/** Imagem de fundo pedida no endereço da tela de login (?fundo=svm), só das conhecidas. */
export function imagemDoFundo(chave: string | undefined): string | null {
  return (chave && FUNDOS[chave]) || null;
}
