import Link from "next/link";
import { clienteAtual } from "@/lib/acesso";
import { dadosCentral, TIPOS_CERCA } from "@/lib/monitoramento";
import { db } from "@/lib/db";
import { credenciaisWialon, linkTokenWialon, SERVIDORES_WIALON } from "@/lib/rastreio/wialon";
import { ehImei } from "@/lib/telemetria/posicoes";
import { Central } from "./Central";
import { PainelWialon } from "./PainelWialon";

export const dynamic = "force-dynamic";

export default async function Monitoramento({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const admin = sessao.papel === "ADMIN";
  const todos = admin && (await searchParams).todos === "1";
  const dados = await dadosCentral(todos ? null : cliente.id);
  const cred = credenciaisWialon(cliente);
  const rastreadores = admin && !todos
    ? (await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { rastreadorId: true } })).map((c) => c.rastreadorId)
    : [];
  const ligados = cred ? rastreadores.filter(ehImei).length : 0;
  const demo = rastreadores.filter((r) => r?.startsWith("SIM-")).length;
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
      {admin && !todos && (
        <PainelWialon
          cliente={cliente.nome}
          conectado={!!cred}
          servidor={cred?.host ?? null}
          servidores={SERVIDORES_WIALON.map((sv) => ({ ...sv, link: linkTokenWialon(sv.site) }))}
          ligados={ligados}
          total={dados.frota.length}
          demo={demo}
        />
      )}
      <Central key={todos ? "todos" : cliente.id} inicial={dados} todos={todos} clienteNome={cliente.nome} podeCercas={sessao.papel !== "OPERADOR"} tiposCerca={TIPOS_CERCA} />
    </>
  );
}
