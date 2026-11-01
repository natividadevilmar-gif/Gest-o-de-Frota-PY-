import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteAtual } from "@/lib/acesso";
import { carregarCrt } from "@/lib/crtDados";
import { dataBr } from "@/lib/formato";
import { Imprimir } from "../../../contrato/[id]/Imprimir";
import { Documento } from "./Documento";
import { FormCrt } from "./FormCrt";

export const dynamic = "force-dynamic";

export default async function CrtDoFrete({ params }: { params: Promise<{ id: string }> }) {
  const { cliente } = await clienteAtual();
  const { id } = await params;
  const c = await carregarCrt(cliente.id, id);
  if (!c) notFound();
  const v = c.viagem;
  return (
    <>
      <div className="titulo-acoes nao-imprimir">
        <h1>CRT · {v.caminhao.placa} · {v.origem} → {v.destino}</h1>
        <div className="form">
          <Link className="btn" href={`/fretes?mes=${v.data.toISOString().slice(0, 7)}`}>← Fretes</Link>
          <Link className="btn" href={`/fretes/${v.id}/mic`}>{v.mic ? "MIC/DTA ✓" : "Gerar MIC/DTA"}</Link>
          {c.salvo && <Imprimir />}
        </div>
      </div>
      <div className="card nao-imprimir">
        <div className="card-h">
          <h2>{c.salvo ? "Conferir e alterar" : "Conferir os dados"}</h2>
          <p>
            Frete de {dataBr(v.data)}{v.motorista ? ` · ${v.motorista.nome}` : ""}. {c.salvo ? "" : "Já preenchemos com o que a KM Cero sabe do frete. Complete o que falta e salve. "}
            Destinatário e instruções se repetem no próximo CRT do mesmo remetente.
          </p>
        </div>
        <FormCrt viagemId={v.id} dados={c.dados} salvo={c.salvo} />
      </div>
      {c.salvo ? (
        <Documento d={c.dados} />
      ) : (
        <p className="note nao-imprimir">Salve para ver o documento pronto para imprimir.</p>
      )}
      <p className="note nao-imprimir">Faça o CRT antes do MIC/DTA: o número dele vai para o campo 23 do MIC. Imprima as vias que o despachante pedir (remetente, destinatário, transportador e alfândega).</p>
    </>
  );
}
