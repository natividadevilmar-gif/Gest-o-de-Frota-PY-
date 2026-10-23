import { SignJWT, jwtVerify } from "jose";

export const COOKIE_SESSAO = "gf_sessao";
export const COOKIE_CLIENTE = "gf_cliente"; // cliente escolhido pela equipe interna
const DURACAO_S = 60 * 60 * 12;

export type Sessao = {
  usuarioId: string;
  nome: string;
  papel: "ADMIN" | "GESTOR" | "OPERADOR";
  clienteId: string | null;
};

function chave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function assinarSessao(s: Sessao): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_S}s`)
    .sign(chave());
}

export async function lerSessao(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
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
