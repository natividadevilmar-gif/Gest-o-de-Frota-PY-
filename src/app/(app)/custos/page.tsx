import Link from "next/link";
import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { indicadoresFrota, lancamentosMes, totaisFrota } from "@/lib/dados";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_FIXAS, mesAtual, NOME_CATEGORIA, planoPermite } from "@/lib/indicadores";
import { leitorConfigurado } from "@/lib/leitorDespesa";
import { excluirDespesa } from "./actions";
import { LancarDespesa } from "./LancarDespesa";

const COR: Record<string, string> = {
  Combustível: "var(--c-diesel)", Alimentação: "var(--c-alim)", Pedágio: "var(--c-pedagio)", Manutenção: "var(--c-manut)",
  Borracharia: "var(--c-pneus)", Outros: "var(--c-outros)", Motorista: "var(--c-motorista)", Seguro: "var(--c-seguro)", Depreciação: "var(--c-deprec)",
};
const COLUNAS = [...CATEGORIAS_DESPESA, ...CATEGORIAS_FIXAS];

export default async function Custos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "custos"));
  if (ind.length === 0) return <PlanoNecessario modulo="custos" titulo="Custo por km" />;
  const tot = totaisFrota(ind);
  const linhas = [...ind].sort((a, b) => (b.custoKm ?? 0) - (a.custoKm ?? 0));
  const max = Math.max(...linhas.map((i) => i.custoKm ?? 0), 0.01);
  const totalCat = (k: string) => ind.reduce((a, i) => a + (i.composicao[k] ?? 0), 0);
  const cotacao = await cotacaoDoDia();
  const lancamentos = await lancamentosMes(cliente.id, mes, new Set(ind.map((i) => i.id)));
  const pode = podeEditarCadastros(sessao);

  return (
    <>
      <div className="card-h">
        <h1>Custo por km · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/custos" />
      </div>

      <div className="card">
        <div className="card-h"><h2>Lançar despesa</h2><p>Tire foto do recibo, fale ou preencha. O custo por km recalcula na hora.</p></div>
        <LancarDespesa
          caminhoes={ind.map((i) => ({ id: i.id, placa: i.placa }))}
          hoje={new Date().toISOString().slice(0, 10)}
          cotacao={cotacao}
          idioma={cliente.idioma}
          leituraAtiva={leitorConfigurado()}
        />
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Relatório de gastos por tipo</h2>
          <Link className="btn" href={`/custos/relatorio?mes=${mes}`} prefetch={false}>Baixar planilha (CSV)</Link>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Caminhão</th>{COLUNAS.map((c) => <th key={c} className="n">{c}</th>)}<th className="n">Total</th><th className="n">km</th><th className="n">USD/km</th></tr>
            </thead>
            <tbody>
              {linhas.map((i) => (
                <tr key={i.id}>
                  <td><Placa placa={i.placa} /></td>
                  {COLUNAS.map((c) => <td key={c} className="n">{i.composicao[c] ? num(i.composicao[c]) : "–"}</td>)}
                  <td className="n"><b>{num(i.custoTotal)}</b></td>
                  <td className="n">{num(i.km)}</td>
                  <td className="n">{num(i.custoKm, 2)}</td>
                </tr>
              ))}
              <tr className="total">
                <td><b>Frota</b></td>
                {COLUNAS.map((c) => <td key={c} className="n"><b>{num(totalCat(c))}</b></td>)}
                <td className="n"><b>{num(tot.custo)}</b></td>
                <td className="n"><b>{num(tot.km)}</b></td>
                <td className="n"><b>{num(tot.custoKm, 2)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Valores em USD. Motorista, seguro e depreciação são os custos fixos do cadastro; no mês em andamento entram proporcionais aos dias já passados.</p>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Quanto custa cada km de cada caminhão</h2>
          <p>Média da frota <b>{usd(tot.custoKm, 2)}</b>/km</p>
        </div>
        <div className="formula">custo por km = (combustível + alimentação + pedágio + manutenção + borracharia + outros + motorista + seguro + depreciação) ÷ km rodado no GPS</div>
        <div className="legend">{Object.entries(COR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}</div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th style={{ width: "60%" }}>Composição</th><th className="n">USD/km</th></tr></thead>
            <tbody>
              {linhas.map((i) => (
                <tr key={i.id}>
                  <td><Placa placa={i.placa} /><br /><small className="muted">{i.modelo}</small></td>
                  <td>
                    <div className="bar" style={{ width: `${((i.custoKm ?? 0) / max) * 100}%` }} title={Object.entries(i.composicao).map(([k, v]) => `${k}: ${usd(v)}`).join(" · ")}>
                      {Object.entries(i.composicao).map(([k, v]) => <span key={k} style={{ width: `${(v / (i.custoTotal || 1)) * 100}%`, background: COR[k] }} />)}
                    </div>
                  </td>
                  <td className="n"><b className={i.custoKm && tot.custoKm && i.custoKm > tot.custoKm * 1.1 ? "t-bad" : ""}>{num(i.custoKm, 2)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Lançamentos do mês</h2><p>{lancamentos.length} despesas</p></div>
        {lancamentos.length === 0 ? (
          <p className="note">Nenhuma despesa lançada neste mês.</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Tipo</th><th>Detalhe</th><th className="n">Valor pago</th><th className="n">USD</th><th className="n">km/l (tanque cheio)</th><th>Recibo</th>{pode && <th />}</tr></thead>
              <tbody>
                {lancamentos.map((d) => (
                  <tr key={d.id}>
                    <td>{dataBr(d.data)}</td>
                    <td><Placa placa={d.placa} /></td>
                    <td>{NOME_CATEGORIA[d.categoria]}{d.origem !== "manual" && <> <span className="tag">{d.origem === "foto" ? "foto" : "áudio"}</span></>}</td>
                    <td>
                      {[d.litros ? `${num(d.litros, 1)} l` : null, d.precoLitro ? `${SIMBOLO[d.moeda as Moeda]} ${num(d.precoLitro, d.moeda === "PYG" ? 0 : 2)}/l` : null, d.posto, d.odometroKm ? `${num(d.odometroKm)} km` : null, d.descricao]
                        .filter(Boolean)
                        .join(" · ") || "–"}
                    </td>
                    <td className="n">{d.moeda === "USD" ? "–" : `${SIMBOLO[d.moeda as Moeda]} ${num(d.valorOriginal, d.moeda === "PYG" ? 0 : 2)}`}</td>
                    <td className="n">{num(d.valorUsd, 2)}</td>
                    <td className="n">{d.kmLTanque ? num(d.kmLTanque, 2) : "–"}</td>
                    <td>{d.temRecibo ? <a href={`/recibos/${d.id}`} target="_blank" rel="noopener">ver</a> : "–"}</td>
                    {pode && (
                      <td>
                        <form action={excluirDespesa}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="mini" aria-label={`Excluir despesa de ${dataBr(d.data)} em ${d.placa}`}>Excluir</button>
                        </form>
                      </td>
                    )}
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
