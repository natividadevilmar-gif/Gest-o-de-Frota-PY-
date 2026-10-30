import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota, viagensCliente } from "@/lib/dados";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual, planoPermite } from "@/lib/indicadores";
import { db } from "@/lib/db";
import { taxasDoDia } from "@/lib/pedagioDados";
import Link from "next/link";
import { Simulador } from "./Formularios";

/** Sem abastecimento lançado, o simulador parte deste preço de diesel (USD por litro). */
const DIESEL_PADRAO = 1;

export default async function Viagens({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "viagens"));
  if (ind.length === 0) return <PlanoNecessario modulo="viagens" titulo="Margem por viagem" />;
  const viagens = (await viagensCliente(cliente.id, mes, ind)).filter((v) => ind.some((i) => i.id === v.caminhaoId));
  const [cams, rotas, pracas, taxas, abastecimentos] = await Promise.all([
    db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, eixos: true } }),
    db.rotaFrete.findMany({ where: { clienteId: cliente.id }, orderBy: [{ origem: "asc" }, { destino: "asc" }] }),
    db.pracaPedagio.findMany({ select: { id: true, pais: true, rodovia: true, nome: true, moeda: true, tarifaEixo: true, tarifaFixa: true } }),
    taxasDoDia(),
    db.despesa.findMany({ where: { caminhao: { clienteId: cliente.id }, categoria: "DIESEL", litros: { gt: 0 } }, select: { valorUsd: true, litros: true }, orderBy: { data: "desc" }, take: 20 }),
  ]);
  const eixos = new Map(cams.map((c) => [c.id, c.eixos]));
  // Preço médio dos últimos abastecimentos lançados.
  const litros = abastecimentos.reduce((a, d) => a + (d.litros ?? 0), 0);
  const precoDiesel = litros > 0 ? abastecimentos.reduce((a, d) => a + d.valorUsd, 0) / litros : DIESEL_PADRAO;
  const caminhoes = ind.map((i) => {
    const semDiesel = i.custoTotal - (i.composicao["Combustível"] ?? 0);
    return { id: i.id, placa: i.placa, eixos: eixos.get(i.id) ?? 6, kmL: i.kmL ?? (i.consumoRefKmL || null), outrosKm: i.km > 0 && semDiesel > 0 ? semDiesel / i.km : null };
  });

  return (
    <>
      <div className="card-h">
        <h1>Margem por viagem · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/viagens" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Viagens do mês</h2><p>Frete menos custo por km × distância, contando o retorno vazio</p></div>
        {viagens.length === 0 ? (
          <p className="note">Nenhuma viagem registrada neste mês.</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Rota</th><th>Carga</th><th className="n">Frete</th><th className="n">km ida + volta</th><th className="n">Custo</th><th className="n">Margem</th></tr></thead>
              <tbody>
                {viagens.map((v) => {
                  const p = v.margem?.margemPct ?? null;
                  return (
                    <tr key={v.id}>
                      <td>{dataBr(v.data)}</td>
                      <td><Placa placa={v.caminhao.placa} /></td>
                      <td>{v.origem} → {v.destino}</td>
                      <td>{v.carga}, {num(v.toneladas)} t</td>
                      <td className="n">{usd(v.freteUsd)}</td>
                      <td className="n">{num(v.kmCarregado)} + {num(v.kmVazio)}</td>
                      <td className="n">{usd(v.margem?.custoUsd)}</td>
                      <td className="n">
                        {v.margem ? <span className={`pill ${p! < 5 ? "bad" : p! < 15 ? "warn" : "ok"}`}>{usd(v.margem.margemUsd)} · {num(p, 0)}%</span> : "sem km no mês"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-h"><h2>Simular um frete antes de aceitar</h2><p>Rota, praças de pedágio do caminho, diesel e volta vazio; consumo e custos do caminhão neste mês</p></div>
        <Simulador caminhoes={caminhoes} rotas={rotas} pracas={pracas} taxas={taxas} precoDiesel={precoDiesel} paisCliente={cliente.pais} />
      </div>
      <p className="note">Para lançar um frete com cliente, rota, produto e recebimento, use <Link href="/fretes#novo">Fretes e margem</Link>.</p>
    </>
  );
}
