import { NextResponse, type NextRequest } from "next/server";
import { PAGINAS_MOTORISTA } from "@/lib/login";
import { COOKIE_SESSAO, lerSessao } from "@/lib/sessao";

export async function middleware(req: NextRequest) {
  const sessao = await lerSessao(req.cookies.get(COOKIE_SESSAO)?.value);
  if (!sessao) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  if (sessao.papel === "MOTORISTA" && !PAGINAS_MOTORISTA.some((p) => req.nextUrl.pathname === p || (p.endsWith("/") && req.nextUrl.pathname.startsWith(p)))) {
    return NextResponse.redirect(new URL("/despesas", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|motorista$|bloqueado|saude|ocr|marca|api/cron|_next|favicon.ico).*)"],
};
