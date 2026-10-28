import Link from "next/link";
import { clienteAtual } from "@/lib/acesso";
import { COMANDOS } from "@/lib/comandos/catalogo";
import { dadosComandos } from "@/lib/comandos/dados";
import { Comandos } from "./Comandos";

export const dynamic = "force-dynamic";

export default async function PaginaComandos({ searchParams }: { searchParams: Promise<{ todos?: string; caminhao?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const admin = sessao.papel === "ADMIN";
  const sp = await searchParams;
  const todos = admin && sp.todos === "1";
  const dados = await dadosComandos(todos ? null : cliente.id);
  return (
    <>
      <div className="titulo-acoes">
        <h1>Comandos</h1>
        {admin && (
          <div className="alternar" role="group" aria-label="Quais clientes">
            <Link href="/comandos" aria-current={!todos ? "true" : undefined}>Só {cliente.nome}</Link>
            <Link href="/comandos?todos=1" aria-current={todos ? "true" : undefined}>Todos os clientes</Link>
          </div>
        )}
      </div>
      <p className="note">Ordens enviadas ao rastreador do caminhão. O bloqueio do motor está desativado na plataforma.</p>
      <Comandos
        key={todos ? "todos" : cliente.id}
        inicial={dados}
        todos={todos}
        selecionadoInicial={sp.caminhao ?? null}
        papel={sessao.papel}
        catalogo={COMANDOS}
      />
    </>
  );
}
