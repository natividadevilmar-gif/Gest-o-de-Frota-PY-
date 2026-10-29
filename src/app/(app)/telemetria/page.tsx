import { RolagemFixa } from "@/components/RolagemFixa";
import { Placa } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { dataBr, num } from "@/lib/formato";
import { MAX_DIAS_RELATORIO, relatorioDaFrota } from "@/lib/rastreio/relatorio";
import { diaNoParaguai } from "@/lib/rastreio/rotas";
import { apiDoCliente, telemetriaDaMensagem, type TelemetriaUnidade } from "@/lib/rastreio/wialon";
import { db } from "@/lib/db";

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

type Envio = { placa: string; ultima: Date | null; t: TelemetriaUnidade };

/** O que o rastreador de cada caminhão manda pelo Wialon agora (sem esperar mais de 8 s pelo Wialon). */
async function envioDosRastreadores(cliente: { id: string; nome: string; wialonToken: string | null; wialonHost: string | null }): Promise<Envio[] | null> {
  const api = apiDoCliente(cliente);
  if (!api) return null;
  try {
    const [unidades, caminhoes] = await Promise.race([
      Promise.all([api.unidades(), db.caminhao.findMany({ where: { clienteId: cliente.id, rastreadorId: { not: null } }, select: { placa: true, rastreadorId: true } })]),
      new Promise<never>((_, nao) => setTimeout(() => nao(new Error("demorou")), 8000)),
    ]);
    const porImei = new Map(caminhoes.map((c) => [c.rastreadorId!, c.placa]));
    return unidades
      .flatMap((u) => (u.uid && porImei.has(u.uid) ? [{ placa: porImei.get(u.uid)!, ultima: u.lmsg ? new Date(u.lmsg.t * 1000) : null, t: telemetriaDaMensagem(u.lmsg, u) }] : []))
      .sort((a, b) => a.placa.localeCompare(b.placa));
  } catch {
    return null;
  }
}

const sim = (v: boolean) => (v ? <span className="pill ok">sim</span> : <span className="muted">–</span>);

export default async function Telemetria({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const { cliente } = await clienteAtual();
  const q = await searchParams;
  const hoje = diaNoParaguai(new Date());
  const de = ehDia(q.de) ? new Date(`${q.de}T00:00:00Z`) : hoje;
  let ate = ehDia(q.ate) ? new Date(`${q.ate}T00:00:00Z`) : de;
  if (ate < de) ate = de;
  const cortado = ate.getTime() - de.getTime() >= MAX_DIAS_RELATORIO * 86_400_000;
  if (cortado) ate = new Date(de.getTime() + (MAX_DIAS_RELATORIO - 1) * 86_400_000);
  const [linhas, envio] = await Promise.all([relatorioDaFrota(cliente.id, de, ate), envioDosRastreadores(cliente)]);

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
          Diesel e tanque aparecem quando o rastreador manda a rede CAN ou o sensor de nível (boia) para o Wialon; sem isso ficam com “–”. Sem o total da CAN, o consumo é calculado pela queda do tanque, descontando abastecimentos.
          O tanque no fim maior que no início indica abastecimento no período.
        </p>
      </div>
      {envio && envio.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>O que cada rastreador envia</h2><p>Última mensagem de cada caminhão no Wialon</p></div>
          <div className="tw">
            <table>
              <thead><tr><th>Caminhão</th><th>Última mensagem</th><th>Odômetro</th><th>Diesel gasto (CAN)</th><th>Tanque</th><th>RPM</th><th>Ignição</th><th>Freadas e excessos</th></tr></thead>
              <tbody>
                {envio.map((e) => (
                  <tr key={e.placa}>
                    <td><Placa placa={e.placa} /></td>
                    <td>{e.ultima ? e.ultima.toLocaleString("pt-BR", { timeZone: "America/Asuncion" }) : "sem mensagens"}</td>
                    <td>{sim(e.t.odometro)}</td>
                    <td>{sim(e.t.diesel)}</td>
                    <td>{sim(e.t.tanque)}</td>
                    <td>{sim(e.t.rpm)}</td>
                    <td>{sim(e.t.ignicao)}</td>
                    <td>{sim(e.t.eventos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Sem “Diesel gasto (CAN)”, o consumo do relatório é calculado pela queda do tanque. Sem tanque nem CAN, o diesel fica com “–”.</p>
        </div>
      )}
    </>
  );
}

