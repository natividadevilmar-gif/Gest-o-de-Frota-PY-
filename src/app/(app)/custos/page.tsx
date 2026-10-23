import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota, totaisFrota } from "@/lib/dados";
import { mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual, planoPermite } from "@/lib/indicadores";
import { LancarDespesa } from "./LancarDespesa";

const COR: Record<string, string> = {
  Diesel: "var(--c-diesel)", Pneus: "var(--c-pneus)", Manutenção: "var(--c-manut)", Pedágio: "var(--c-pedagio)",
  Outros: "var(--c-outros)", Motorista: "var(--c-motorista)", Seguro: "var(--c-seguro)", Depreciação: "var(--c-deprec)",
};

export default async function Custos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "custos"));
  if (ind.length === 0) return <PlanoNecessario modulo="custos" titulo="Custo por km" />;
  const tot = totaisFrota(ind);
  const linhas = [...ind].sort((a, b) => (b.custoKm ?? 0) - (a.custoKm ?? 0));
  const max = Math.max(...linhas.map((i) => i.custoKm ?? 0), 0.01);

  return (
    <>
      <div className="card-h">
        <h1>Custo por km · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/custos" />
      </div>
      <div className="card">
        <div className="card-h">
          <h2>Quanto custa cada km de cada caminhão</h2>
          <p>Média da frota <b>{usd(tot.custoKm, 2)}</b>/km</p>
        </div>
        <div className="formula">custo por km = (diesel + pneus + manutenção + pedágio + outros + motorista + seguro + depreciação) ÷ km rodado no GPS</div>
        <div className="legend">{Object.entries(COR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}</div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th style={{ width: "46%" }}>Composição</th><th className="n">Custo do mês</th><th className="n">km</th><th className="n">USD/km</th></tr></thead>
            <tbody>
              {linhas.map((i) => (
                <tr key={i.id}>
                  <td><Placa placa={i.placa} /><br /><small className="muted">{i.modelo}</small></td>
                  <td>
                    <div className="bar" style={{ width: `${((i.custoKm ?? 0) / max) * 100}%` }} title={Object.entries(i.composicao).map(([k, v]) => `${k}: ${usd(v)}`).join(" · ")}>
                      {Object.entries(i.composicao).map(([k, v]) => <span key={k} style={{ width: `${(v / (i.custoTotal || 1)) * 100}%`, background: COR[k] }} />)}
                    </div>
                  </td>
                  <td className="n">{usd(i.custoTotal)}</td>
                  <td className="n">{num(i.km)}</td>
                  <td className="n"><b className={i.custoKm && tot.custoKm && i.custoKm > tot.custoKm * 1.1 ? "t-bad" : ""}>{num(i.custoKm, 2)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">A barra mostra o custo por km; as cores mostram de onde ele vem. Custos fixos (motorista, seguro, depreciação) entram pelo valor mensal; no mês em andamento, proporcionais aos dias já passados.</p>
      </div>
      <div className="card">
        <div className="card-h"><h2>Lançar despesa</h2><p>O que o rastreador não mede. O custo por km recalcula na hora.</p></div>
        <LancarDespesa caminhoes={ind.map((i) => ({ id: i.id, placa: i.placa }))} hoje={new Date().toISOString().slice(0, 10)} />
      </div>
    </>
  );
}
