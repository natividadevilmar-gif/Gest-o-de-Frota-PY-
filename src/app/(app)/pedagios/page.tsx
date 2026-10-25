import { redirect } from "next/navigation";
import { clienteOpcional } from "@/lib/acesso";
import { db } from "@/lib/db";
import { dataBr, num } from "@/lib/formato";
import { SIMBOLO_PEDAGIO } from "@/lib/pedagio";
import { rotasPedagio, taxasDoDia } from "@/lib/pedagioDados";
import { atualizarTarifa } from "./actions";
import { Calculadora } from "./Calculadora";

const NOME_PAIS: Record<string, string> = { PY: "🇵🇾 Paraguai", UY: "🇺🇾 Uruguai", BR: "🇧🇷 Brasil", AR: "🇦🇷 Argentina" };

export default async function Pedagios() {
  const { sessao, cliente } = await clienteOpcional();
  if (sessao.papel === "MOTORISTA") redirect("/despesas");
  const admin = sessao.papel === "ADMIN";
  const [rotas, taxas, pracas, caminhoes] = await Promise.all([
    rotasPedagio(),
    taxasDoDia(),
    db.pracaPedagio.findMany({ orderBy: [{ pais: "asc" }, { rodovia: "asc" }, { nome: "asc" }] }),
    cliente ? db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true, eixos: true }, orderBy: { placa: "asc" } }) : [],
  ]);
  const paises = ["PY", "UY", "BR", "AR"].filter((p) => pracas.some((x) => x.pais === p));

  return (
    <>
      <div className="card-h">
        <h1>Pedágios</h1>
        <p>{pracas.length} praças e {rotas.length} rotas no Paraguai, Uruguai e corredores para Brasil e Argentina</p>
      </div>

      <div className="card">
        <div className="card-h"><h2>Pedágio previsto por rota</h2><p>Cotação de hoje; peso uruguaio a {num(taxas.UYU, 1)} por dólar</p></div>
        <Calculadora rotas={rotas} taxas={taxas} caminhoes={caminhoes} />
      </div>

      {paises.map((pais) => (
        <div className="card" key={pais}>
          <div className="card-h"><h2>{NOME_PAIS[pais]}</h2><p>Tarifa de caminhão pesado</p></div>
          <div className="tw">
            <table>
              <thead><tr><th>Praça</th><th>Rodovia</th><th className="n">Tarifa</th><th>Fonte</th><th>Vigência</th></tr></thead>
              <tbody>
                {pracas.filter((p) => p.pais === pais).map((p) => {
                  const porEixo = p.tarifaEixo != null;
                  const valor = porEixo ? p.tarifaEixo : p.tarifaFixa;
                  const estimado = /estimad/i.test(p.fonte);
                  return (
                    <tr key={p.id}>
                      <td>{p.nome}</td>
                      <td>{p.rodovia}</td>
                      <td className="n">{SIMBOLO_PEDAGIO[p.moeda]} {num(valor, p.moeda === "PYG" ? 0 : 2)}<br /><small className="muted">{porEixo ? "por eixo" : "por caminhão"}</small></td>
                      <td>
                        {estimado && <span className="pill warn">estimado</span>}{" "}
                        {admin ? (
                          <form action={atualizarTarifa} className="form" style={{ flexWrap: "wrap" }}>
                            <input type="hidden" name="id" value={p.id} />
                            <input name="valor" type="number" step="any" min="0" defaultValue={valor ?? ""} aria-label={`Tarifa de ${p.nome}`} style={{ width: "8em" }} />
                            <input name="fonte" defaultValue={p.fonte} aria-label="Fonte" style={{ minWidth: "16em" }} />
                            <input name="lat" type="number" step="any" defaultValue={p.lat} aria-label="Latitude" title="Latitude (local da cabine)" style={{ width: "7em" }} />
                            <input name="lng" type="number" step="any" defaultValue={p.lng} aria-label="Longitude" title="Longitude (local da cabine)" style={{ width: "7em" }} />
                            <input name="vigencia" type="date" defaultValue={p.vigencia.toISOString().slice(0, 10)} aria-label="Vigência" />
                            <button type="submit">Salvar</button>
                          </form>
                        ) : <small>{p.fonte}</small>}
                      </td>
                      <td>{dataBr(p.vigencia)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="note">Valores públicos levantados em outubro de 2026. Praças marcadas como estimado não têm tabela oficial publicada e devem ser conferidas no primeiro recibo. O pedágio real lançado pelo motorista entra no custo por km. Quando o GPS passa a menos de 3 km de uma praça e o motorista não lança o pedágio em 4 horas, a Central de monitoramento recebe o alerta "Pedágio não registrado".</p>
    </>
  );
}
