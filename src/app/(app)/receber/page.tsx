import Link from "next/link";
import { Kpi, Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { agruparPorCliente, mensagemCobranca, totaisReceber, type Situacao } from "@/lib/receber";
import { excluirRecebimento, registrarRecebimento } from "./actions";

export const dynamic = "force-dynamic";

function Pill({ s }: { s: Situacao }) {
  if (s.tipo === "vencido") return <span className="pill bad">vencido há {s.dias} {s.dias === 1 ? "dia" : "dias"}</span>;
  if (s.tipo === "hoje") return <span className="pill warn">vence hoje</span>;
  if (s.tipo === "semana") return <span className="pill warn">vence em {s.dias} {s.dias === 1 ? "dia" : "dias"}</span>;
  return <span className="pill">vence em {s.dias} dias</span>;
}

export default async function Receber() {
  const { sessao, cliente } = await clienteAtual();
  const pode = podeEditarCadastros(sessao);
  const hoje = new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));

  const [abertas, recebidosMes, ultimos] = await Promise.all([
    db.viagem.findMany({
      where: { caminhao: { clienteId: cliente.id }, recebido: false },
      select: {
        id: true, embarcador: true, data: true, vencimento: true, freteUsd: true, recebido: true, origem: true, destino: true, documento: true,
        caminhao: { select: { placa: true } }, recebimentos: { select: { valorUsd: true } },
      },
    }),
    db.recebimento.aggregate({ where: { viagem: { caminhao: { clienteId: cliente.id } }, data: { gte: inicioMes } }, _sum: { valorUsd: true }, _count: true }),
    db.recebimento.findMany({
      where: { viagem: { caminhao: { clienteId: cliente.id } } },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      take: 10,
      select: { id: true, data: true, valorUsd: true, observacao: true, viagem: { select: { embarcador: true, origem: true, destino: true, caminhao: { select: { placa: true } } } } },
    }),
  ]);

  const grupos = agruparPorCliente(
    abertas.map((v) => ({ ...v, placa: v.caminhao.placa, recebidoUsd: v.recebimentos.reduce((t, r) => t + r.valorUsd, 0) })),
    hoje,
  );
  const t = totaisReceber(grupos);

  return (
    <>
      <div className="card-h">
        <h1>Contas a receber</h1>
        <Link className="btn" href="/fretes">Fretes do mês</Link>
      </div>
      <div className="grid g4">
        <Kpi rotulo="A receber" valor={usd(t.total)} sub={`${t.fretes} ${t.fretes === 1 ? "frete" : "fretes"} em aberto`} />
        <Kpi rotulo="Vencido" valor={usd(t.vencido)} sub={t.vencido > 0 ? "cobrar agora" : "nada atrasado"} />
        <Kpi rotulo="Vence em 7 dias" valor={usd(t.semana)} />
        <Kpi rotulo="Recebido no mês" valor={usd(recebidosMes._sum.valorUsd ?? 0)} sub={`${recebidosMes._count} ${recebidosMes._count === 1 ? "pagamento" : "pagamentos"}`} />
      </div>

      {grupos.length === 0 ? (
        <div className="card"><p className="note">Nenhum frete em aberto. Tudo recebido!</p></div>
      ) : (
        grupos.map((g) => (
          <div className="card" key={g.embarcador}>
            <div className="card-h">
              <h2>{g.embarcador}</h2>
              <div className="form" style={{ alignItems: "center" }}>
                <p>Deve <b>{usd(g.saldo)}</b>{g.vencido > 0 && <> · <span className="t-bad">{usd(g.vencido)} vencido</span></>}</p>
                <a className="btn pri" href={`https://wa.me/?text=${encodeURIComponent(mensagemCobranca(g, cliente.nome))}`} target="_blank" rel="noopener">Cobrar no WhatsApp</a>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead><tr><th>Frete</th><th>Caminhão</th><th>Rota</th><th>Vencimento</th><th className="n">Valor</th><th className="n">Falta</th>{pode && <th>Receber</th>}</tr></thead>
                <tbody>
                  {g.fretes.map((f) => (
                    <tr key={f.id}>
                      <td>{dataBr(f.data)}{f.documento && <><br /><small className="muted">{f.documento}</small></>}</td>
                      <td><Placa placa={f.placa} /></td>
                      <td>{f.origem} → {f.destino}</td>
                      <td>{f.vencimento ? dataBr(f.vencimento) : <small className="muted">sem data (30 dias)</small>}<br /><Pill s={f.situacao} /></td>
                      <td className="n">{usd(f.freteUsd)}</td>
                      <td className="n"><b>{usd(f.saldo)}</b>{f.recebidoUsd > 0 && <><br /><small className="muted">já recebeu {usd(f.recebidoUsd)}</small></>}</td>
                      {pode && (
                        <td>
                          <form action={registrarRecebimento} className="form receber-form">
                            <input type="hidden" name="viagemId" value={f.id} />
                            <input name="valor" inputMode="decimal" defaultValue={num(f.saldo, 2).replace(/\./g, "")} aria-label={`Valor recebido de ${f.origem} → ${f.destino}`} />
                            <input name="data" type="date" defaultValue={hojeIso} aria-label="Data do pagamento" />
                            <button type="submit">Receber</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {ultimos.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Últimos pagamentos recebidos</h2></div>
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Cliente</th><th>Frete</th><th className="n">Valor</th>{pode && <th />}</tr></thead>
              <tbody>
                {ultimos.map((r) => (
                  <tr key={r.id}>
                    <td>{dataBr(r.data)}</td>
                    <td>{r.viagem.embarcador ?? "–"}{r.observacao && <><br /><small className="muted">{r.observacao}</small></>}</td>
                    <td><Placa placa={r.viagem.caminhao.placa} /> {r.viagem.origem} → {r.viagem.destino}</td>
                    <td className="n">{usd(r.valorUsd)}</td>
                    {pode && <td><form action={excluirRecebimento}><input type="hidden" name="id" value={r.id} /><button type="submit" className="link">desfazer</button></form></td>}
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
