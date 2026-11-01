import Link from "next/link";
import { BarrasH, GraficoLinha, GraficoSemanas } from "@/components/Graficos";
import { Kpi } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { faixasReceber, inicioJanela, mediaMovel, PERIODOS, periodoValido, porDia, porSemana, somaPor } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { NOME_CATEGORIA } from "@/lib/indicadores";
import { NOME_OCORRENCIA } from "@/lib/monitoramento";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;
const usd0 = (n: number) => usd(n, 0);
const km0 = (n: number) => `${num(n)} km`;

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

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { cliente } = await clienteAtual();
  const dias = periodoValido((await searchParams).dias);
  const hoje = new Date();
  const inicio = inicioJanela(hoje, dias);
  const doCliente = { caminhao: { clienteId: cliente.id } };

  const [caminhoes, telemetria, despesas, fretes, abertos, contas, ocorrencias] = await Promise.all([
    db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true, consumoRefKmL: true, salarioMotorista: true, seguroMensal: true, depreciacaoMensal: true }, orderBy: { placa: "asc" } }),
    db.telemetriaDia.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { caminhaoId: true, data: true, km: true, litrosCan: true, excessosVelocidade: true, frenagensBruscas: true } }),
    db.despesa.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { caminhaoId: true, data: true, categoria: true, valorUsd: true } }),
    db.viagem.findMany({ where: { ...doCliente, data: { gte: inicio } }, select: { caminhaoId: true, data: true, freteUsd: true, custosExtrasUsd: true } }),
    db.viagem.findMany({ where: { ...doCliente, recebido: false }, select: { data: true, vencimento: true, freteUsd: true, recebimentos: { select: { valorUsd: true } } } }),
    db.contaPagar.findMany({ where: { clienteId: cliente.id, pagoEm: null }, select: { vencimento: true, valorUsd: true } }),
    db.ocorrencia.findMany({ where: { clienteId: cliente.id, criadaEm: { gte: inicio } }, select: { tipo: true } }),
  ]);

  const fracao = dias / 30;
  const fixos = caminhoes.reduce((t, c) => t + (c.salarioMotorista + c.seguroMensal + c.depreciacaoMensal) * fracao, 0);

  // Totais do período.
  const km = telemetria.reduce((t, x) => t + x.km, 0);
  const comCan = telemetria.filter((x) => x.litrosCan !== null);
  const litros = comCan.reduce((t, x) => t + (x.litrosCan ?? 0), 0);
  const kmL = litros > 0 ? comCan.reduce((t, x) => t + x.km, 0) / litros : null;
  const faturamento = fretes.reduce((t, x) => t + x.freteUsd, 0);
  const gasto = despesas.reduce((t, x) => t + x.valorUsd, 0) + fretes.reduce((t, x) => t + x.custosExtrasUsd, 0);
  const resultado = faturamento - gasto - fixos;
  const saldoAberto = abertos.map((v) => ({ vencimento: v.vencimento ?? new Date(v.data.getTime() + 30 * DIA), saldo: v.freteUsd - v.recebimentos.reduce((t, r) => t + r.valorUsd, 0) }));
  const receber = faixasReceber(saldoAberto, hoje);
  const pagar = faixasReceber(contas.map((c) => ({ vencimento: c.vencimento, saldo: c.valorUsd })), hoje);

  // Séries.
  const kmDia = porDia(telemetria.map((t) => ({ data: t.data, valor: t.km })), inicio, dias);
  const semanas = porSemana(fretes.map((f) => ({ data: f.data, valor: f.freteUsd })), [...despesas.map((d) => ({ data: d.data, valor: d.valorUsd })), ...fretes.map((f) => ({ data: f.data, valor: f.custosExtrasUsd }))], hoje, dias);
  const porTipo = somaPor(despesas, (d) => NOME_CATEGORIA[d.categoria] ?? d.categoria, (d) => d.valorUsd);

  const porCaminhao = caminhoes.map((c) => {
    const t = telemetria.filter((x) => x.caminhaoId === c.id);
    const can = t.filter((x) => x.litrosCan !== null);
    const l = can.reduce((s, x) => s + (x.litrosCan ?? 0), 0);
    const fr = fretes.filter((x) => x.caminhaoId === c.id);
    const fat = fr.reduce((s, x) => s + x.freteUsd, 0);
    const custo = despesas.filter((x) => x.caminhaoId === c.id).reduce((s, x) => s + x.valorUsd, 0) + fr.reduce((s, x) => s + x.custosExtrasUsd, 0) + (c.salarioMotorista + c.seguroMensal + c.depreciacaoMensal) * fracao;
    return {
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

  return (
    <>
      <div className="card-h">
        <h1>Dashboard</h1>
        <nav className="dash-periodo" aria-label="Período">
          {PERIODOS.map((p) => <Link key={p} href={`/dashboard?dias=${p}`} aria-current={p === dias ? "true" : undefined}>Últimos {p} dias</Link>)}
        </nav>
      </div>

      <div className="grid g4">
        <Kpi rotulo="Km rodado" valor={num(km)} unidade="km" sub={`${num(km / dias)} km por dia na frota`} />
        <Kpi rotulo="Faturamento" valor={usd0(faturamento)} sub={`${fretes.length} fretes no período`} />
        <Kpi rotulo="Resultado" valor={usd0(resultado)} sub={`despesas ${usd0(gasto)} + fixos ${usd0(fixos)}`} />
        <Kpi rotulo="Custo por km" valor={km > 0 ? usd((gasto + fixos) / km, 2) : "–"} sub={kmL ? `consumo médio ${num(kmL, 2)} km/l` : "sem leitura de consumo"} />
      </div>

      <div className="dash-grade">
        <Grafico titulo="Km rodado por dia" sub="Frota inteira; tracejado é a média de 7 dias" link={["/telemetria", "Telemetria"]}>
          <GraficoLinha pontos={kmDia} media={mediaMovel(kmDia)} fmt={km0} nome="Km rodado por dia" />
        </Grafico>
        <Grafico titulo="Fretes e despesas por semana" sub="Semanas que terminam hoje" link={["/resultado", "Resultado do mês"]}>
          <GraficoSemanas semanas={semanas.map((s) => ({ inicio: s.inicio, fim: s.fim, valores: [s.fretes, s.despesas] }))} series={["Fretes", "Despesas lançadas"]} fmt={usd0} />
        </Grafico>
        <Grafico titulo="Resultado por caminhão" sub="Fretes menos despesas e custos fixos do período" link={["/fretes", "Fretes e margem"]}>
          <BarrasH itens={ordena(porCaminhao, (c) => c.resultado).map((c) => ({ nome: c.placa, valor: Math.round(c.resultado), detalhe: `${c.fretes} fretes · ${usd0(c.fat)}` }))} fmt={usd0} />
        </Grafico>
        <Grafico titulo="Despesas por tipo" sub="Lançadas no período" link={["/custos", "Custo por km"]}>
          <BarrasH itens={porTipo.map((t) => ({ nome: t.nome.replace(/^Combustível: (.)/, (_, l: string) => l.toUpperCase()), valor: Math.round(t.valor), detalhe: gasto > 0 ? `${num((t.valor / gasto) * 100)}% do total` : undefined }))} fmt={usd0} vazio="Nenhuma despesa lançada no período." />
        </Grafico>
        <Grafico titulo="Consumo por caminhão" sub="km/l lido na rede CAN, comparado com a referência de cada caminhão" link={["/consumo", "Consumo e motoristas"]}>
          <BarrasH
            itens={ordena(porCaminhao.filter((c) => c.kmL !== null && c.ref > 0), (c) => (c.kmL ?? 0) / c.ref).map((c) => ({
              nome: c.placa,
              valor: Math.round(((c.kmL ?? 0) / c.ref - 1) * 1000) / 10,
              detalhe: `${num(c.kmL, 2)} km/l · ref. ${num(c.ref, 2)}`,
            }))}
            fmt={(n) => `${n > 0 ? "+" : ""}${num(n, 1)}%`}
            vazio="Nenhum caminhão com leitura de consumo no período."
          />
          <p className="note">À direita, rende mais que a referência; à esquerda (laranja), gasta mais diesel do que deveria.</p>
        </Grafico>
        <Grafico titulo="Km rodado por caminhão" sub={`Últimos ${dias} dias`}>
          <BarrasH itens={ordena(porCaminhao, (c) => c.km).map((c) => ({ nome: c.placa, valor: Math.round(c.km), detalhe: `${num(c.km / dias)} km/dia` }))} fmt={km0} />
        </Grafico>
        <Grafico titulo="Direção: excessos e freadas" sub="Eventos lidos pelo rastreador" link={["/consumo", "Ranking dos motoristas"]}>
          <BarrasH
            itens={ordena(porCaminhao.filter((c) => c.excessos + c.freadas > 0), (c) => c.excessos + c.freadas).map((c) => ({ nome: c.placa, valor: c.excessos + c.freadas, detalhe: `${c.excessos} excessos · ${c.freadas} freadas` }))}
            fmt={(n) => `${num(n)} eventos`}
            vazio="Nenhum excesso ou freada brusca no período."
          />
        </Grafico>
        <Grafico titulo="Alertas da Central" sub="Por tipo, no período" link={["/monitoramento", "Central de monitoramento"]}>
          <BarrasH largo itens={somaPor(ocorrencias, (o) => NOME_OCORRENCIA[o.tipo] ?? o.tipo, () => 1)} fmt={(n) => `${num(n)}`} vazio="Nenhum alerta no período." />
        </Grafico>
        <Grafico titulo="A receber por vencimento" sub={`Total ${usd0(receber.reduce((t, f) => t + f.valor, 0))}`} link={["/receber", "Contas a receber"]}>
          <BarrasH largo itens={receber.map((f) => ({ ...f, valor: Math.round(f.valor) }))} fmt={usd0} />
        </Grafico>
        <Grafico titulo="A pagar por vencimento" sub={`Total ${usd0(pagar.reduce((t, f) => t + f.valor, 0))}`} link={["/pagar", "Contas a pagar"]}>
          <BarrasH largo itens={pagar.map((f) => ({ ...f, valor: Math.round(f.valor) }))} fmt={usd0} />
        </Grafico>
      </div>
      <p className="note">Passe o mouse ou toque nos gráficos para ver os valores de cada dia, semana ou caminhão. O período conta até hoje, então não fica vazio no começo do mês.</p>
    </>
  );
}
