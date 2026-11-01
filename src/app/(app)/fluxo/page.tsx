import Link from "next/link";
import { Kpi } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { dataBr, lerValor, usd } from "@/lib/formato";
import { projetarFluxo } from "@/lib/fluxo";
import { saldo as saldoFrete } from "@/lib/receber";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;

/** Caixa estimado: tudo o que foi recebido menos despesas, custos extras dos fretes e contas pagas. */
async function caixaEstimado(clienteId: string) {
  const doCliente = { caminhao: { clienteId } };
  const [recebidos, parciais, despesas, extras, pagas] = await Promise.all([
    db.viagem.aggregate({ where: { ...doCliente, recebido: true }, _sum: { freteUsd: true } }),
    db.recebimento.aggregate({ where: { viagem: { ...doCliente, recebido: false } }, _sum: { valorUsd: true } }),
    db.despesa.aggregate({ where: doCliente, _sum: { valorUsd: true } }),
    db.viagem.aggregate({ where: doCliente, _sum: { custosExtrasUsd: true } }),
    db.contaPagar.aggregate({ where: { clienteId, pagoEm: { not: null } }, _sum: { valorUsd: true } }),
  ]);
  return (
    (recebidos._sum.freteUsd ?? 0) + (parciais._sum.valorUsd ?? 0) - (despesas._sum.valorUsd ?? 0) - (extras._sum.custosExtrasUsd ?? 0) - (pagas._sum.valorUsd ?? 0)
  );
}

export default async function Fluxo({ searchParams }: { searchParams: Promise<{ saldo?: string }> }) {
  const { cliente } = await clienteAtual();
  const hoje = new Date();
  const informado = (await searchParams).saldo;
  const valorInformado = informado ? lerValor(informado) : NaN;
  const desde = new Date(hoje.getTime() - 30 * DIA);

  const [estimado, abertas, contas, gasto30, fretes30] = await Promise.all([
    caixaEstimado(cliente.id),
    db.viagem.findMany({
      where: { caminhao: { clienteId: cliente.id }, recebido: false },
      select: { data: true, vencimento: true, freteUsd: true, recebido: true, recebimentos: { select: { valorUsd: true } } },
    }),
    db.contaPagar.findMany({ where: { clienteId: cliente.id, pagoEm: null }, select: { vencimento: true, valorUsd: true } }),
    db.despesa.aggregate({ where: { caminhao: { clienteId: cliente.id }, data: { gte: desde } }, _sum: { valorUsd: true } }),
    db.viagem.aggregate({ where: { caminhao: { clienteId: cliente.id }, data: { gte: desde } }, _sum: { freteUsd: true } }),
  ]);
  const saldoInicial = Number.isFinite(valorInformado) ? valorInformado : Math.round(estimado * 100) / 100;
  const despesaDiaria = (gasto30._sum.valorUsd ?? 0) / 30;
  const receitaDiaria = (fretes30._sum.freteUsd ?? 0) / 30;
  const f = projetarFluxo({
    saldoInicial,
    hoje,
    despesaDiaria,
    receitaDiaria,
    prazoRecebimentoDias: 30,
    entradas: abertas.map((v) => ({
      data: v.vencimento ?? new Date(v.data.getTime() + 30 * DIA),
      valor: saldoFrete({ freteUsd: v.freteUsd, recebido: v.recebido, recebidoUsd: v.recebimentos.reduce((t, r) => t + r.valorUsd, 0) }),
    })),
    saidas: contas.map((c) => ({ data: c.vencimento, valor: c.valorUsd })),
  });
  const maiorSaldo = Math.max(...f.semanas.map((s) => Math.abs(s.saldo)), 1);

  return (
    <>
      <div className="card-h">
        <h1>Fluxo de caixa · próximos 90 dias</h1>
        <form className="form" style={{ alignItems: "flex-end" }}>
          <label>Saldo em conta hoje (USD)
            <input name="saldo" inputMode="decimal" defaultValue={saldoInicial.toFixed(2).replace(".", ",")} style={{ width: "10em" }} />
          </label>
          <button type="submit">Recalcular</button>
        </form>
      </div>
      {!Number.isFinite(valorInformado) && (
        <p className="note">Saldo de partida estimado pela KM Cero (recebido − despesas − contas pagas). Para ficar exato, digite o saldo do banco e toque em Recalcular.</p>
      )}
      <div className="grid g4">
        <Kpi rotulo="Saldo hoje" valor={usd(saldoInicial)} sub={f.atrasado > 0 ? <>+ {usd(f.atrasado)} em fretes atrasados (<Link href="/receber">cobrar</Link>)</> : "nenhum frete atrasado"} />
        <Kpi rotulo="Em 30 dias" valor={usd(f.d30.saldo)} sub={`entra ${usd(f.d30.entradas)} · sai ${usd(f.d30.saidas)}`} />
        <Kpi rotulo="Em 60 dias" valor={usd(f.d60.saldo)} sub={`entra ${usd(f.d60.entradas)} · sai ${usd(f.d60.saidas)}`} />
        <Kpi rotulo="Em 90 dias" valor={usd(f.d90.saldo)} sub={`entra ${usd(f.d90.entradas)} · sai ${usd(f.d90.saidas)}`} />
      </div>
      {f.primeiroNegativo && (
        <div className="card fluxo-alerta">
          <b>Atenção: o caixa fica negativo a partir da semana de {dataBr(f.primeiroNegativo.inicio).slice(0, 5)}</b>
          <p>No pior momento, semana de {dataBr(f.menor.inicio).slice(0, 5)}, faltam {usd(-f.menor.saldo)}. Dá para antecipar cobranças em <Link href="/receber">Contas a receber</Link> ou renegociar vencimentos em <Link href="/pagar">Contas a pagar</Link>.</p>
        </div>
      )}
      <div className="card">
        <div className="card-h">
          <h2>Semana a semana</h2>
          <p>Entra: fretes já lançados, pelo vencimento, e fretes novos na média dos últimos 30 dias ({usd(receitaDiaria * 7)} por semana), recebidos 30 dias depois. Sai: contas a pagar e despesas da frota na média dos últimos 30 dias ({usd(despesaDiaria * 7)} por semana).</p>
        </div>
        <div className="tw">
          <table className="fluxo">
            <thead><tr><th>Semana</th><th className="n">Fretes lançados</th><th className="n">Fretes novos (estimado)</th><th className="n">Contas</th><th className="n">Despesas da frota</th><th className="n">Saldo</th><th /></tr></thead>
            <tbody>
              {f.semanas.map((s) => (
                <tr key={s.inicio.toISOString()}>
                  <td>{dataBr(s.inicio).slice(0, 5)} a {dataBr(s.fim).slice(0, 5)}</td>
                  <td className="n t-ok">{s.entradas ? usd(s.entradas) : "–"}</td>
                  <td className="n t-ok">{s.futuros ? usd(s.futuros) : "–"}</td>
                  <td className="n">{s.contas ? usd(s.contas) : "–"}</td>
                  <td className="n">{usd(s.despesas)}</td>
                  <td className={`n ${s.saldo < 0 ? "t-bad" : ""}`}><b>{usd(s.saldo)}</b></td>
                  <td className="fluxo-barra"><span className={s.saldo < 0 ? "neg" : ""} style={{ width: `${Math.round((Math.abs(s.saldo) / maiorSaldo) * 100)}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
