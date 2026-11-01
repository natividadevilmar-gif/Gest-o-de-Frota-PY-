import Link from "next/link";
import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual, filtroCaminhoesDoMotorista, motoristaDaSessao, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, taxa, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { caixasMotoristas, lancamentosMes } from "@/lib/dados";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual, NOME_CATEGORIA, planoPermite } from "@/lib/indicadores";
import { idiomaAtual } from "@/lib/i18n/atual";
import { leitorConfigurado } from "@/lib/leitorDespesa";
import { TEXTOS } from "@/lib/textosDespesa";
import { excluirDespesa } from "../custos/actions";
import { LancarDespesa } from "../custos/LancarDespesa";
import { RegistrarCarga } from "./RegistrarCarga";

export default async function Despesas({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const motoristaId = await motoristaDaSessao(sessao);
  // Em espanhol a tela sai com os textos próprios do motorista; nos outros idiomas, em português e o Tradutor troca.
  const idioma = (await idiomaAtual()) === "es" ? "es" : "pt";
  const es = idioma === "es";
  const t = TEXTOS[idioma];
  const caminhoes = (await db.caminhao.findMany({
    where: { clienteId: cliente.id, ...(await filtroCaminhoesDoMotorista(cliente.id, motoristaId)) },
    orderBy: { placa: "asc" },
    select: { id: true, placa: true, plano: true },
  })).filter((c) => planoPermite(c.plano, "despesas"));
  if (caminhoes.length === 0 && motoristaId !== null) {
    return <><h1>{es ? "Cargar gasto" : "Lançar despesa"}</h1><div className="card"><p className="note">{es ? "Ninguno de sus camiones está habilitado para cargar gastos. Hable con el gestor de la flota." : "Nenhum caminhão seu está liberado para lançar despesas. Fale com o gestor da frota."}</p></div></>;
  }
  if (caminhoes.length === 0) return <PlanoNecessario modulo="despesas" titulo="Lançar despesas" />;
  const cotacao = await cotacaoDoDia();
  const lancamentos = await lancamentosMes(cliente.id, mes, new Set(caminhoes.map((c) => c.id)), motoristaId !== null ? sessao.usuarioId : undefined);
  const pode = podeEditarCadastros(sessao);
  // O motorista vê quanto ainda tem do dinheiro que levou para a viagem.
  const caixa = motoristaId ? (await caixasMotoristas(cliente.id, { motoristaId })).find((c) => c.aberto) : undefined;
  // O motorista vê os próprios envios de foto e vídeo da carga.
  const envios = motoristaId !== null
    ? await db.registroCarga.findMany({ where: { clienteId: cliente.id, usuarioId: sessao.usuarioId }, orderBy: { criadoEm: "desc" }, take: 6, select: { id: true, tipo: true, criadoEm: true, caminhao: { select: { placa: true } } } })
    : [];
  const quando = (d: Date) => d.toLocaleString(es ? "es-PY" : "pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="card-h">
        <h1>{es ? "Cargar gasto" : "Lançar despesa"}</h1>
        {motoristaId === null && <Link className="btn" href={`/custos?mes=${mes}`}>Ver relatório de custos</Link>}
      </div>

      {caixa && (
        <div className="card caixa-motorista">
          <div className="card-h"><h2>{es ? "Su caja del viaje" : "Seu caixa da viagem"}</h2><p>{es ? "recibido el" : "recebido em"} {dataBr(caixa.data)}</p></div>
          <div className="grid g3">
            <div className="kpi"><span className="lbl">{es ? "Recibido" : "Recebido"}</span><b>{caixa.moeda === "USD" ? usd(caixa.valorUsd) : `${SIMBOLO[caixa.moeda as Moeda]} ${num(caixa.valorOriginal, 2)}`}</b></div>
            <div className="kpi"><span className="lbl">{es ? "Gastado" : "Gasto"}</span><b>{caixa.moeda === "USD" ? usd(caixa.gastoUsd) : `${SIMBOLO[caixa.moeda as Moeda]} ${num(caixa.gastoMesmaMoeda + caixa.gastoOutrasUsd * (taxa(caixa.moeda as Moeda, cotacao) ?? 1), 2)}`}</b><span className="sub">{caixa.nDespesas} {es ? "gastos" : "despesas"}</span></div>
            <div className="kpi"><span className="lbl">{es ? "Le queda" : "Ainda tem"}</span><b className={caixa.saldoUsd < 0 ? "t-bad" : "t-ok"}>{caixa.moeda === "USD" ? usd(caixa.saldoUsd) : `${SIMBOLO[caixa.moeda as Moeda]} ${num(caixa.valorOriginal - caixa.gastoMesmaMoeda - caixa.gastoOutrasUsd * (taxa(caixa.moeda as Moeda, cotacao) ?? 1), 2)}`}</b></div>
          </div>
        </div>
      )}

      <div className="card" id="carga">
        <div className="card-h">
          <h2>{es ? "Foto y video de la carga" : "Foto e vídeo da carga"}</h2>
          <p>{es ? "Quedan guardados con la fecha, la hora y el lugar del envío." : "Ficam guardados com a data, a hora e o local do envio."}{motoristaId === null && <> · <Link href="/cargas">ver todos</Link></>}</p>
        </div>
        <RegistrarCarga caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa }))} idioma={idioma} />
        {envios.length > 0 && (
          <ul className="registro-envios">
            {envios.map((e) => (
              <li key={e.id}><a href={`/carga/${e.id}`} target="_blank" rel="noopener">{e.tipo === "foto" ? "📷" : "🎥"} {e.caminhao.placa} · {quando(e.criadoEm)}</a></li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-h"><h2>{es ? "Nuevo gasto" : "Nova despesa"}</h2><p>{es ? "Saque foto de la factura, hable o complete." : "Tire foto do recibo, fale ou preencha. O custo por km recalcula na hora."}</p></div>
        <LancarDespesa
          caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa }))}
          hoje={new Date().toISOString().slice(0, 10)}
          cotacao={cotacao}
          idioma={idioma}
          leituraAtiva={leitorConfigurado()}
        />
      </div>

      <div className="card">
        <div className="card-h"><h2>{es ? "Gastos cargados" : "Lançamentos"} · {nomeMes(mes)}</h2><div className="form" style={{ alignItems: "center" }}><p>{lancamentos.length} {es ? "gastos" : "despesas"}</p><SeletorMes mes={mes} caminho="/despesas" /></div></div>
        {lancamentos.length === 0 ? (
          <p className="note">{es ? "Ningún gasto cargado este mes." : "Nenhuma despesa lançada neste mês."}</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>{t.data}</th><th>{t.caminhao}</th><th>{es ? "Tipo" : "Tipo"}</th><th>{es ? "Detalle" : "Detalhe"}</th><th className="n">{es ? "Monto pagado" : "Valor pago"}</th><th className="n">USD</th><th className="n">{es ? "km/l (tanque lleno)" : "km/l (tanque cheio)"}</th><th>{es ? "Factura" : "Recibo"}</th>{pode && <th />}</tr></thead>
              <tbody>
                {lancamentos.map((d) => (
                  <tr key={d.id}>
                    <td>{dataBr(d.data)}</td>
                    <td><Placa placa={d.placa} /></td>
                    <td>{es ? t.tipos[d.categoria] : NOME_CATEGORIA[d.categoria]}{d.origem !== "manual" && <> <span className="tag">{d.origem === "foto" ? "foto" : "áudio"}</span></>}</td>
                    <td>
                      {[d.litros ? `${num(d.litros, 1)} l` : null, d.precoLitro ? `${SIMBOLO[d.moeda as Moeda]} ${num(d.precoLitro, 2)}/l` : null, d.posto, d.odometroKm ? `${num(d.odometroKm)} km` : null, d.descricao]
                        .filter(Boolean)
                        .join(" · ") || "–"}
                    </td>
                    <td className="n">{d.moeda === "USD" ? "–" : `${SIMBOLO[d.moeda as Moeda]} ${num(d.valorOriginal, 2)}`}</td>
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
