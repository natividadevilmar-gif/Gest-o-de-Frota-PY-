import Link from "next/link";
import { redirect } from "next/navigation";
import { Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { planoPermite } from "@/lib/indicadores";
import { mudarIdioma, novoPin, removerAcesso, trocarCaminhao } from "./actions";
import { ImportarPlanilha } from "./ImportarPlanilha";
import { NovoAcesso } from "./NovoAcesso";

export default async function Motoristas() {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/painel");
  const motoristas = await db.motorista.findMany({
    where: { clienteId: cliente.id },
    orderBy: { nome: "asc" },
    include: { acesso: { select: { id: true, email: true, idioma: true } }, caminhoes: { select: { id: true, placa: true } } },
  });
  const caminhoes = await db.caminhao.findMany({
    where: { clienteId: cliente.id },
    orderBy: { placa: "asc" },
    select: { id: true, placa: true, plano: true, motorista: { select: { nome: true } } },
  });

  return (
    <>
      <h1>Acesso dos motoristas</h1>
      <div className="card">
        <div className="card-h"><h2>Criar acesso</h2><p>O motorista entra com o celular e o PIN e só vê a tela de lançar despesas do caminhão dele.</p></div>
        <NovoAcesso
          idioma={cliente.idioma}
          pais={cliente.pais}
          motoristas={motoristas.filter((m) => !m.acesso).map((m) => ({ id: m.id, nome: m.nome }))}
          caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa, motorista: c.motorista?.nome ?? null, lanca: planoPermite(c.plano, "despesas") }))}
        />
      </div>
      <div className="card">
        <div className="card-h"><h2>Importar da planilha da frota</h2><p>Cadastra os motoristas da coluna Chofer, Condutor ou Motorista e liga cada um ao caminhão da mesma linha.</p></div>
        <ImportarPlanilha />
      </div>
      <div className="card">
        <div className="card-h"><h2>Motoristas</h2><p>{motoristas.filter((m) => m.acesso).length} de {motoristas.length} com acesso</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Motorista</th><th>Caminhão</th><th>Login (celular)</th><th>Idioma</th><th>Trocar PIN</th><th /></tr></thead>
            <tbody>
              {motoristas.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/motoristas/${m.id}`}><b>{m.nome}</b></Link><br /><small className="muted">ver despesas</small></td>
                  <td>
                    <form action={trocarCaminhao} className="form" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="motoristaId" value={m.id} />
                      <select name="caminhaoId" defaultValue={m.caminhoes[0]?.id ?? ""} aria-label={`Caminhão de ${m.nome}`}>
                        <option value="">Qualquer da frota</option>
                        {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
                      </select>
                      <button type="submit">Salvar</button>
                    </form>
                  </td>
                  <td>{m.acesso ? <>{m.ddi ? `+${m.ddi} ` : ""}{m.acesso.email}</> : <span className="muted">sem acesso</span>}</td>
                  <td>
                    {m.acesso && (
                      <form action={mudarIdioma} className="form" style={{ flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={m.acesso.id} />
                        <select name="idioma" defaultValue={m.acesso.idioma ?? cliente.idioma} aria-label={`Idioma de ${m.nome}`}>
                          <option value="pt">Português</option>
                          <option value="es">Español</option>
                        </select>
                        <button type="submit">Salvar</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {m.acesso && (
                      <form action={novoPin} className="form" style={{ flexWrap: "nowrap" }}>
                        <input type="hidden" name="id" value={m.acesso.id} />
                        <input name="pin" inputMode="numeric" pattern="\d{6,8}" maxLength={8} placeholder="novo PIN" aria-label={`Novo PIN de ${m.nome}`} required style={{ width: 100 }} />
                        <button type="submit">Salvar</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {m.acesso && (
                      <form action={removerAcesso}>
                        <input type="hidden" name="id" value={m.acesso.id} />
                        <button type="submit" className="mini">Remover acesso</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Link para enviar ao motorista: <b>gest-o-de-frota-py.vercel.app/motorista</b>. Ele digita o celular e o PIN.</p>
      </div>
    </>
  );
}
