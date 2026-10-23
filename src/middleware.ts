import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

export async function middleware(req: NextRequest) {
  const sessao = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value);
  if (!sessao) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|bloqueado|_next|favicon.ico).*)"],
};
