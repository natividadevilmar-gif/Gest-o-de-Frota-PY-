import Link from "next/link";
import { FiltroLinks } from "@/components/FiltroLinks";
import { BarrasH, GraficoLinha, GraficoSemanas } from "@/components/Graficos";
import { Kpi } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { FAIXAS, faixaDe, faixasReceber, inicioJanela, kmPorLitroDia, mediaMovel, mesDosLinks, PERIODOS, periodoValido, porDia, porSemana, somaPor } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { NOME_CATEGORIA } from "@/lib/indicadores";
import { NOME_OCORRENCIA } from "@/lib/monitoramento";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;
const usd0 = (n: number) => usd(n, 0);
const km0 = (n: number) => `${num(n)} km`;
const nomeTipo = (c: string) => (NOME_CATEGORIA[c] ?? c).replace(/^Combustível: (.)/, (_, l: string) => l.toUpperCase());

type Filtros = { dias: number; caminhao?: string; tipo?: string; receber?: string; pagar?: string; alerta?: string };

/** Link do dashboard com os filtros atuais trocados; o detalhe aberto (tipo, contas, alerta) é um só por vez. */
function url(f: Filtros, troca: Partial<Filtros>, detalhe = false): string {
  const base = detalhe ? { dias: f.dias, caminhao: f.caminhao } : f;
  const p = { ...base, ...troca };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "" && !(k === "dias" && v === 30)) q.set(k, String(v));
  const s = q.toString();
  return `/dashboard${s ? `?${s}` : ""}${detalhe && Object.values(troca).some(Boolean) ? "#detalhe" : ""}`;
}

function Grafico({ titulo, sub, link, children }: { titulo: string; sub?: string; link?: [string, string]; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-h">
        <h2>{titulo}</h2>
        <p>{sub}{link && <>{sub ? " · " : ""}<Link href={link[0]}>{link[1]}</Link></>}</p>
      </div>
      {children}
    </div>
  );
}

function Detalhe({ titulo, fechar, link, children }: { titulo: string; fechar: string; link?: [string, string]; children: React.ReactNode }) {
  return (
    <div className="card dash-detalhe" id="detalhe">
      <div className="card-h">
        <h2>{titulo}</h2>
        <div className="form" style={{ alignItems: "center" }}>
          {link && <Link className="btn" href={link[0]}>{link[1]}</Link>}
          <Link className="btn" href={fechar}>✕ Fechar</Link>
        </div>
      </div>
      {children}
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ dias?: string; caminhao?: string; tipo?: string; receber?: string; pagar?: string; alerta?: string }> }) {
  const { cliente } = await clienteAtual();
  const sp = await searchParams;
  const dias = periodoValido(sp.dias);
  const hoje = new Date();
  const mesLink = mesDosLinks(hoje);
  const inicio = inicioJanela(hoje, dias);

  const caminhoes = await db.caminhao.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, placa: true, modelo: true, consumoRefKmL: true, salarioMotorista: true, seguroMensal: true, depreciacaoMensal: true, motorista: { select: { nome: true } } },
    orderBy: { placa: "asc" },
  });
  const cam = caminhoes.find((c) => c.id === sp.caminhao);
  const f: Filtros = { dias, caminhao: cam?.id, tipo: sp.tipo, receber: sp.receber, pagar: sp.pagar, alerta: sp.alerta };
  const doCliente = cam ? { caminhaoId: cam.id } : { caminhao: { clienteId: cliente.id } };
  const daFrota = cam ? [cam] : caminhoes;

  const [telemetria, despesas, fretes, abertos, contas, ocorrencias] = await Promise.all([
    db.telemetriaDia.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { caminhaoId: true, data: true, km: true, litrosCan: true, excessosVelocidade: true, frenagensBruscas: true } }),
    db.despesa.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { caminhaoId: true, data: true, categoria: true, valorUsd: true, descricao: true, posto: true, litros: true }, orderBy: { data: "desc" } }),
    db.viagem.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { id: true, caminhaoId: true, data: true, origem: true, destino: true, embarcador: true, freteUsd: true, custosExtrasUsd: true }, orderBy: { data: "desc" } }),
    db.viagem.findMany({ where: { ...doCliente, recebido: false }, select: { id: true, caminhaoId: true, data: true, vencimento: true, origem: true, destino: true, embarcador: true, documento: true, freteUsd: true, recebimentos: { select: { valorUsd: true } } } }),
    db.contaPagar.findMany({ where: { clienteId: cliente.id, pagoEm: null, ...(cam ? { caminhaoId: cam.id } : {}) }, select: { caminhaoId: true, vencimento: true, valorUsd: true, descricao: true, fornecedor: true, parcela: true, parcelas: true }, orderBy: { vencimento: "asc" } }),
    db.ocorrencia.findMany({ where: { clienteId: cliente.id, criadaEm: { gte: inicio }, ...(cam ? { caminhaoId: cam.id } : {}) }, select: { caminhaoId: true, tipo: true, titulo: true, detalhe: true, criadaEm: true }, orderBy: { criadaEm: "desc" } }),
  ]);

  const placa = (id: string | null) => caminhoes.find((c) => c.id === id)?.placa ?? "–";
  const fracao = dias / 30;
  const fixos = daFrota.reduce((t, c) => t + (c.salarioMotorista + c.seguroMensal + c.depreciacaoMensal) * fracao, 0);

  // Totais do período.
  const km = telemetria.reduce((t, x) => t + x.km, 0);
  const comCan = telemetria.filter((x) => x.litrosCan !== null);
  const litros = comCan.reduce((t, x) => t + (x.litrosCan ?? 0), 0);
  const kmL = litros > 0 ? comCan.reduce((t, x) => t + x.km, 0) / litros : null;
  const faturamento = fretes.reduce((t, x) => t + x.freteUsd, 0);
  const gasto = despesas.reduce((t, x) => t + x.valorUsd, 0) + fretes.reduce((t, x) => t + x.custosExtrasUsd, 0);
  const resultado = faturamento - gasto - fixos;
  const aReceber = abertos
    .map((v) => ({ ...v, venc: v.vencimento ?? new Date(v.data.getTime() + 30 * DIA), saldo: Math.round((v.freteUsd - v.recebimentos.reduce((t, r) => t + r.valorUsd, 0)) * 100) / 100 }))
    .filter((v) => v.saldo > 0)
    .sort((a, b) => +a.venc - +b.venc);
  const receber = faixasReceber(aReceber.map((v) => ({ vencimento: v.venc, saldo: v.saldo })), hoje);
  const pagar = faixasReceber(contas.map((c) => ({ vencimento: c.vencimento, saldo: c.valorUsd })), hoje);

  // Séries.
  const kmDia = porDia(telemetria.map((t) => ({ data: t.data, valor: t.km })), inicio, dias);
  const semanas = porSemana(fretes.map((x) => ({ data: x.data, valor: x.freteUsd })), [...despesas.map((d) => ({ data: d.data, valor: d.valorUsd })), ...fretes.map((x) => ({ data: x.data, valor: x.custosExtrasUsd }))], hoje, dias);
  const porTipo = somaPor(despesas, (d) => d.categoria, (d) => d.valorUsd);

  const porCaminhao = daFrota.map((c) => {
    const t = telemetria.filter((x) => x.caminhaoId === c.id);
    const can = t.filter((x) => x.litrosCan !== null);
    const l = can.reduce((s, x) => s + (x.litrosCan ?? 0), 0);
    const fr = fretes.filter((x) => x.caminhaoId === c.id);
    const fat = fr.reduce((s, x) => s + x.freteUsd, 0);
    const custo = despesas.filter((x) => x.caminhaoId === c.id).reduce((s, x) => s + x.valorUsd, 0) + fr.reduce((s, x) => s + x.custosExtrasUsd, 0) + (c.salarioMotorista + c.seguroMensal + c.depreciacaoMensal) * fracao;
    return {
      id: c.id,
      placa: c.placa,
      km: t.reduce((s, x) => s + x.km, 0),
      kmL: l > 0 ? can.reduce((s, x) => s + x.km, 0) / l : null,
      ref: c.consumoRefKmL,
      excessos: t.reduce((s, x) => s + x.excessosVelocidade, 0),
      freadas: t.reduce((s, x) => s + x.frenagensBruscas, 0),
      fat,
      resultado: fat - custo,
      fretes: fr.length,
    };
  });
  const ordena = <T,>(xs: T[], v: (x: T) => number) => [...xs].sort((a, b) => v(b) - v(a));
  const doCaminhao = (id: string) => url(f, { caminhao: id, tipo: undefined, receber: undefined, pagar: undefined, alerta: undefined });

  // Detalhe aberto: um tipo de despesa, uma faixa de contas ou um tipo de alerta.
  const faixaReceber = f.receber !== undefined ? Number(f.receber) : NaN;
  const faixaPagar = f.pagar !== undefined ? Number(f.pagar) : NaN;
  const fechar = url(f, {}, true);
  let detalhe: React.ReactNode = null;
  if (f.tipo) {
    const lista = despesas.filter((d) => d.categoria === f.tipo);
    const sem = porSemana([], lista.map((d) => ({ data: d.data, valor: d.valorUsd })), hoje, dias);
    detalhe = (
      <Detalhe titulo={`${nomeTipo(f.tipo)}: ${usd0(lista.reduce((t, d) => t + d.valorUsd, 0))} em ${lista.length} lançamentos`} fechar={fechar} link={["/despesas", "Lançar despesa"]}>
        <div className="dash-grade">
          <div><p className="note">Por semana</p><GraficoSemanas semanas={sem.map((s) => ({ inicio: s.inicio, fim: s.fim, valores: [s.despesas] }))} series={[nomeTipo(f.tipo)]} fmt={usd0} /></div>
          {!cam && <div><p className="note">Por caminhão (toque para abrir o caminhão)</p><BarrasH itens={somaPor(lista, (d) => d.caminhaoId, (d) => d.valorUsd).map((x) => ({ nome: placa(x.nome), valor: Math.round(x.valor), href: url(f, { caminhao: x.nome }) + "#detalhe" }))} fmt={usd0} /></div>}
        </div>
        <div className="tw"><table>
          <thead><tr><th>Data</th><th>Caminhão</th><th>Detalhe</th><th className="n">Valor</th></tr></thead>
          <tbody>{lista.slice(0, 40).map((d, i) => <tr key={i}><td>{dataBr(d.data)}</td><td>{placa(d.caminhaoId)}</td><td>{[d.posto, d.descricao, d.litros ? `${num(d.litros)} l` : null].filter(Boolean).join(" · ") || "–"}</td><td className="n">{usd(d.valorUsd)}</td></tr>)}</tbody>
        </table></div>
        {lista.length > 40 && <p className="note">Mostrando os 40 mais recentes.</p>}
      </Detalhe>
    );
  } else if (faixaReceber >= 0 && faixaReceber <= 3) {
    const lista = aReceber.filter((v) => faixaDe(v.venc, hoje) === faixaReceber);
    detalhe = (
      <Detalhe titulo={`A receber · ${FAIXAS[faixaReceber]}: ${usd0(lista.reduce((t, v) => t + v.saldo, 0))}`} fechar={fechar} link={["/receber", "Cobrar em Contas a receber"]}>
        <div className="tw"><table>
          <thead><tr><th>Vencimento</th><th>Cliente</th><th>Frete</th><th>Caminhão</th><th className="n">Falta receber</th></tr></thead>
          <tbody>{lista.map((v) => <tr key={v.id}><td>{dataBr(v.venc)}</td><td>{v.embarcador ?? "–"}</td><td>{v.documento ? `${v.documento} · ` : ""}{v.origem} → {v.destino}<br /><small className="muted">{dataBr(v.data)}</small></td><td>{placa(v.caminhaoId)}</td><td className="n">{usd(v.saldo)}</td></tr>)}</tbody>
        </table></div>
        {lista.length === 0 && <p className="note">Nada nesta faixa.</p>}
      </Detalhe>
    );
  } else if (faixaPagar >= 0 && faixaPagar <= 3) {
    const lista = contas.filter((c) => faixaDe(c.vencimento, hoje) === faixaPagar);
    detalhe = (
      <Detalhe titulo={`A pagar · ${FAIXAS[faixaPagar]}: ${usd0(lista.reduce((t, c) => t + c.valorUsd, 0))}`} fechar={fechar} link={["/pagar", "Pagar em Contas a pagar"]}>
        <div className="tw"><table>
          <thead><tr><th>Vencimento</th><th>Conta</th><th>Fornecedor</th><th>Caminhão</th><th className="n">Valor</th></tr></thead>
          <tbody>{lista.map((c, i) => <tr key={i}><td>{dataBr(c.vencimento)}</td><td>{c.descricao}{c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ""}</td><td>{c.fornecedor ?? "–"}</td><td>{c.caminhaoId ? placa(c.caminhaoId) : "Empresa"}</td><td className="n">{usd(c.valorUsd)}</td></tr>)}</tbody>
        </table></div>
        {lista.length === 0 && <p className="note">Nada nesta faixa.</p>}
      </Detalhe>
    );
  } else if (f.alerta) {
    const lista = ocorrencias.filter((o) => o.tipo === f.alerta);
    detalhe = (
      <Detalhe titulo={`${NOME_OCORRENCIA[f.alerta] ?? f.alerta}: ${lista.length} alertas`} fechar={fechar} link={["/monitoramento", "Abrir a Central"]}>
        <div className="tw"><table>
          <thead><tr><th>Quando</th><th>Caminhão</th><th>Alerta</th></tr></thead>
          <tbody>{lista.slice(0, 50).map((o, i) => <tr key={i}><td>{dataBr(o.criadaEm)} {o.criadaEm.toISOString().slice(11, 16)}</td><td>{placa(o.caminhaoId)}</td><td><b>{o.titulo}</b><br /><small className="muted">{o.detalhe}</small></td></tr>)}</tbody>
        </table></div>
      </Detalhe>
    );
  }

  const consumoDia = kmPorLitroDia(telemetria.map((t) => ({ data: t.data, km: t.km, litros: t.litrosCan })), inicio, dias);
  const eventosDia = porDia(telemetria.map((t) => ({ data: t.data, valor: t.excessosVelocidade + t.frenagensBruscas })), inicio, dias);

  return (
    <>
      <div className="card-h">
        <h1>Dashboard{cam ? ` · ${cam.placa}` : ""}</h1>
        <div className="dash-filtros">
          <FiltroLinks rotulo="Período" opcoes={PERIODOS.map((p) => ({ nome: `Últimos ${p} dias`, href: url(f, { dias: p }), atual: p === dias }))} />
          <FiltroLinks
            rotulo="Caminhão"
            opcoes={[
              { nome: "Frota inteira", href: url(f, { caminhao: undefined, tipo: undefined, receber: undefined, pagar: undefined, alerta: undefined }), atual: !cam },
              ...caminhoes.map((c) => ({ nome: c.placa, href: doCaminhao(c.id), atual: c.id === cam?.id })),
            ]}
          />
        </div>
      </div>
      {cam && <p className="note">{cam.modelo}{cam.motorista ? ` · motorista ${cam.motorista.nome}` : ""}. Todos os gráficos abaixo são só deste caminhão.</p>}

      <div className="grid g4">
        <Kpi rotulo="Km rodado" valor={num(km)} unidade="km" sub={`${num(km / dias)} km por dia${cam ? "" : " na frota"}`} />
        <Kpi rotulo="Faturamento" valor={usd0(faturamento)} sub={`${fretes.length} fretes no período`} />
        <Kpi rotulo="Resultado" valor={usd0(resultado)} sub={`despesas ${usd0(gasto)} + fixos ${usd0(fixos)}`} />
        <Kpi rotulo="Custo por km" valor={km > 0 ? usd((gasto + fixos) / km, 2) : "–"} sub={kmL ? `consumo médio ${num(kmL, 2)} km/l` : "sem leitura de consumo"} />
      </div>

      {detalhe}

      <div className="dash-grade">
        <Grafico titulo="Km rodado por dia" sub={`${cam ? cam.placa : "Frota inteira"}; tracejado é a média de 7 dias`} link={["/telemetria", "Telemetria"]}>
          <GraficoLinha pontos={kmDia} media={mediaMovel(kmDia)} fmt={km0} nome="Km rodado por dia" />
        </Grafico>
        <Grafico titulo="Fretes e despesas por semana" sub="Semanas que terminam hoje" link={[`/resultado?mes=${mesLink}`, "Resultado do mês"]}>
          <GraficoSemanas semanas={semanas.map((s) => ({ inicio: s.inicio, fim: s.fim, valores: [s.fretes, s.despesas] }))} series={["Fretes", "Despesas lançadas"]} fmt={usd0} />
        </Grafico>

        {cam ? (
          <>
            <Grafico titulo="Consumo por dia" sub={`km/l lido na rede CAN · referência ${num(cam.consumoRefKmL, 2)} km/l`} link={[`/consumo?mes=${mesLink}`, "Consumo e motoristas"]}>
              {consumoDia.some((p) => p.valor > 0) ? <GraficoLinha pontos={consumoDia} fmt={(n) => `${num(n, 2)} km/l`} nome="Consumo por dia" /> : <p className="note">Sem leitura de consumo no período.</p>}
            </Grafico>
            <Grafico titulo="Excessos e freadas por dia" sub="Eventos lidos pelo rastreador" link={[`/consumo?mes=${mesLink}`, "Ranking dos motoristas"]}>
              <GraficoLinha pontos={eventosDia} fmt={(n) => `${num(n)} eventos`} nome="Excessos e freadas por dia" />
            </Grafico>
            <Grafico titulo="Fretes do período" sub={`${fretes.length} fretes · ${usd0(faturamento)}`} link={[`/fretes?mes=${mesLink}`, "Fretes e margem"]}>
              {fretes.length === 0 ? <p className="note">Nenhum frete no período.</p> : (
                <div className="tw"><table>
                  <thead><tr><th>Data</th><th>Rota</th><th>Cliente</th><th className="n">Frete</th></tr></thead>
                  <tbody>{fretes.slice(0, 12).map((x) => <tr key={x.id}><td>{dataBr(x.data)}</td><td>{x.origem} → {x.destino}</td><td>{x.embarcador ?? "–"}</td><td className="n">{usd0(x.freteUsd)}</td></tr>)}</tbody>
                </table></div>
              )}
            </Grafico>
          </>
        ) : (
          <>
            <Grafico titulo="Resultado por caminhão" sub="Fretes menos despesas e custos fixos · toque para abrir o caminhão" link={[`/fretes?mes=${mesLink}`, "Fretes e margem"]}>
              <BarrasH itens={ordena(porCaminhao, (c) => c.resultado).map((c) => ({ nome: c.placa, valor: Math.round(c.resultado), detalhe: `${c.fretes} fretes · ${usd0(c.fat)}`, href: doCaminhao(c.id) }))} fmt={usd0} />
            </Grafico>
            <Grafico titulo="Consumo por caminhão" sub="km/l comparado com a referência de cada caminhão" link={[`/consumo?mes=${mesLink}`, "Consumo e motoristas"]}>
              <BarrasH
                itens={ordena(porCaminhao.filter((c) => c.kmL !== null && c.ref > 0), (c) => (c.kmL ?? 0) / c.ref).map((c) => ({
                  nome: c.placa,
                  valor: Math.round(((c.kmL ?? 0) / c.ref - 1) * 1000) / 10,
                  detalhe: `${num(c.kmL, 2)} km/l · ref. ${num(c.ref, 2)}`,
                  href: doCaminhao(c.id),
                }))}
                fmt={(n) => `${n > 0 ? "+" : ""}${num(n, 1)}%`}
                vazio="Nenhum caminhão com leitura de consumo no período."
              />
              <p className="note">À direita, rende mais que a referência; à esquerda (laranja), gasta mais diesel do que deveria.</p>
            </Grafico>
            <Grafico titulo="Km rodado por caminhão" sub={`Últimos ${dias} dias · toque para abrir o caminhão`}>
              <BarrasH itens={ordena(porCaminhao, (c) => c.km).map((c) => ({ nome: c.placa, valor: Math.round(c.km), detalhe: `${num(c.km / dias)} km/dia`, href: doCaminhao(c.id) }))} fmt={km0} />
            </Grafico>
            <Grafico titulo="Direção: excessos e freadas" sub="Eventos lidos pelo rastreador" link={[`/consumo?mes=${mesLink}`, "Ranking dos motoristas"]}>
              <BarrasH
                itens={ordena(porCaminhao.filter((c) => c.excessos + c.freadas > 0), (c) => c.excessos + c.freadas).map((c) => ({ nome: c.placa, valor: c.excessos + c.freadas, detalhe: `${c.excessos} excessos · ${c.freadas} freadas`, href: doCaminhao(c.id) }))}
                fmt={(n) => `${num(n)} eventos`}
                vazio="Nenhum excesso ou freada brusca no período."
              />
            </Grafico>
          </>
        )}

        <Grafico titulo="Despesas por tipo" sub="Lançadas no período · toque para ver os lançamentos" link={[`/custos?mes=${mesLink}`, "Custo por km"]}>
          <BarrasH
            itens={porTipo.map((t) => ({ nome: nomeTipo(t.nome), valor: Math.round(t.valor), detalhe: gasto > 0 ? `${num((t.valor / gasto) * 100)}% do total` : undefined, href: url(f, { tipo: t.nome }, true), ativo: f.tipo === t.nome }))}
            fmt={usd0}
            vazio="Nenhuma despesa lançada no período."
          />
        </Grafico>
        <Grafico titulo="Alertas da Central" sub="Por tipo, no período · toque para ver" link={["/monitoramento", "Central de monitoramento"]}>
          <BarrasH largo itens={somaPor(ocorrencias, (o) => o.tipo, () => 1).map((o) => ({ nome: NOME_OCORRENCIA[o.nome] ?? o.nome, valor: o.valor, href: url(f, { alerta: o.nome }, true), ativo: f.alerta === o.nome }))} fmt={(n) => `${num(n)}`} vazio="Nenhum alerta no período." />
        </Grafico>
        <Grafico titulo="A receber por vencimento" sub={`Total ${usd0(receber.reduce((t, x) => t + x.valor, 0))} · toque para ver os fretes`} link={["/receber", "Contas a receber"]}>
          <BarrasH largo itens={receber.map((x, k) => ({ nome: x.nome, valor: Math.round(x.valor), detalhe: x.qtd ? `${x.qtd} fretes` : undefined, href: x.qtd ? url(f, { receber: String(k) }, true) : undefined, ativo: faixaReceber === k }))} fmt={usd0} />
        </Grafico>
        <Grafico titulo="A pagar por vencimento" sub={`Total ${usd0(pagar.reduce((t, x) => t + x.valor, 0))} · toque para ver as contas`} link={["/pagar", "Contas a pagar"]}>
          <BarrasH largo itens={pagar.map((x, k) => ({ nome: x.nome, valor: Math.round(x.valor), detalhe: x.qtd ? `${x.qtd} contas` : undefined, href: x.qtd ? url(f, { pagar: String(k) }, true) : undefined, ativo: faixaPagar === k }))} fmt={usd0} />
        </Grafico>
      </div>
      <p className="note">Toque num caminhão para ver o dashboard só dele; toque num tipo de despesa, alerta ou faixa de vencimento para ver a lista. Passe o mouse nos gráficos para ver os valores de cada dia ou semana.</p>
    </>
  );
}
