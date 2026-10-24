import Link from "next/link";
import { redirect } from "next/navigation";
import { Kpi, Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, taxa, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { caixasMotoristas } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { fecharCaixa } from "./actions";
import { CartoesMotoristas } from "./CartoesMotoristas";
import { FormCaixa } from "./FormCaixa";

export default async function Caixa() {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/despesas");
  const [caixas, motoristas, caminhoes, cot] = await Promise.all([
    caixasMotoristas(cliente.id),
    db.motorista.findMany({ where: { clienteId: cliente.id }, select: { id: true, nome: true, caminhoes: { select: { id: true }, take: 1 } }, orderBy: { nome: "asc" } }),
    db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true }, orderBy: { placa: "asc" } }),
    cotacaoDoDia(),
  ]);
  const abertos = caixas.filter((c) => c.aberto);
  const fechados = caixas.filter((c) => !c.aberto).slice(0, 30);
  // Saldo mostrado também na moeda em que o dinheiro foi entregue, pela cotação de hoje.
  const saldoNaMoeda = (c: (typeof caixas)[number]) =>
    c.moeda === "USD" ? null : `${SIMBOLO[c.moeda as Moeda]} ${num(c.valorOriginal - c.gastoMesmaMoeda - c.gastoOutrasUsd * (taxa(c.moeda as Moeda, cot) ?? 1), 2)}`;
  const cartoes = motoristas
    .map((m) => {
      const c = abertos.find((x) => x.motoristaId === m.id);
      const s = c ? saldoNaMoeda(c) ?? usd(c.saldoUsd) : "Sem caixa aberto";
      return {
        id: m.id,
        nome: m.nome,
        placa: c?.caminhao?.placa ?? null,
        saldo: s,
        saldoNegativo: (c?.saldoUsd ?? 0) < 0,
        detalhe: c ? `recebeu ${c.moeda === "USD" ? usd(c.valorUsd) : `${SIMBOLO[c.moeda as Moeda]} ${num(c.valorOriginal, 2)}`} em ${dataBr(c.data)} · ${c.nDespesas} despesas` : "toque para ver o histórico",
        aberto: Boolean(c),
      };
    })
    .sort((a, b) => Number(b.aberto) - Number(a.aberto) || a.nome.localeCompare(b.nome));
  const tot = abertos.reduce((a, c) => ({ e: a.e + c.valorUsd, g: a.g + c.gastoUsd }), { e: 0, g: 0 });

  const tabela = (lista: typeof caixas, comAcao: boolean) => (
    <div className="tw">
      <table>
        <thead><tr><th>Motorista</th><th>Entregue em</th><th className="n">Entregue</th><th className="n">Gasto</th><th className="n">Saldo com o motorista</th>{comAcao ? <th /> : <th>Fechado em</th>}</tr></thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/caixa/${c.motoristaId}`}><b>{c.motorista.nome}</b></Link>{c.caminhao && <> <Placa placa={c.caminhao.placa} /></>}{c.observacao && <><br /><small className="muted">{c.observacao}</small></>}</td>
              <td>{dataBr(c.data)}</td>
              <td className="n">{c.moeda === "USD" ? usd(c.valorUsd) : `${SIMBOLO[c.moeda as Moeda]} ${num(c.valorOriginal, 2)}`}<br /><small className="muted">{usd(c.valorUsd)}</small></td>
              <td className="n">{usd(c.gastoUsd)}<br /><small className="muted">{c.nDespesas} despesas</small></td>
              <td className="n"><span className={`pill ${c.saldoUsd < 0 ? "bad" : c.saldoUsd < c.valorUsd * 0.15 ? "warn" : "ok"}`}>{usd(c.saldoUsd)}</span>{saldoNaMoeda(c) && <><br /><small className="muted">≈ {saldoNaMoeda(c)}</small></>}</td>
              {comAcao ? (
                <td><form action={fecharCaixa}><input type="hidden" name="id" value={c.id} /><button type="submit" className="link">fechar (motorista prestou contas)</button></form></td>
              ) : <td>{c.fechadoEm ? dataBr(c.fechadoEm) : "novo caixa"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="card-h"><h1>Caixa dos motoristas</h1></div>
      <p className="note">Caixa inicial é o dinheiro entregue ao motorista quando ele sai em viagem. As despesas que ele lança pelo app saem desse dinheiro, e o saldo mostra quanto ainda está com ele.</p>
      <div className="grid g3">
        <Kpi rotulo="Entregue (caixas abertos)" valor={usd(tot.e)} sub={`${abertos.length} motoristas em viagem`} />
        <Kpi rotulo="Já gasto" valor={usd(tot.g)} sub="despesas lançadas desde a entrega" />
        <Kpi rotulo="Ainda com os motoristas" valor={usd(tot.e - tot.g)} sub="a prestar contas" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Saldo de cada motorista</h2><p>Toque no motorista para ver as despesas dele</p></div>
        <CartoesMotoristas cartoes={cartoes} />
      </div>
      <div className="card" id="novo">
        <div className="card-h"><h2>Entregar caixa inicial</h2></div>
        {motoristas.length === 0 ? <p className="note">Cadastre os motoristas primeiro.</p> : (
          <FormCaixa motoristas={motoristas.map((m) => ({ id: m.id, nome: m.nome, caminhaoId: m.caminhoes[0]?.id ?? null }))} caminhoes={caminhoes} hoje={new Date().toISOString().slice(0, 10)} />
        )}
      </div>
      <div className="card">
        <div className="card-h"><h2>Caixas abertos</h2><p>{abertos.length}</p></div>
        {abertos.length === 0 ? <p className="note">Nenhum motorista com caixa aberto.</p> : tabela(abertos, true)}
      </div>
      {fechados.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Caixas encerrados</h2><p>últimos {fechados.length}</p></div>
          {tabela(fechados, false)}
        </div>
      )}
    </>
  );
}
