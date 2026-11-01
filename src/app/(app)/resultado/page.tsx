import { Kpi, Placa, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { FIXOS, VARIAVEIS } from "@/lib/dre";
import { dreDoMes } from "@/lib/dreDados";
import { mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual } from "@/lib/indicadores";

export const dynamic = "force-dynamic";

const pct = (p: number | null) => (p === null ? "–" : `${num(p, 1)}%`);
const cor = (v: number) => (v < 0 ? "t-bad" : "t-ok");

export default async function Resultado({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const { linhas, total: t } = await dreDoMes(cliente.id, mes);
  const emAndamento = mes === mesAtual();

  const Linha = ({ rotulo, v, forte, menos }: { rotulo: string; v: number; forte?: boolean; menos?: boolean }) => (
    <tr className={forte ? "dre-forte" : undefined}>
      <td>{menos ? "(−) " : forte ? "= " : "(+) "}{rotulo}</td>
      <td className={`n ${forte ? cor(v) : ""}`}>{usd(menos && v ? -v : v)}</td>
      <td className="n muted">{t.receita > 0 ? `${num((v / t.receita) * 100, 1)}%` : "–"}</td>
    </tr>
  );

  return (
    <>
      <div className="card-h">
        <h1>Resultado do mês · {nomeMes(mes)}</h1>
        <div className="form" style={{ alignItems: "flex-end" }}>
          <SeletorMes mes={mes} caminho="/resultado" />
          {podeEditarCadastros(sessao) && <a className="btn" href={`/resultado/excel?mes=${mes}`}>Baixar Excel para o contador</a>}
        </div>
      </div>
      {emAndamento && <p className="note">Mês em andamento: os custos fixos entram proporcionais aos dias já passados.</p>}
      <div className="grid g4">
        <Kpi rotulo="Faturamento" valor={usd(t.receita)} sub={`${linhas.reduce((s, l) => s + l.fretes, 0)} fretes · ${num(t.km)} km`} />
        <Kpi rotulo="Margem de contribuição" valor={usd(t.contribuicao)} sub="faturamento − custos de viagem" />
        <Kpi rotulo="Resultado da frota" valor={usd(t.resultadoFrota)} sub="depois dos custos fixos" />
        <Kpi rotulo="Resultado líquido" valor={usd(t.liquido)} sub={`margem ${pct(t.margemPct)}`} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-h"><h2>Da empresa</h2><p>{cliente.nome}</p></div>
          <div className="tw">
            <table className="dre">
              <tbody>
                <Linha rotulo="Faturamento de fretes" v={t.receita} />
                {VARIAVEIS.map((k) => (t.variaveis[k] ? <Linha key={k} rotulo={k} v={t.variaveis[k]} menos /> : null))}
                {t.extras > 0 && <Linha rotulo="Aduana, despachante e extras dos fretes" v={t.extras} menos />}
                <Linha rotulo="Margem de contribuição" v={t.contribuicao} forte />
                {FIXOS.map((k) => (t.fixos[k] ? <Linha key={k} rotulo={k} v={t.fixos[k]} menos /> : null))}
                <Linha rotulo="Resultado da frota" v={t.resultadoFrota} forte />
                <Linha rotulo="Despesas da empresa (contas pagas sem caminhão)" v={t.administrativas} menos />
                <Linha rotulo="Resultado líquido" v={t.liquido} forte />
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Como ler</h2></div>
          <ul className="dre-ajuda">
            <li><b>Margem de contribuição</b>: o que sobra dos fretes depois do diesel, comida, pedágio, oficina e pneus. Se for baixa, o problema é o preço do frete ou o consumo.</li>
            <li><b>Resultado da frota</b>: depois de salário, seguro e depreciação dos caminhões.</li>
            <li><b>Resultado líquido</b>: depois das despesas da empresa lançadas em Contas a pagar (aluguel, impostos, escritório). Parcelas de financiamento não entram aqui, porque o caminhão já entra pela depreciação.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h2>Por caminhão</h2><p>do melhor para o pior resultado</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th className="n">Fretes</th><th className="n">Faturamento</th><th className="n">Custos de viagem</th><th className="n">Contribuição</th><th className="n">Custos fixos</th><th className="n">Resultado</th><th className="n">Margem</th><th className="n">Resultado/km</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td><Placa placa={l.placa} /></td>
                  <td className="n">{l.fretes}</td>
                  <td className="n">{usd(l.receita)}</td>
                  <td className="n">{usd(l.totalVariavel)}</td>
                  <td className={`n ${cor(l.contribuicao)}`}>{usd(l.contribuicao)}</td>
                  <td className="n">{usd(l.totalFixo)}</td>
                  <td className={`n ${cor(l.resultado)}`}><b>{usd(l.resultado)}</b></td>
                  <td className="n">{pct(l.margemPct)}</td>
                  <td className="n">{l.km > 0 ? usd(l.resultado / l.km, 2) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
