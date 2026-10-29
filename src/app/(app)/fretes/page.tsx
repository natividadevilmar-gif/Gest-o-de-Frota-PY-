import Link from "next/link";
import { redirect } from "next/navigation";
import { Kpi, Placa, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { indicadoresFrota, viagensCliente } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual } from "@/lib/indicadores";
import { previstoRota } from "@/lib/pedagio";
import { rotasPedagio, taxasDoDia } from "@/lib/pedagioDados";
import { marcarRecebido, recalcularRota } from "./actions";
import { ExcluirFrete } from "./Excluir";
import { NovoFrete, PAISES } from "./NovoFrete";

const corMargem = (p: number | null) => (p === null ? "" : p < 5 ? "bad" : p < 15 ? "warn" : "ok");

export default async function Fretes({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/despesas");
  const mes = mesValido((await searchParams).mes, mesAtual());
  const [ind, motoristas, cotacao, rotas, taxas] = await Promise.all([
    indicadoresFrota(cliente.id, mes),
    db.motorista.findMany({ where: { clienteId: cliente.id }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    cotacaoDoDia(),
    rotasPedagio(),
    taxasDoDia(),
  ]);
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, motoristaId: true, eixos: true }, orderBy: { placa: "asc" } });
  const motDe = new Map(caminhoes.map((c) => [c.id, c.motoristaId]));
  const eixosDe = new Map(caminhoes.map((c) => [c.id, c.eixos]));
  const fretes = await viagensCliente(cliente.id, mes, ind);

  // Pedágio previsto da rota escolhida contra o pedágio lançado pelo motorista entre o carregamento e a entrega.
  const rotaDe = new Map(rotas.map((r) => [r.id, r]));
  const comRota = fretes.filter((f) => f.rotaPedagioId && rotaDe.has(f.rotaPedagioId));
  const pedagiosLancados = comRota.length
    ? await db.despesa.findMany({
        where: { categoria: "PEDAGIO", caminhaoId: { in: comRota.map((f) => f.caminhaoId) }, data: { gte: new Date(Math.min(...comRota.map((f) => f.data.getTime()))) } },
        select: { caminhaoId: true, data: true, valorUsd: true },
      })
    : [];
  const pedagio = new Map(
    comRota.map((f) => {
      const ate = (f.dataEntrega ?? new Date(f.data.getTime() + 3 * 86_400_000)).getTime();
      const lancado = pedagiosLancados.filter((d) => d.caminhaoId === f.caminhaoId && d.data.getTime() >= f.data.getTime() && d.data.getTime() <= ate).reduce((a, d) => a + d.valorUsd, 0);
      const r = rotaDe.get(f.rotaPedagioId!)!;
      return [f.id, { previsto: previstoRota(r.pracas, f.caminhao.eixos, taxas).usd, lancado }];
    }),
  );

  // Margem por caminhão: soma dos fretes do mês menos o custo das viagens.
  const porCaminhao = ind
    .map((i) => {
      const fs = fretes.filter((f) => f.caminhaoId === i.id);
      const frete = fs.reduce((a, f) => a + f.freteUsd, 0);
      const custo = fs.reduce((a, f) => a + (f.margem?.custoUsd ?? 0), 0);
      const semCusto = fs.some((f) => !f.margem);
      return { i, n: fs.length, frete, custo, ton: fs.reduce((a, f) => a + f.toneladas, 0), km: fs.reduce((a, f) => a + f.kmCarregado + f.kmVazio, 0), margem: frete - custo, semCusto };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.margem - a.margem);
  const tot = porCaminhao.reduce((a, x) => ({ frete: a.frete + x.frete, custo: a.custo + x.custo }), { frete: 0, custo: 0 });
  const aReceber = fretes.filter((f) => !f.recebido).reduce((a, f) => a + f.freteUsd, 0);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="card-h">
        <h1>Fretes · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/fretes" />
      </div>
      <div className="grid g4">
        <Kpi rotulo="Faturamento de fretes" valor={usd(tot.frete)} sub={`${fretes.length} fretes`} />
        <Kpi rotulo="Custo das viagens" valor={usd(tot.custo)} sub="custo por km × km, mais custos extras" />
        <Kpi rotulo="Margem" valor={usd(tot.frete - tot.custo)} sub={tot.frete ? `${num(((tot.frete - tot.custo) / tot.frete) * 100, 0)}% do frete` : undefined} />
        <Kpi rotulo="A receber" valor={usd(aReceber)} sub={`${fretes.filter((f) => !f.recebido).length} fretes em aberto`} />
      </div>

      <div className="card" id="novo">
        <div className="card-h"><h2>Lançar frete</h2><p>A margem aparece enquanto você preenche</p></div>
        <NovoFrete
          caminhoes={ind.map((i) => ({ id: i.id, placa: i.placa, custoKm: i.custoKm, motoristaId: motDe.get(i.id) ?? null, eixos: eixosDe.get(i.id) ?? 6 }))}
          rotas={rotas}
          taxas={taxas}
          motoristas={motoristas}
          cotacao={cotacao}
          hoje={hoje}
          paisCliente={cliente.pais}
        />
      </div>

      <div className="card">
        <div className="card-h"><h2>Margem por caminhão</h2><p>Fretes de {nomeMes(mes)}</p></div>
        {porCaminhao.length === 0 ? <p className="note">Nenhum frete lançado neste mês.</p> : (
          <div className="tw">
            <table>
              <thead><tr><th>Caminhão</th><th className="n">Fretes</th><th className="n">Toneladas</th><th className="n">km</th><th className="n">Faturamento</th><th className="n">Custo</th><th className="n">Margem</th><th className="n">USD/km</th></tr></thead>
              <tbody>
                {porCaminhao.map((x) => {
                  const pct = x.frete ? (x.margem / x.frete) * 100 : null;
                  return (
                    <tr key={x.i.id}>
                      <td><Placa placa={x.i.placa} /> <small className="muted">{x.i.modelo}</small></td>
                      <td className="n">{x.n}</td>
                      <td className="n">{num(x.ton, 1)}</td>
                      <td className="n">{num(x.km)}</td>
                      <td className="n">{usd(x.frete)}</td>
                      <td className="n">{x.semCusto ? "sem custo/km" : usd(x.custo)}</td>
                      <td className="n">{x.semCusto ? "–" : <span className={`pill ${corMargem(pct)}`}>{usd(x.margem)} · {num(pct, 0)}%</span>}</td>
                      <td className="n">{x.km ? num(x.margem / x.km, 2) : "–"}</td>
                    </tr>
                  );
                })}
                <tr className="total"><td><b>Frota</b></td><td className="n">{fretes.length}</td><td /><td /><td className="n"><b>{usd(tot.frete)}</b></td><td className="n">{usd(tot.custo)}</td><td className="n"><b>{usd(tot.frete - tot.custo)}</b></td><td /></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h2>Fretes do mês</h2><p><Link href={`/viagens?mes=${mes}`}>Simular um frete antes de aceitar</Link></p></div>
        {fretes.length === 0 ? <p className="note">Nenhum frete lançado neste mês.</p> : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Cliente</th><th>Rota</th><th>Carga</th><th className="n">Frete</th><th className="n">Custo</th><th className="n">Margem</th><th>Pagamento</th><th /></tr></thead>
              <tbody>
                {fretes.map((f) => {
                  const p = f.margem?.margemPct ?? null;
                  const pais = (k: string) => PAISES[k]?.split(" ")[0] ?? k;
                  return (
                    <tr key={f.id}>
                      <td>{dataBr(f.data)}{f.dataEntrega && <><br /><small className="muted">entrega {dataBr(f.dataEntrega)}</small></>}</td>
                      <td><Placa placa={f.caminhao.placa} />{f.motorista && <><br /><small className="muted">{f.motorista.nome}</small></>}</td>
                      <td>{f.embarcador ?? "–"}{f.documento && <><br /><small className="muted">{f.documento}</small></>}</td>
                      <td>{pais(f.paisOrigem)} {f.origem} → {pais(f.paisDestino)} {f.destino}<br /><small className="muted">{num(f.kmCarregado)} km + {num(f.kmVazio)} vazio</small><br />{f.rotaKm != null ? <small className="muted">rota prevista {num(f.rotaKm)} km · alerta de desvio ligado</small> : f.rotaErro ? <form action={recalcularRota} style={{ display: "inline" }}><input type="hidden" name="id" value={f.id} /><small className="t-bad">sem rota: {f.rotaErro}</small> <button type="submit" className="link">tentar de novo</button></form> : <small className="muted">calculando a rota…</small>}{pedagio.has(f.id) && (() => { const pg = pedagio.get(f.id)!; return <><br /><small className={pg.lancado > pg.previsto * 1.1 ? "t-bad" : "muted"}>pedágio previsto {usd(pg.previsto, 2)} · lançado {usd(pg.lancado, 2)}</small></>; })()}</td>
                      <td>{f.carga}, {num(f.toneladas, 1)} t{f.precoTonelada && <><br /><small className="muted">{SIMBOLO[f.moeda as Moeda]} {num(f.precoTonelada, 2)}/t</small></>}</td>
                      <td className="n">{usd(f.freteUsd)}{f.valorOriginal && <><br /><small className="muted">{SIMBOLO[f.moeda as Moeda]} {num(f.valorOriginal, 2)}</small></>}</td>
                      <td className="n">{usd(f.margem?.custoUsd)}{f.custosExtrasUsd > 0 && <><br /><small className="muted">+{usd(f.custosExtrasUsd)} extras</small></>}</td>
                      <td className="n">{f.margem ? <span className={`pill ${corMargem(p)}`}>{usd(f.margem.margemUsd)} · {num(p, 0)}%</span> : "sem custo/km"}</td>
                      <td>
                        <form action={marcarRecebido}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="recebido" value={f.recebido ? "0" : "1"} />
                          {f.recebido ? <span className="pill ok">recebido</span> : <span className="pill warn">a receber{f.vencimento ? ` · ${dataBr(f.vencimento)}` : ""}</span>}{" "}
                          <button type="submit" className="link">{f.recebido ? "desfazer" : "marcar recebido"}</button>
                        </form>
                      </td>
                      <td>
                        <ExcluirFrete id={f.id} rota={`${f.origem} → ${f.destino}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
