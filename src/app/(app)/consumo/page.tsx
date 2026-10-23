import { Kpi, Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota } from "@/lib/dados";
import { mesValido, nomeMes, num, usd } from "@/lib/formato";
import { LIMITE_DESVIO_PCT, mesAtual, planoPermite } from "@/lib/indicadores";

const DIESEL_USD_L = 0.98;

export default async function Consumo({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "consumo") && i.litrosCan !== null);
  if (ind.length === 0) return <PlanoNecessario modulo="consumo" titulo="Consumo e motoristas" />;
  const linhas = [...ind].sort((a, b) => (a.vsReferenciaPct ?? 0) - (b.vsReferenciaPct ?? 0));
  const excedente = ind.reduce((a, i) => a + i.litrosExcedentes, 0);
  const semExplicacao = ind.filter((i) => i.suspeitaDesvio).reduce((a, i) => a + (i.litrosAbastecidos - (i.litrosCan ?? 0)), 0);
  const marchaLenta = ind.reduce((a, i) => a + i.marchaLentaPct, 0) / ind.length;

  return (
    <>
      <div className="card-h">
        <h1>Consumo e motoristas · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/consumo" />
      </div>
      <div className="grid g3">
        <Kpi rotulo="Diesel acima da referência" valor={num(excedente)} unidade="litros" sub={`cerca de ${usd(excedente * DIESEL_USD_L)} no mês`} />
        <Kpi rotulo="Litros sem explicação" valor={num(semExplicacao)} unidade="litros" sub={`abastecido além do medido pela CAN, acima de ${LIMITE_DESVIO_PCT}%`} />
        <Kpi rotulo="Marcha lenta da frota" valor={num(marchaLenta, 1)} unidade="% do tempo" sub="meta sugerida: abaixo de 8%" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Ranking de motoristas</h2><p>Consumo real na rede CAN comparado com a referência do modelo</p></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Motorista</th><th>Caminhão</th><th className="n">km/l</th><th className="n">contra a referência</th><th className="n">Marcha lenta</th><th className="n">Excesso de velocidade</th><th className="n">Frenagens bruscas</th><th className="n">RPM alto</th><th className="n">Abastecido × CAN</th></tr>
            </thead>
            <tbody>
              {linhas.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.motorista ?? "Sem motorista"}</b></td>
                  <td><Placa placa={i.placa} /><br /><small className="muted">{i.modelo} · ref. {num(i.consumoRefKmL, 1)}</small></td>
                  <td className="n"><b>{num(i.kmL, 2)}</b></td>
                  <td className={`n ${(i.vsReferenciaPct ?? 0) < 0 ? "t-bad" : "t-ok"}`}>{(i.vsReferenciaPct ?? 0) > 0 ? "+" : ""}{num(i.vsReferenciaPct, 1)}%</td>
                  <td className={`n ${i.marchaLentaPct > 10 ? "t-bad" : ""}`}>{num(i.marchaLentaPct, 1)}%</td>
                  <td className="n">{i.excessosVelocidade}</td>
                  <td className="n">{i.frenagensBruscas}</td>
                  <td className="n">{num(i.rpmAltoPct, 1)}%</td>
                  <td className="n">{i.suspeitaDesvio ? <span className="pill bad">+{num(i.desvioPct, 1)}% desvio?</span> : <span className="muted">{num(i.desvioPct, 1)}%</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="formula">km/l = km rodado ÷ litros consumidos (CAN) · alerta de desvio quando (abastecido − consumido) ÷ consumido &gt; {LIMITE_DESVIO_PCT}%</div>
        <p className="note">Caminhões do plano Básico não leem a CAN e ficam fora deste ranking.</p>
      </div>
    </>
  );
}
