import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, taxa, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { caixasMotoristas } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { NOME_CATEGORIA } from "@/lib/indicadores";
import { Imprimir } from "../../../contrato/[id]/Imprimir";

export const dynamic = "force-dynamic";

/** Acerto de viagem: recibo do caixa do motorista, com cada despesa e quem deve a quem, para assinar. */
export default async function Acerto({ params }: { params: Promise<{ id: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/despesas");
  const { id } = await params;
  const base = await db.caixaViagem.findFirst({ where: { id, clienteId: cliente.id }, select: { motoristaId: true } });
  if (!base) notFound();
  const [caixas, cot, empresa] = await Promise.all([
    caixasMotoristas(cliente.id, { motoristaId: base.motoristaId }),
    cotacaoDoDia(),
    db.cliente.findUniqueOrThrow({ where: { id: cliente.id }, select: { nome: true, ruc: true, cidade: true } }),
  ]);
  const c = caixas.find((x) => x.id === id);
  if (!c) notFound();
  const despesas = c.despesasWhere
    ? await db.despesa.findMany({ where: c.despesasWhere, include: { caminhao: { select: { placa: true } } }, omit: { recibo: true }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }] })
    : [];
  const moeda = c.moeda as Moeda;
  const t = taxa(moeda, cot) ?? 1;
  const fmt = (v: number) => (moeda === "USD" ? usd(v) : `${SIMBOLO[moeda]} ${num(v, moeda === "PYG" ? 0 : 2)}`);
  const naMoeda = (d: (typeof despesas)[number]) => (d.moeda === moeda && d.valorOriginal ? d.valorOriginal : moeda === "USD" ? d.valorUsd : d.valorUsd * t);
  const gasto = despesas.reduce((a, d) => a + naMoeda(d), 0);
  const saldo = c.valorOriginal - gasto;
  const nome = await db.motorista.findUniqueOrThrow({ where: { id: c.motoristaId }, select: { nome: true, documento: true } });

  const texto = [
    `Acerto de viagem · ${empresa.nome}`,
    `Motorista: ${nome.nome}`,
    `Recebido em ${dataBr(c.data)}: ${fmt(c.valorOriginal)}`,
    `Gasto (${despesas.length} despesas): ${fmt(gasto)}`,
    saldo >= 0 ? `Saldo a devolver: ${fmt(saldo)}` : `A empresa reembolsa: ${fmt(-saldo)}`,
  ].join("\n");

  return (
    <>
      <div className="titulo-acoes nao-imprimir">
        <h1>Acerto de viagem · {nome.nome}</h1>
        <div className="form">
          <Link className="btn" href={`/caixa/${c.motoristaId}`}>← Caixa do motorista</Link>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener">Enviar resumo no WhatsApp</a>
          <Imprimir />
        </div>
      </div>
      {c.aberto && <p className="note nao-imprimir">Este caixa ainda está aberto: o acerto mostra o que foi lançado até agora. Feche o caixa depois de assinar.</p>}
      <article className="contrato acerto">
        <h2 style={{ textAlign: "center", margin: "0 0 4px" }}>Acerto de viagem</h2>
        <p style={{ textAlign: "center", margin: "0 0 18px" }}>{empresa.nome}{empresa.ruc ? ` · RUC ${empresa.ruc}` : ""}</p>
        <table className="acerto-dados">
          <tbody>
            <tr><th>Motorista</th><td>{nome.nome}{nome.documento ? ` · Doc. ${nome.documento}` : ""}</td></tr>
            {c.caminhao && <tr><th>Caminhão</th><td>{c.caminhao.placa}</td></tr>}
            <tr><th>Período</th><td>{dataBr(c.data)} a {c.fechadoEm ? dataBr(c.fechadoEm) : c.aberto ? "em aberto" : "entrega do caixa seguinte"}</td></tr>
            {c.observacao && <tr><th>Observação</th><td>{c.observacao}</td></tr>}
          </tbody>
        </table>
        <table className="acerto-lista">
          <thead><tr><th>Data</th><th>Despesa</th><th>Detalhe</th><th className="n">Valor</th></tr></thead>
          <tbody>
            <tr><td>{dataBr(c.data)}</td><td colSpan={2}><b>Dinheiro recebido para a viagem</b></td><td className="n"><b>+ {fmt(c.valorOriginal)}</b></td></tr>
            {despesas.map((d) => (
              <tr key={d.id}>
                <td>{dataBr(d.data)}</td>
                <td>{NOME_CATEGORIA[d.categoria]}{d.caminhao ? ` · ${d.caminhao.placa}` : ""}</td>
                <td>{[d.litros ? `${num(d.litros, 1)} l` : null, d.posto, d.descricao].filter(Boolean).join(" · ") || "–"}{d.reciboTipo ? " · com recibo" : ""}</td>
                <td className="n">− {fmt(naMoeda(d))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>Total gasto ({despesas.length} {despesas.length === 1 ? "despesa" : "despesas"})</td><td className="n">{fmt(gasto)}</td></tr>
            <tr className="acerto-saldo"><td colSpan={3}>{saldo >= 0 ? "Saldo que o motorista devolve à empresa" : "Valor que a empresa reembolsa ao motorista"}</td><td className="n">{fmt(Math.abs(saldo))}</td></tr>
          </tfoot>
        </table>
        {moeda !== "USD" && <p className="acerto-nota">Despesas pagas em outra moeda convertidas pela cotação de {dataBr(new Date(cot.data))}.</p>}
        <p>Declaro que as despesas acima são verdadeiras e que {saldo >= 0 ? "devolvi" : "recebi"} o valor de <b>{fmt(Math.abs(saldo))}</b> em ____/____/________, em ☐ dinheiro ☐ transferência.</p>
        <div className="contrato-assinaturas">
          <div><span /><b>{nome.nome}</b><small>Motorista</small></div>
          <div><span /><b>{empresa.nome}</b><small>Responsável</small></div>
        </div>
        <p className="contrato-rodape">{empresa.cidade}, {dataBr(new Date())} · gerado pela KM Cero</p>
      </article>
    </>
  );
}
