import Link from "next/link";
import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota, totaisFrota } from "@/lib/dados";
import { mesValido, nomeMes, num, usd } from "@/lib/formato";
import { CATEGORIAS_DESPESA, CATEGORIAS_FIXAS, mesAtual, planoPermite } from "@/lib/indicadores";

const COR: Record<string, string> = {
  Combustível: "var(--c-diesel)", Alimentação: "var(--c-alim)", Pedágio: "var(--c-pedagio)", Manutenção: "var(--c-manut)",
  Borracharia: "var(--c-pneus)", Outros: "var(--c-outros)", Motorista: "var(--c-motorista)", Seguro: "var(--c-seguro)", Depreciação: "var(--c-deprec)",
};
const COLUNAS = [...CATEGORIAS_DESPESA, ...CATEGORIAS_FIXAS];

export default async function Custos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "custos"));
  if (ind.length === 0) return <PlanoNecessario modulo="custos" titulo="Custo por km" />;
  const tot = totaisFrota(ind);
  const linhas = [...ind].sort((a, b) => (b.custoKm ?? 0) - (a.custoKm ?? 0));
  const max = Math.max(...linhas.map((i) => i.custoKm ?? 0), 0.01);
  const totalCat = (k: string) => ind.reduce((a, i) => a + (i.composicao[k] ?? 0), 0);

  return (
    <>
      <div className="card-h">
        <h1>Custo por km · {nomeMes(mes)}</h1>
        <div className="form" style={{ alignItems: "center" }}>
          <Link className="btn pri" href="/despesas">+ Lançar despesa</Link>
          <SeletorMes mes={mes} caminho="/custos" />
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Relatório de gastos por tipo</h2>
          <Link className="btn" href={`/custos/relatorio?mes=${mes}`} prefetch={false}>Gerar relatório (Excel)</Link>
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
                  {COLUNAS.map((c) => <td key={c} className="n">{i.composicao[c] ? num(i.composicao[c], 2) : "–"}</td>)}
                  <td className="n"><b>{num(i.custoTotal, 2)}</b></td>
                  <td className="n">{num(i.km)}</td>
                  <td className="n">{num(i.custoKm, 2)}</td>
                </tr>
              ))}
              <tr className="total">
                <td><b>Frota</b></td>
                {COLUNAS.map((c) => <td key={c} className="n"><b>{num(totalCat(c), 2)}</b></td>)}
                <td className="n"><b>{num(tot.custo, 2)}</b></td>
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

    </>
  );
}
