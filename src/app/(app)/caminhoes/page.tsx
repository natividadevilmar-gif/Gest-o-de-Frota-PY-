import { RolagemFixa } from "@/components/RolagemFixa";
import { Placa } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { NOME_APRESENTACAO } from "@/lib/apresentacao";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { mensalidadeTotal, NOME_PLANO, PRECO_MENSAL, type Plano } from "@/lib/indicadores";
import { clienteUsaWialon, recebeDireto } from "@/lib/rastreio/wialon";
import { ehImei } from "@/lib/telemetria/posicoes";
import { alternarBase, mudarCamera, mudarEixos, mudarPlano } from "./actions";
import { CampoRastreador } from "./CampoRastreador";
import { NovoCaminhao } from "./NovoCaminhao";
import { Planos } from "./Planos";

export default async function Caminhoes() {
  const { sessao, cliente } = await clienteAtual();
  // Só a equipe KM Cero cadastra caminhão, muda plano ou rastreador (depois de instalar o equipamento).
  const pode = sessao.papel === "ADMIN";
  const wialon = clienteUsaWialon(cliente);
  // Na empresa de apresentação, o código do simulador aparece como um IMEI comum.
  const vitrine = cliente.nome === NOME_APRESENTACAO;
  const mostrar = (r: string | null) => (vitrine && r?.startsWith("SIM-") ? imeiDeVitrine(r) : r);
  const lista = await db.caminhao.findMany({ where: { clienteId: cliente.id }, include: { motorista: true }, orderBy: { placa: "asc" } });
  return (
    <>
      <h1>Caminhões e planos</h1>
      <Planos
        precos={PRECO_MENSAL}
        quantos={{ BASICO: lista.filter((c) => c.plano === "BASICO").length, GESTAO: lista.filter((c) => c.plano === "GESTAO").length, VIDEO: lista.filter((c) => c.plano === "VIDEO").length }}
        inicial={cliente.planoContratado as Plano}
      />
      <div className="card">
        <div className="card-h">
          <h2>Frota cadastrada</h2>
          <p>
            Mensalidade total: <b>{usd(mensalidadeTotal(lista.map((c) => c.plano as Plano)))}</b> por mês
            {sessao.papel !== "OPERADOR" && <> · Contrato: plano {NOME_PLANO[cliente.planoContratado as Plano]}, {cliente.caminhoesContratados} caminhões · <a href={`/contrato/${cliente.id}`}>ver contrato</a></>}
          </p>
        </div>
        <RolagemFixa>
          <table>
            <thead>
              <tr><th>Placa</th><th>Modelo</th><th>Motorista</th><th className="n">Ref. km/l</th><th className="n">Odômetro</th><th className="n">Eixos</th><th>Rastreador</th><th className="n">Custos fixos/mês</th><th>Plano</th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><Placa placa={c.placa} /></td>
                  <td>{c.modelo}</td>
                  <td>{c.motorista?.nome ?? "–"}</td>
                  <td className="n">{num(c.consumoRefKmL, 1)}</td>
                  <td className="n">{num(c.odometroKm)}</td>
                  <td className="n">
                    {pode ? (
                      <form action={mudarEixos} className="form" style={{ flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={c.id} />
                        <input name="eixos" type="number" min="2" max="12" defaultValue={c.eixos} aria-label={`Eixos de ${c.placa}`} style={{ width: "4em" }} />
                        <button type="submit">Salvar</button>
                      </form>
                    ) : c.eixos}
                  </td>
                  <td>{pode && !vitrine ? <CampoRastreador id={c.id} placa={c.placa} atual={c.rastreadorId} /> : c.rastreadorId ? <span className="mono">{mostrar(c.rastreadorId)}</span> : <span className="pill warn">sem rastreador</span>}
                    {ehImei(c.rastreadorId) && (recebeDireto(c)
                      ? <span className="tag-demo tag-wialon" title="O aparelho manda as posições direto à plataforma">Direto</span>
                      : wialon && <span className="tag-demo tag-wialon" title="Posições trazidas do Wialon">Wialon</span>)}
                    {c.baseCombustivel && <span className="tag-demo tag-base" title="Fica fora do mapa e dos alertas; aparece em Telemetria">Base de abastecimento</span>}
                    {pode && (
                      <form action={alternarBase} style={{ marginTop: 6 }}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="link">{c.baseCombustivel ? "Desmarcar: é um caminhão" : "Marcar como base de abastecimento"}</button>
                      </form>
                    )}</td>
                  <td className="n">{usd(c.salarioMotorista + c.seguroMensal + c.depreciacaoMensal)}</td>
                  <td>
                    {pode ? (
                      <form action={mudarPlano} className="form" style={{ flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={c.id} />
                        <select name="plano" defaultValue={c.plano} aria-label={`Plano de ${c.placa}`}>
                          {(["BASICO", "GESTAO", "VIDEO"] as Plano[]).map((p) => (
                            <option key={p} value={p}>{NOME_PLANO[p]} · USD {PRECO_MENSAL[p]}</option>
                          ))}
                        </select>
                        <button type="submit">Salvar</button>
                      </form>
                    ) : (
                      <span className="tag">{NOME_PLANO[c.plano as Plano]}</span>
                    )}
                    {c.plano === "VIDEO" && (pode ? (
                      <form action={mudarCamera} className="form" style={{ flexWrap: "nowrap", marginTop: 6 }}>
                        <input type="hidden" name="id" value={c.id} />
                        <select name="camera" defaultValue={c.camera} aria-label={`Câmeras de ${c.placa}`}>
                          <option value="dualcam">DualCam · 2 câmeras</option>
                          <option value="mdvr4">MDVR · 4 câmeras</option>
                        </select>
                        <button type="submit">Salvar</button>
                      </form>
                    ) : <><br /><small className="muted">{c.camera === "mdvr4" ? "MDVR · 4 câmeras" : "DualCam · 2 câmeras"}</small></>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RolagemFixa>
      </div>
      {!pode && (
        <p className="note">Para incluir um caminhão ou mudar de plano, fale com a KM Cero: o caminhão entra no sistema depois que o rastreador é instalado.</p>
      )}
      {pode && (
        <div className="card">
          <div className="card-h"><h2>Cadastrar caminhão</h2><p>Os custos fixos entram no custo por km todo mês.</p></div>
          <NovoCaminhao plano={cliente.planoContratado} />
        </div>
      )}
    </>
  );
}

/** Um IMEI fixo e com cara de real para cada código do simulador. */
function imeiDeVitrine(codigo: string): string {
  let h = 2166136261;
  for (const ch of codigo) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const g = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return `86${String(h).padStart(10, "0").slice(-7)}${String(g).padStart(10, "0").slice(-6)}`;
}
