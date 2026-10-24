import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Kpi, Placa, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { despesasMotorista } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { CATEGORIAS_DESPESA, mesAtual, NOME_CATEGORIA } from "@/lib/indicadores";

/** Despesas de um motorista no mês: as que ele lançou e as do caminhão que ele dirige. */
export default async function DespesasDoMotorista({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/painel");
  const { id } = await params;
  const mes = mesValido((await searchParams).mes, mesAtual());
  const dados = await despesasMotorista(cliente.id, id, mes);
  if (!dados) notFound();
  const { motorista, despesas } = dados;
  const comRecibo = new Set(
    (await db.despesa.findMany({ where: { id: { in: despesas.map((d) => d.id) }, recibo: { not: null } }, select: { id: true } })).map((d) => d.id),
  );
  const total = despesas.reduce((a, d) => a + d.valorUsd, 0);
  // Diesel e Arla 32 somam em Combustível, como no relatório de custos.
  const grupo = (cat: string) => (NOME_CATEGORIA[cat] ?? "Outros").split(":")[0];
  const porTipo = CATEGORIAS_DESPESA.map((c) => ({ c, v: despesas.filter((d) => grupo(d.categoria) === c).reduce((a, d) => a + d.valorUsd, 0) }));
  const proprios = despesas.filter((d) => motorista.acesso && d.usuarioId === motorista.acesso.id).length;

  return (
    <>
      <div className="card-h">
        <h1>{motorista.nome}</h1>
        <div className="form" style={{ alignItems: "center" }}>
          <Link className="btn" href="/motoristas">← Motoristas</Link>
          <SeletorMes mes={mes} caminho={`/motoristas/${motorista.id}`} />
          <a className="btn pri" href={`/motoristas/${motorista.id}/relatorio?mes=${mes}`}>Gerar relatório (Excel)</a>
        </div>
      </div>
      <p className="note">
        {motorista.caminhoes.length ? <>Caminhão {motorista.caminhoes.map((c) => <Placa key={c.placa} placa={c.placa} />)} · </> : null}
        {motorista.acesso ? `login ${motorista.acesso.email}` : "sem acesso ao app"}
      </p>
      <div className="grid g4">
        <Kpi rotulo={`Despesas de ${nomeMes(mes)}`} valor={usd(total)} sub={`${despesas.length} lançamentos`} />
        <Kpi rotulo="Lançadas por ele" valor={num(proprios)} sub="pelo app do motorista" />
        {porTipo.filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 2).map((x) => (
          <Kpi key={x.c} rotulo={x.c} valor={usd(x.v)} sub={total ? `${Math.round((x.v / total) * 100)}% do total` : undefined} />
        ))}
      </div>
      <div className="card">
        <div className="card-h"><h2>Por tipo</h2><p>USD</p></div>
        <div className="tw">
          <table>
            <thead><tr>{CATEGORIAS_DESPESA.map((c) => <th key={c} className="n">{c}</th>)}<th className="n">Total</th></tr></thead>
            <tbody><tr>{porTipo.map((x) => <td key={x.c} className="n">{x.v ? num(x.v, 2) : "–"}</td>)}<td className="n"><b>{num(total, 2)}</b></td></tr></tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Lançamentos</h2><p>{despesas.length} despesas</p></div>
        {despesas.length === 0 ? (
          <p className="note">Nenhuma despesa deste motorista em {nomeMes(mes)}.</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Tipo</th><th>Detalhe</th><th className="n">Valor pago</th><th className="n">USD</th><th>Lançado por</th><th>Recibo</th></tr></thead>
              <tbody>
                {despesas.map((d) => (
                  <tr key={d.id}>
                    <td>{dataBr(d.data)}</td>
                    <td><Placa placa={d.caminhao.placa} /></td>
                    <td>{NOME_CATEGORIA[d.categoria]}{d.origem !== "manual" && <> <span className="tag">{d.origem === "foto" ? "foto" : "áudio"}</span></>}</td>
                    <td>{[d.litros ? `${num(d.litros, 1)} l` : null, d.odometroKm ? `${num(d.odometroKm)} km` : null, d.posto, d.descricao].filter(Boolean).join(" · ") || "–"}</td>
                    <td className="n">{d.moeda === "USD" ? "–" : `${SIMBOLO[d.moeda as Moeda]} ${num(d.valorOriginal, d.moeda === "PYG" ? 0 : 2)}`}</td>
                    <td className="n">{num(d.valorUsd, 2)}</td>
                    <td>{d.usuario ? (d.usuario.papel === "MOTORISTA" ? "motorista" : d.usuario.nome) : "–"}</td>
                    <td>{comRecibo.has(d.id) ? <a href={`/recibos/${d.id}`} target="_blank" rel="noopener">ver</a> : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
