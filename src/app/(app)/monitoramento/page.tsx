import Link from "next/link";
import { clienteAtual } from "@/lib/acesso";
import { dadosCentral, TIPOS_CERCA } from "@/lib/monitoramento";
import { Central } from "./Central";

export const dynamic = "force-dynamic";

export default async function Monitoramento({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const admin = sessao.papel === "ADMIN";
  const todos = admin && (await searchParams).todos === "1";
  const dados = await dadosCentral(todos ? null : cliente.id);
  return (
    <>
      <div className="titulo-acoes">
        <h1>Central de monitoramento</h1>
        {admin && (
          <div className="alternar" role="group" aria-label="Quais clientes monitorar">
            <Link href="/monitoramento" aria-current={!todos ? "true" : undefined}>Só {cliente.nome}</Link>
            <Link href="/monitoramento?todos=1" aria-current={todos ? "true" : undefined}>Todos os clientes</Link>
          </div>
        )}
      </div>
      <Central key={todos ? "todos" : cliente.id} inicial={dados} todos={todos} clienteNome={cliente.nome} podeCercas={sessao.papel !== "OPERADOR"} tiposCerca={TIPOS_CERCA} />
    </>
  );
}
