import { RolagemFixa } from "@/components/RolagemFixa";
import { Placa } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { dataBr, num } from "@/lib/formato";
import { MAX_DIAS_RELATORIO, relatorioDaFrota } from "@/lib/rastreio/relatorio";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ehDia = (s: string | undefined): s is string => !!s && DIA.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

/** Segundos em h:mm:ss, como no Wialon. */
function horas(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}
/** Hora no Paraguai; num período de vários dias, com a data junto. */
const saidaBr = (d: Date, comData: boolean) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", ...(comData ? { day: "2-digit", month: "2-digit" } : {}) });
const litros = (l: number | null) => (l == null ? "–" : `${num(l, 1)} l`);

export default async function Telemetria({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { cliente } = await clienteAtual();
  const q = await searchParams;
  const hoje = diaNoParaguai(new Date());
  const de = ehDia(q.de) ? new Date(`${q.de}T00:00:00Z`) : hoje;
  let ate = ehDia(q.ate) ? new Date(`${q.ate}T00:00:00Z`) : de;
  if (ate < de) ate = de;
  const cortado = ate.getTime() - de.getTime() >= MAX_DIAS_RELATORIO * 86_400_000;
  if (cortado) ate = new Date(de.getTime() + (MAX_DIAS_RELATORIO - 1) * 86_400_000);
  const linhas = await relatorioDaFrota(cliente.id, de, ate);

  // Total da frota: soma dos km, horas e diesel; médias pesadas pelo total.
  const com = linhas.flatMap((l) => (l.relatorio ? [l.relatorio] : []));
  const soma = (f: (r: (typeof com)[number]) => number | null) => {
    const v = com.map(f).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  };
  const kmT = soma((r) => r.km) ?? 0;
  const viagemT = soma((r) => r.litrosViagem);
  const kmComDiesel = soma((r) => (r.litrosViagem != null ? r.km : null));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <div className="card-h">
        <h1>Telemetria · {iso(de) === iso(ate) ? dataBr(de) : `${dataBr(de)} a ${dataBr(ate)}`}</h1>
        <form className="form" action="/telemetria">
          <label htmlFor="de">De<input id="de" name="de" type="date" defaultValue={iso(de)} max={iso(hoje)} /></label>
          <label htmlFor="ate">Até<input id="ate" name="ate" type="date" defaultValue={iso(ate)} max={iso(hoje)} /></label>
          <button type="submit">Ver</button>
        </form>
      </div>
      {cortado && <p className="note">O relatório mostra no máximo {MAX_DIAS_RELATORIO} dias de cada vez.</p>}
      <div className="card">
        <div className="card-h"><h2>Relatório de viagens</h2><p>Os mesmos campos do relatório do Wialon, calculados com as posições e a rede CAN de cada caminhão</p></div>
        <RolagemFixa>
          <table className="tabela-telemetria">
            <thead>
              <tr>
                <th>Caminhão</th><th className="n">Primeiro sinal</th><th className="n">Saída</th><th className="n">Km rodados</th><th className="n">Consumido em viagem</th><th className="n">Km/l médio</th><th className="n">L/100 km médio</th>
                <th className="n">Tanque no início</th><th className="n">Tanque no fim</th><th className="n">Horas de motor</th><th className="n">Odômetro final</th>
                <th className="n">Velocidade média</th><th className="n">Velocidade máxima</th><th className="n">Consumo parado ou muito devagar</th><th className="n">Total consumido</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ id, placa, modelo, motorista, demo, relatorio: r }) => (
                <tr key={id}>
                  <td><Placa placa={placa} /><br /><small className="muted">{modelo}{motorista ? ` · ${motorista}` : ""}{demo ? " · demonstração" : ""}</small></td>
                  {r ? (
                    <>
                      <td className="n">{saidaBr(r.primeiroSinal, iso(de) !== iso(ate))}</td>
                      <td className="n">{r.saida ? saidaBr(r.saida, iso(de) !== iso(ate)) : "–"}</td>
                      <td className="n"><b>{num(r.km)} km</b></td>
                      <td className="n">{litros(r.litrosViagem)}</td>
                      <td className="n"><b>{num(r.kmL, 2)}</b></td>
                      <td className="n">{num(r.l100km)}</td>
                      <td className="n">{litros(r.nivelInicialL)}</td>
                      <td className="n">{litros(r.nivelFinalL)}</td>
                      <td className="n">{horas(r.horasMotorS)}</td>
                      <td className="n">{r.odometroFinalKm != null ? `${num(r.odometroFinalKm)} km` : "–"}</td>
                      <td className="n">{num(r.velocidadeMedia)} km/h</td>
                      <td className={`n ${r.velocidadeMax > 80 ? "t-bad" : ""}`}>{num(r.velocidadeMax)} km/h</td>
                      <td className="n">{litros(r.litrosParado)}</td>
                      <td className="n">{litros(r.litrosTotal)}</td>
                    </>
                  ) : (
                    <td colSpan={14} className="muted">Nenhuma posição neste período.</td>
                  )}
                </tr>
              ))}
            </tbody>
            {com.length > 1 && (
              <tfoot>
                <tr>
                  <th>Frota</th>
                  <th className="n">–</th>
                  <th className="n">–</th>
                  <th className="n">{num(kmT)} km</th>
                  <th className="n">{litros(viagemT)}</th>
                  <th className="n">{viagemT && kmComDiesel ? num(kmComDiesel / viagemT, 2) : "–"}</th>
                  <th className="n">{viagemT && kmComDiesel ? num((viagemT / kmComDiesel) * 100) : "–"}</th>
                  <th className="n">{litros(soma((r) => r.nivelInicialL))}</th>
                  <th className="n">{litros(soma((r) => r.nivelFinalL))}</th>
                  <th className="n">{horas(soma((r) => r.horasMotorS) ?? 0)}</th>
                  <th className="n">–</th>
                  <th className="n">–</th>
                  <th className="n">{num(Math.max(...com.map((r) => r.velocidadeMax)))} km/h</th>
                  <th className="n">{litros(soma((r) => r.litrosParado))}</th>
                  <th className="n">{litros(soma((r) => r.litrosTotal))}</th>
                </tr>
              </tfoot>
            )}
          </table>
        </RolagemFixa>
        <div className="formula">
          Km/l = km rodados ÷ consumido em viagem · consumo parado = diesel gasto com o caminhão abaixo de 5 km/h · velocidade média = km ÷ tempo andando
        </div>
        <p className="note">
          Diesel e tanque aparecem quando o rastreador manda a rede CAN (ou o sensor de nível) para o Wialon; sem isso ficam com “–”.
          O tanque no fim maior que no início indica abastecimento no período.
        </p>
      </div>
    </>
  );
}

