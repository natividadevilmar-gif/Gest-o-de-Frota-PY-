import { Placa, PillRevisao, PlanoNecessario } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { revisoesCliente } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, num } from "@/lib/formato";
import { AVISO_KM, planoPermite, type Plano } from "@/lib/indicadores";
import { NovoItem, RegistrarServico } from "./Formularios";

const COR = { vencida: "var(--bad)", proxima: "var(--warn)", em_dia: "var(--ok)" } as const;

export default async function Revisoes() {
  const { sessao, cliente } = await clienteAtual();
  const itens = (await revisoesCliente(cliente.id)).filter((r) => planoPermite(r.caminhao.plano as Plano, "revisoes"));
  const caminhoes = (await db.caminhao.findMany({ where: { clienteId: cliente.id }, orderBy: { placa: "asc" } })).filter((c) => planoPermite(c.plano as Plano, "revisoes"));
  if (caminhoes.length === 0) return <PlanoNecessario modulo="revisoes" titulo="Revisões" />;
  const conta = (s: string) => itens.filter((i) => i.status.situacao === s).length;
  const pendentes = itens.filter((i) => !(i.gatilho === "FALHA" && i.resolvido));

  return (
    <>
      <h1>Revisões</h1>
      <div className="card">
        <div className="card-h">
          <h2>Plano de revisões</h2>
          <p>Por km ou por data · aviso com {num(AVISO_KM)} km de antecedência</p>
        </div>
        <div className="legend">
          <span className="pill bad">{conta("vencida")} vencidas</span>
          <span className="pill warn">{conta("proxima")} próximas</span>
          <span className="pill ok">{conta("em_dia")} em dia</span>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th>Item</th><th>Gatilho</th><th>Vence</th><th>Uso do intervalo</th><th className="n">Falta</th><th>Situação</th></tr></thead>
            <tbody>
              {itens.map((i) => {
                const s = i.status;
                return (
                  <tr key={i.id}>
                    <td><Placa placa={i.caminhao.placa} /></td>
                    <td>{i.nome}</td>
                    <td><span className="tag">{i.gatilho === "KM" ? `a cada ${num(i.intervaloKm)} km` : i.gatilho === "DATA" ? "por data" : "leitura CAN"}</span></td>
                    <td>{s.venceAosKm !== undefined ? `aos ${num(s.venceAosKm)} km` : i.vencimento ? dataBr(i.vencimento) : "imediato"}</td>
                    <td><div className="prog"><span style={{ width: `${s.usoIntervalo * 100}%`, background: COR[s.situacao] }} /></div></td>
                    <td className="n">
                      {s.kmRestantes !== undefined
                        ? s.kmRestantes < 0 ? `passou ${num(-s.kmRestantes)} km` : `${num(s.kmRestantes)} km`
                        : s.diasRestantes !== undefined
                          ? s.diasRestantes < 0 ? `venceu há ${-s.diasRestantes} dias` : `${s.diasRestantes} dias`
                          : i.resolvido ? "resolvido" : "agora"}
                    </td>
                    <td><PillRevisao situacao={s.situacao} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Registrar serviço feito</h2><p>O custo entra na manutenção do custo por km.</p></div>
        <RegistrarServico
          hoje={new Date().toISOString().slice(0, 10)}
          itens={pendentes.map((i) => ({ id: i.id, rotulo: `${i.caminhao.placa} · ${i.nome}`, gatilho: i.gatilho, odometroKm: i.caminhao.odometroKm }))}
        />
      </div>
      {podeEditarCadastros(sessao) && (
        <div className="card">
          <div className="card-h"><h2>Adicionar item ao plano</h2><p>Intervalos do manual do fabricante, documentos com vencimento.</p></div>
          <NovoItem caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa }))} />
        </div>
      )}
    </>
  );
}
