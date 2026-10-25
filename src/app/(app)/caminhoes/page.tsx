import { Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { mensalidadeTotal, NOME_PLANO, PRECO_MENSAL, type Plano } from "@/lib/indicadores";
import { mudarPlano } from "./actions";
import { CampoRastreador } from "./CampoRastreador";
import { NovoCaminhao } from "./NovoCaminhao";
import { Planos } from "./Planos";

export default async function Caminhoes() {
  const { sessao, cliente } = await clienteAtual();
  const pode = podeEditarCadastros(sessao);
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
        <div className="tw">
          <table>
            <thead>
              <tr><th>Placa</th><th>Modelo</th><th>Motorista</th><th className="n">Ref. km/l</th><th className="n">Odômetro</th><th>Rastreador</th><th className="n">Custos fixos/mês</th><th>Plano</th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><Placa placa={c.placa} /></td>
                  <td>{c.modelo}</td>
                  <td>{c.motorista?.nome ?? "–"}</td>
                  <td className="n">{num(c.consumoRefKmL, 1)}</td>
                  <td className="n">{num(c.odometroKm)}</td>
                  <td>{pode ? <CampoRastreador id={c.id} placa={c.placa} atual={c.rastreadorId} /> : c.rastreadorId ? <span className="mono">{c.rastreadorId}</span> : <span className="pill warn">sem rastreador</span>}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pode && (
        <div className="card">
          <div className="card-h"><h2>Cadastrar caminhão</h2><p>Os custos fixos entram no custo por km todo mês.</p></div>
          <NovoCaminhao plano={cliente.planoContratado} />
        </div>
      )}
    </>
  );
}
