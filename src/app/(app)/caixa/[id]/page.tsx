import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Kpi, Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, taxa, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { caixasMotoristas } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { NOME_CATEGORIA } from "@/lib/indicadores";
import { fecharCaixa } from "../actions";

/** Caixa de um motorista: o que recebeu, cada despesa que saiu do dinheiro e quanto sobra. */
export default async function CaixaDoMotorista({ params }: { params: Promise<{ id: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/despesas");
  const { id } = await params;
  const motorista = await db.motorista.findFirst({ where: { id, clienteId: cliente.id }, select: { id: true, nome: true, acesso: { select: { email: true } } } });
  if (!motorista) notFound();
  const [caixas, cot] = await Promise.all([caixasMotoristas(cliente.id, { motoristaId: motorista.id }), cotacaoDoDia()]);
  const atual = caixas.find((c) => c.aberto) ?? caixas[0];
  const despesas = atual?.despesasWhere
    ? await db.despesa.findMany({ where: atual.despesasWhere, include: { caminhao: { select: { placa: true } } }, omit: { recibo: true }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }] })
    : [];
  const moeda = (atual?.moeda ?? "USD") as Moeda;
  const t = taxa(moeda, cot) ?? 1;
  const fmt = (v: number) => (moeda === "USD" ? usd(v) : `${SIMBOLO[moeda]} ${num(v, 2)}`);
  // Saldo depois de cada despesa, na moeda do caixa (despesas em outra moeda convertidas pela cotação de hoje).
  let restante = atual?.valorOriginal ?? 0;
  const linhas = despesas.map((d) => {
    const naMoeda = d.moeda === moeda && d.valorOriginal ? d.valorOriginal : moeda === "USD" ? d.valorUsd : d.valorUsd * t;
    restante -= naMoeda;
    return { d, naMoeda, restante };
  });
  const gasto = linhas.reduce((a, l) => a + l.naMoeda, 0);

  return (
    <>
      <div className="card-h">
        <h1>Caixa de {motorista.nome}</h1>
        <Link className="btn" href="/caixa">← Caixa dos motoristas</Link>
      </div>
      <p className="note">{motorista.acesso ? `Conta as despesas que ele lança pelo app (login ${motorista.acesso.email}).` : "Sem acesso ao app: conta as despesas do caminhão dele, menos manutenção e pneus."}</p>
      {!atual ? (
        <div className="card"><p className="note">Nenhum caixa entregue a este motorista. <Link href="/caixa#novo">Entregar caixa inicial</Link></p></div>
      ) : (
        <>
          <div className="grid g3">
            <Kpi rotulo={atual.aberto ? "Recebido (caixa aberto)" : "Recebido (último caixa)"} valor={fmt(atual.valorOriginal)} sub={`em ${dataBr(atual.data)}${atual.caminhao ? ` · ${atual.caminhao.placa}` : ""}`} />
            <Kpi rotulo="Gasto" valor={fmt(gasto)} sub={`${linhas.length} despesas`} />
            <Kpi rotulo={atual.aberto ? "Ainda com o motorista" : "Sobrou"} valor={fmt(atual.valorOriginal - gasto)} sub={moeda === "USD" ? undefined : `≈ ${usd(atual.saldoUsd)}`} />
          </div>
          <div className="form" style={{ marginBottom: 12 }}>
            <Link className="btn pri" href={`/caixa/acerto/${atual.id}`}>Acerto de viagem (recibo para assinar)</Link>
            {atual.aberto && (
              <form action={fecharCaixa}>
                <input type="hidden" name="id" value={atual.id} />
                <button type="submit">Fechar caixa (motorista prestou contas)</button>
              </form>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h2>Despesas que saíram do caixa</h2><p>{atual.observacao ?? ""}</p></div>
            {linhas.length === 0 ? <p className="note">Nenhuma despesa lançada desde a entrega do dinheiro.</p> : (
              <div className="tw">
                <table>
                  <thead><tr><th>Data</th><th>Caminhão</th><th>Tipo</th><th>Detalhe</th><th className="n">Valor pago</th><th className="n">Saldo depois</th><th>Recibo</th></tr></thead>
                  <tbody>
                    <tr><td>{dataBr(atual.data)}</td><td /><td colSpan={2}><b>Dinheiro recebido</b></td><td className="n">+ {fmt(atual.valorOriginal)}</td><td className="n"><b>{fmt(atual.valorOriginal)}</b></td><td /></tr>
                    {linhas.map(({ d, naMoeda, restante }) => (
                      <tr key={d.id}>
                        <td>{dataBr(d.data)}</td>
                        <td><Placa placa={d.caminhao.placa} /></td>
                        <td>{NOME_CATEGORIA[d.categoria]}</td>
                        <td>{[d.litros ? `${num(d.litros, 1)} l` : null, d.posto, d.descricao].filter(Boolean).join(" · ") || "–"}</td>
                        <td className="n">− {fmt(naMoeda)}{d.moeda !== moeda && <><br /><small className="muted">{d.moeda === "USD" ? usd(d.valorUsd) : `${SIMBOLO[d.moeda as Moeda]} ${num(d.valorOriginal, 2)}`}</small></>}</td>
                        <td className="n"><b className={restante < 0 ? "t-bad" : ""}>{fmt(restante)}</b></td>
                        <td>{d.reciboTipo ? <a href={`/recibos/${d.id}`} target="_blank" rel="noopener">ver</a> : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      {caixas.length > 1 && (
        <div className="card">
          <div className="card-h"><h2>Caixas anteriores</h2></div>
          <div className="tw">
            <table>
              <thead><tr><th>Entregue em</th><th className="n">Recebido</th><th className="n">Gasto</th><th className="n">Sobrou</th><th>Encerrado</th><th /></tr></thead>
              <tbody>
                {caixas.filter((c) => c.id !== atual?.id).map((c) => (
                  <tr key={c.id}>
                    <td>{dataBr(c.data)}</td>
                    <td className="n">{c.moeda === "USD" ? usd(c.valorUsd) : `${SIMBOLO[c.moeda as Moeda]} ${num(c.valorOriginal, 2)}`}</td>
                    <td className="n">{usd(c.gastoUsd)}</td>
                    <td className="n"><span className={c.saldoUsd < 0 ? "t-bad" : "t-ok"}>{usd(c.saldoUsd)}</span></td>
                    <td>{c.fechadoEm ? dataBr(c.fechadoEm) : "com novo caixa"}</td>
                    <td><Link href={`/caixa/acerto/${c.id}`}>acerto</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
