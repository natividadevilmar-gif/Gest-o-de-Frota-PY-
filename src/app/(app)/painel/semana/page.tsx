import Link from "next/link";
import { Kpi, Placa } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { diaNoParaguai } from "@/lib/rastreio/rotas";
import { resumirSemana, segundaDaSemana, semanaPassada, type LinhaCaminhao } from "@/lib/semana";
import { EnviarSemana } from "./Enviar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório da semana · KM Cero" };

const DIA = 86_400_000;
const FUSO_MS = 3 * 3600_000; // as datas da semana são do Paraguai (UTC−3)

export default async function RelatorioSemana({ searchParams }: { searchParams: Promise<{ inicio?: string }> }) {
  const { cliente } = await clienteAtual();
  const q = (await searchParams).inicio;
  const hoje = diaNoParaguai(new Date());
  const inicio = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? segundaDaSemana(new Date(`${q}T00:00:00Z`)) : semanaPassada(hoje).inicio;
  const fim = new Date(inicio.getTime() + 7 * DIA);
  const entre = { gte: inicio, lt: fim };
  const entreHora = { gte: new Date(inicio.getTime() + FUSO_MS), lt: new Date(fim.getTime() + FUSO_MS) };
  const doCliente = { caminhao: { clienteId: cliente.id } };

  const [caminhoes, tele, despesas, ocorr, fretes] = await Promise.all([
    db.caminhao.findMany({ where: { clienteId: cliente.id, baseCombustivel: false }, select: { id: true, placa: true, motorista: { select: { nome: true } } } }),
    db.telemetriaDia.groupBy({ by: ["caminhaoId"], where: { ...doCliente, data: entre }, _sum: { km: true, litrosCan: true, excessosVelocidade: true, frenagensBruscas: true }, _count: { litrosCan: true } }),
    db.despesa.groupBy({ by: ["caminhaoId", "categoria"], where: { ...doCliente, data: entre }, _sum: { valorUsd: true, litros: true } }),
    db.ocorrencia.groupBy({ by: ["tipo", "gravidade"], where: { clienteId: cliente.id, criadaEm: entreHora }, _count: { _all: true } }),
    db.viagem.aggregate({ where: { ...doCliente, data: entre }, _sum: { freteUsd: true }, _count: { _all: true } }),
  ]);

  const t = new Map(tele.map((x) => [x.caminhaoId, x]));
  const linhas: LinhaCaminhao[] = caminhoes.map((c) => {
    const x = t.get(c.id);
    return {
      id: c.id, placa: c.placa, motorista: c.motorista?.nome ?? null,
      km: x?._sum.km ?? 0,
      litrosCan: x && x._count.litrosCan > 0 ? x._sum.litrosCan : null,
      litrosAbastecidos: despesas.filter((d) => d.caminhaoId === c.id && d.categoria === "DIESEL").reduce((a, d) => a + (d._sum.litros ?? 0), 0),
      excessos: x?._sum.excessosVelocidade ?? 0,
      freadas: x?._sum.frenagensBruscas ?? 0,
    };
  });
  const r = resumirSemana(linhas);
  const gasto = (cat?: string) => despesas.filter((d) => !cat || d.categoria === cat).reduce((a, d) => a + (d._sum.valorUsd ?? 0), 0);
  const alertasAltos = ocorr.filter((o) => o.gravidade === "alta").reduce((a, o) => a + o._count._all, 0);
  const quedasDiesel = ocorr.filter((o) => o.tipo === "queda_diesel").reduce((a, o) => a + o._count._all, 0);
  const periodo = `${dataBr(inicio).slice(0, 5)} a ${dataBr(new Date(fim.getTime() - DIA)).slice(0, 5)}`;
  const anterior = new Date(inicio.getTime() - 7 * DIA).toISOString().slice(0, 10);
  const seguinte = fim.getTime() <= segundaDaSemana(hoje).getTime() ? fim.toISOString().slice(0, 10) : null;

  const es = cliente.idioma === "es";
  const texto = es
    ? [`📊 *${cliente.nome}* · semana del ${periodo}`, `🚛 ${num(r.km)} km recorridos (${r.rodaram} camiones)`, r.litros ? `⛽ ${num(r.litros)} L de gasoil · ${num(r.kmL, 2)} km/l` : null,
       `💵 Fletes: ${usd(fretes._sum.freteUsd ?? 0, 0)} (${fretes._count._all}) · Gastos: ${usd(gasto(), 0)}`, `⚠️ ${r.excessos} excesos de velocidad · ${alertasAltos} alertas graves`,
       quedasDiesel ? `🛢️ ${quedasDiesel} caída(s) de gasoil en el tanque` : null, r.melhor ? `🏆 Mejor conductor: ${r.melhor.motorista}` : null, r.pior ? `👀 Atención: ${r.pior.motorista}` : null]
    : [`📊 *${cliente.nome}* · semana de ${periodo}`, `🚛 ${num(r.km)} km rodados (${r.rodaram} caminhões)`, r.litros ? `⛽ ${num(r.litros)} L de diesel · ${num(r.kmL, 2)} km/l` : null,
       `💵 Fretes: ${usd(fretes._sum.freteUsd ?? 0, 0)} (${fretes._count._all}) · Despesas: ${usd(gasto(), 0)}`, `⚠️ ${r.excessos} excessos de velocidade · ${alertasAltos} alertas graves`,
       quedasDiesel ? `🛢️ ${quedasDiesel} queda(s) de diesel no tanque` : null, r.melhor ? `🏆 Melhor motorista: ${r.melhor.motorista}` : null, r.pior ? `👀 Atenção: ${r.pior.motorista}` : null];

  return (
    <>
      <div className="card-h">
        <h1>Relatório da semana · {periodo}</h1>
        <p className="nao-imprimir">
          <Link href={`/painel/semana?inicio=${anterior}`}>← semana anterior</Link>
          {seguinte && <> · <Link href={`/painel/semana?inicio=${seguinte}`}>semana seguinte →</Link></>}
        </p>
      </div>
      <EnviarSemana texto={texto.filter(Boolean).join("\n")} />
      <div className="grid g4">
        <Kpi rotulo="Km rodados" valor={num(r.km)} unidade="km" sub={`${r.rodaram} de ${caminhoes.length} caminhões rodaram`} />
        <Kpi rotulo="Diesel" valor={num(r.litros)} unidade="L" sub={r.kmL ? `${num(r.kmL, 2)} km/l na média` : "sem leitura de consumo"} />
        <Kpi rotulo="Fretes da semana" valor={usd(fretes._sum.freteUsd ?? 0, 0)} sub={`${fretes._count._all} fretes lançados`} />
        <Kpi rotulo="Despesas da semana" valor={usd(gasto(), 0)} sub={`diesel ${usd(gasto("DIESEL"), 0)} · pedágio ${usd(gasto("PEDAGIO"), 0)}`} />
      </div>
      <div className="grid g4">
        <Kpi rotulo="Excessos de velocidade" valor={String(r.excessos)} sub={`${r.freadas} freadas bruscas`} />
        <Kpi rotulo="Alertas graves" valor={String(alertasAltos)} sub={quedasDiesel ? `${quedasDiesel} queda(s) de diesel no tanque` : "na Central de monitoramento"} />
        <Kpi rotulo="Melhor motorista" valor={r.melhor?.motorista ?? "–"} sub={r.melhor ? `${num(r.melhor.excessos100, 1)} excessos/100 km${r.melhor.kmL ? ` · ${num(r.melhor.kmL, 2)} km/l` : ""}` : "precisa de 100 km na semana"} />
        <Kpi rotulo="Precisa de atenção" valor={r.pior?.motorista ?? "–"} sub={r.pior ? `${num(r.pior.excessos100, 1)} excessos/100 km${r.pior.kmL ? ` · ${num(r.pior.kmL, 2)} km/l` : ""}` : "–"} />
      </div>
      <div className="card">
        <div className="card-h"><h2>Por caminhão</h2><p>Km e eventos pela telemetria; diesel pela CAN ou, sem ela, pelos abastecimentos lançados</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th>Motorista</th><th className="n">Km</th><th className="n">Diesel (L)</th><th className="n">km/l</th><th className="n">Excessos</th><th className="n">Freadas</th></tr></thead>
            <tbody>
              {r.caminhoes.map((c) => (
                <tr key={c.id}>
                  <td><Placa placa={c.placa} /></td>
                  <td>{c.motorista ?? "–"}</td>
                  <td className="n">{num(c.km)}</td>
                  <td className="n">{num(c.litros)}</td>
                  <td className="n">{num(c.kmL, 2)}</td>
                  <td className="n">{c.excessos}</td>
                  <td className="n">{c.freadas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
