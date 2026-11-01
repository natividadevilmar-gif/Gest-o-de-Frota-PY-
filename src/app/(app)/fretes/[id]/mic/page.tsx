import Link from "next/link";
import { notFound } from "next/navigation";
import { clienteAtual } from "@/lib/acesso";
import { dataBr } from "@/lib/formato";
import { carregarMic } from "@/lib/micDtaDados";
import { Imprimir } from "../../../contrato/[id]/Imprimir";
import { Documento } from "./Documento";
import { FormMic } from "./FormMic";

export const dynamic = "force-dynamic";

export default async function MicDoFrete({ params }: { params: Promise<{ id: string }> }) {
  const { cliente } = await clienteAtual();
  const { id } = await params;
  const m = await carregarMic(cliente.id, id);
  if (!m) notFound();
  const v = m.viagem;
  return (
    <>
      <div className="titulo-acoes nao-imprimir">
        <h1>MIC/DTA · {v.caminhao.placa} · {v.origem} → {v.destino}</h1>
        <div className="form">
          <Link className="btn" href={`/fretes?mes=${v.data.toISOString().slice(0, 7)}`}>← Fretes</Link>
          <Link className="btn" href={`/fretes/${v.id}/crt`}>{v.crt ? "CRT ✓" : "Gerar CRT"}</Link>
          {m.salvo && <Imprimir />}
        </div>
      </div>
      <div className="card nao-imprimir">
        <div className="card-h">
          <h2>{m.salvo ? "Conferir e alterar" : "Conferir os dados"}</h2>
          <p>
            Frete de {dataBr(v.data)}{v.motorista ? ` · ${v.motorista.nome}` : ""}. {m.salvo ? "" : "Já preenchemos com o que a KM Cero sabe do frete. Complete o que falta e salve. "}
            Os dados do caminhão e da empresa ficam guardados para o próximo MIC.
          </p>
        </div>
        <FormMic viagemId={v.id} dados={m.dados} salvo={m.salvo} />
      </div>
      {m.salvo ? (
        <Documento d={m.dados} />
      ) : (
        <p className="note nao-imprimir">Salve para ver o documento pronto para imprimir.</p>
      )}
      <p className="note nao-imprimir">O registro do MIC/DTA na aduana (SOFIA no Paraguai, Siscomex no Brasil) é feito pelo despachante com estes mesmos dados.</p>
    </>
  );
}
