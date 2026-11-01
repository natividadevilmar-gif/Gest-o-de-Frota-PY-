import { FiltroCliente } from "@/components/FiltroCliente";
import { clienteAtual } from "@/lib/acesso";
import { dadosCentral, TIPOS_CERCA } from "@/lib/monitoramento";
import { db } from "@/lib/db";
import { SERVIDOR_CUSAT } from "@/lib/rastreio/gpswox";
import { credenciaisWialon, linkTokenWialon, SERVIDORES_WIALON } from "@/lib/rastreio/wialon";
import { ehImei } from "@/lib/telemetria/posicoes";
import { Central } from "./Central";
import { PainelCusat } from "./PainelCusat";
import { PainelWialon } from "./PainelWialon";
import { NOME_APRESENTACAO } from "@/lib/apresentacao";

export const dynamic = "force-dynamic";
// A rodada de histórico do Wialon trabalha até 40 segundos.
export const maxDuration = 60;

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
        {admin && <FiltroCliente clientes={await db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } })} atual={cliente.id} todos={todos} caminho="/monitoramento" />}
      </div>
      {admin && !todos && cliente.nome !== NOME_APRESENTACAO && (!!cred || !cliente.gpswoxHash) && (
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
      {admin && !todos && cliente.nome !== NOME_APRESENTACAO && (!cred || !!cliente.gpswoxHash) && (
        <PainelCusat
          cliente={cliente.nome}
          conectado={!!cliente.gpswoxHash}
          servidor={cliente.gpswoxHost ?? SERVIDOR_CUSAT}
          email={cliente.gpswoxEmail}
          ligados={cliente.gpswoxHash ? rastreadores.filter(ehImei).length : 0}
        />
      )}
      <Central key={todos ? "todos" : cliente.id} inicial={dados} todos={todos} clienteNome={cliente.nome} podeCercas={sessao.papel !== "OPERADOR"} tiposCerca={TIPOS_CERCA} />
    </>
  );
}
