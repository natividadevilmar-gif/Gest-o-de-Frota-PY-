import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { COOKIE_CLIENTE, COOKIE_SESSAO, lerSessao, type Sessao } from "@/lib/sessao";
import { situacaoPagamento } from "@/lib/indicadores";

export async function exigirSessao(): Promise<Sessao> {
  const jar = await cookies();
  const s = await lerSessao(jar.get(COOKIE_SESSAO)?.value);
  if (!s) redirect("/login");
  return s;
}

export async function exigirAdmin(): Promise<Sessao> {
  const s = await exigirSessao();
  if (s.papel !== "ADMIN") redirect("/painel");
  return s;
}

/**
 * Cliente (transportadora) cujos dados a tela mostra. Gestores e operadores só
 * veem o próprio; a equipe interna escolhe um cliente no seletor do topo.
 * Toda consulta de frota deve filtrar por este id.
 */
export async function clienteOpcional() {
  const s = await exigirSessao();
  let clienteId = s.clienteId;
  if (s.papel === "ADMIN") {
    const jar = await cookies();
    clienteId = jar.get(COOKIE_CLIENTE)?.value ?? null;
    if (!clienteId) {
      // Sem escolha feita, abre o cliente mais antigo (o de demonstração, SVM Trucks).
      const primeiro = await db.cliente.findFirst({ orderBy: { criadoEm: "asc" }, select: { id: true } });
      clienteId = primeiro?.id ?? null;
    }
  }
  const cliente = clienteId ? await db.cliente.findUnique({ where: { id: clienteId } }) : null;
  if (!cliente && s.papel !== "ADMIN") redirect("/login");
  const bloqueado = cliente ? situacaoPagamento(cliente.diasEmAtraso) === "bloqueado" : false;
  if (bloqueado && s.papel !== "ADMIN") redirect("/bloqueado");
  return { sessao: s, cliente, bloqueado };
}

export async function clienteAtual() {
  const r = await clienteOpcional();
  if (!r.cliente) redirect("/empresa");
  return { ...r, cliente: r.cliente };
}

/** Para o papel MOTORISTA: id do motorista vinculado ao login (null para os demais). */
export async function motoristaDaSessao(s: Sessao): Promise<string | null> {
  if (s.papel !== "MOTORISTA") return null;
  const u = await db.usuario.findUnique({ where: { id: s.usuarioId }, select: { motoristaId: true } });
  return u?.motoristaId ?? "";
}

export function podeEditarCadastros(s: Sessao) {
  return s.papel === "ADMIN" || s.papel === "GESTOR";
}
