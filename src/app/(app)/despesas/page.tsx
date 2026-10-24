import Link from "next/link";
import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { lancamentosMes } from "@/lib/dados";
import { dataBr, mesValido, nomeMes, num } from "@/lib/formato";
import { mesAtual, NOME_CATEGORIA, planoPermite } from "@/lib/indicadores";
import { leitorConfigurado } from "@/lib/leitorDespesa";
import { excluirDespesa } from "../custos/actions";
import { LancarDespesa } from "../custos/LancarDespesa";

export default async function Despesas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const caminhoes = (await db.caminhao.findMany({ where: { clienteId: cliente.id }, orderBy: { placa: "asc" }, select: { id: true, placa: true, plano: true } }))
    .filter((c) => planoPermite(c.plano, "custos"));
  if (caminhoes.length === 0) return <PlanoNecessario modulo="custos" titulo="Lançar despesas" />;
  const cotacao = await cotacaoDoDia();
  const lancamentos = await lancamentosMes(cliente.id, mes, new Set(caminhoes.map((c) => c.id)));
  const pode = podeEditarCadastros(sessao);

  return (
    <>
      <div className="card-h">
        <h1>Lançar despesa</h1>
        <Link className="btn" href={`/custos?mes=${mes}`}>Ver relatório de custos</Link>
      </div>

      <div className="card">
        <div className="card-h"><h2>Nova despesa</h2><p>Tire foto do recibo, fale ou preencha. O custo por km recalcula na hora.</p></div>
        <LancarDespesa
          caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa }))}
          hoje={new Date().toISOString().slice(0, 10)}
          cotacao={cotacao}
          idioma={cliente.idioma}
          leituraAtiva={leitorConfigurado()}
        />
      </div>

      <div className="card">
        <div className="card-h"><h2>Lançamentos · {nomeMes(mes)}</h2><div className="form" style={{ alignItems: "center" }}><p>{lancamentos.length} despesas</p><SeletorMes mes={mes} caminho="/despesas" /></div></div>
        {lancamentos.length === 0 ? (
          <p className="note">Nenhuma despesa lançada neste mês.</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Tipo</th><th>Detalhe</th><th className="n">Valor pago</th><th className="n">USD</th><th className="n">km/l (tanque cheio)</th><th>Recibo</th>{pode && <th />}</tr></thead>
              <tbody>
                {lancamentos.map((d) => (
                  <tr key={d.id}>
                    <td>{dataBr(d.data)}</td>
                    <td><Placa placa={d.placa} /></td>
                    <td>{NOME_CATEGORIA[d.categoria]}{d.origem !== "manual" && <> <span className="tag">{d.origem === "foto" ? "foto" : "áudio"}</span></>}</td>
                    <td>
                      {[d.litros ? `${num(d.litros, 1)} l` : null, d.precoLitro ? `${SIMBOLO[d.moeda as Moeda]} ${num(d.precoLitro, d.moeda === "PYG" ? 0 : 2)}/l` : null, d.posto, d.odometroKm ? `${num(d.odometroKm)} km` : null, d.descricao]
                        .filter(Boolean)
                        .join(" · ") || "–"}
                    </td>
                    <td className="n">{d.moeda === "USD" ? "–" : `${SIMBOLO[d.moeda as Moeda]} ${num(d.valorOriginal, d.moeda === "PYG" ? 0 : 2)}`}</td>
                    <td className="n">{num(d.valorUsd, 2)}</td>
                    <td className="n">{d.kmLTanque ? num(d.kmLTanque, 2) : "–"}</td>
                    <td>{d.temRecibo ? <a href={`/recibos/${d.id}`} target="_blank" rel="noopener">ver</a> : "–"}</td>
                    {pode && (
                      <td>
                        <form action={excluirDespesa}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="mini" aria-label={`Excluir despesa de ${dataBr(d.data)} em ${d.placa}`}>Excluir</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
