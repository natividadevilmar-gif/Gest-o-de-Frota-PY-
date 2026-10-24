import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESSAO = "gf_sessao";
export const COOKIE_CLIENTE = "gf_cliente"; // cliente escolhido pela equipe interna
const DURACAO_S = 60 * 60 * 12;

export type Sessao = {
  usuarioId: string;
  nome: string;
  papel: "ADMIN" | "GESTOR" | "OPERADOR" | "MOTORISTA";
  clienteId: string | null;
};

// Usa SESSION_SECRET quando definido. Sem ele, deriva a chave da URL do banco,
// que também é secreta e já existe em todo deploy (trocar a senha do banco
// apenas desconecta quem estiver logado).
async function chave() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Defina SESSION_SECRET (32+ caracteres) ou DATABASE_URL");
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gf-sessao:${base}`)));
}

export async function assinarSessao(s: Sessao): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_S}s`)
    .sign(await chave());
}

export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await chave());
    return {
      usuarioId: String(payload.usuarioId),
      nome: String(payload.nome),
      papel: payload.papel as Sessao["papel"],
      clienteId: (payload.clienteId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export const MAX_AGE_SESSAO = DURACAO_S;
