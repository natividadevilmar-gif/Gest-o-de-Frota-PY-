"use client";

import { useActionState } from "react";
import { cadastrarCaminhoesCusat, conectarCusat, desconectarCusat, listarAparelhosCusat, type ListaAparelhos } from "./cusat";
import type { Resultado } from "./wialon";

/** Quadro da equipe KM Cero para ligar a conta CUSAT (GPSWOX) do cliente. */
export function PainelCusat({ cliente, conectado, servidor, email, ligados }: {
  cliente: string; conectado: boolean; servidor: string; email: string | null; ligados: number;
}) {
  const [rc, conectar, conectando] = useActionState<Resultado, FormData>(conectarCusat, null);
  const [ri, cadastrar, cadastrando] = useActionState<Resultado, FormData>(cadastrarCaminhoesCusat, null);
  const [lista, listar, listando] = useActionState<ListaAparelhos, FormData>(listarAparelhosCusat, null);
  return (
    <div className="card wialon-painel">
      <div className="card-h">
        <h2><span className="tag-demo tag-wialon">CUSAT</span> Rastreadores da {cliente}</h2>
        <p>{conectado ? <>Conectado como {email} em {servidor} · {ligados} caminhões com IMEI</> : "Ainda não conectado"}</p>
      </div>
      {conectado ? (
        <>
          <div className="form">
            <form action={cadastrar}>
              <button type="submit" className="pri" disabled={cadastrando}>{cadastrando ? "Cadastrando…" : "Cadastrar os caminhões da CUSAT"}</button>
            </form>
            <form action={listar}>
              <button type="submit" disabled={listando}>{listando ? "Buscando…" : "Ver os aparelhos"}</button>
            </form>
            <form action={desconectarCusat}>
              <button type="submit">Desconectar</button>
            </form>
          </div>
          <p className="note">Cadastrar cria um caminhão para cada aparelho da CUSAT que ainda não está aqui, já com o IMEI, e liga pela placa os que já estão cadastrados.
            A posição chega sozinha a cada minuto enquanto o mapa ou a central estiverem abertos.</p>
          {[ri, rc?.ok && !ri ? rc : null].map((r, i) => r && <p key={i}><small className={`pill ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</small></p>)}
          {lista && !lista.ok && <p><small className="pill bad" role="status">{lista.msg}</small></p>}
          {lista?.ok && (
            <div className="tw">
              <table>
                <thead><tr><th>Aparelho na CUSAT</th><th>IMEI</th><th>Caminhão na plataforma</th><th>Última posição</th><th>Sensores</th></tr></thead>
                <tbody>
                  {lista.aparelhos.map((a) => (
                    <tr key={`${a.nome}-${a.imei}`}>
                      <td>{a.nome}</td>
                      <td className="mono">{a.imei ?? "–"}</td>
                      <td>{a.placa ?? <span className="pill warn">não cadastrado</span>}</td>
                      <td>{a.ultima ? new Date(a.ultima).toLocaleString("pt-BR", { timeZone: "America/Asuncion" }) : "sem posição"}</td>
                      <td><small>{a.sensores || "–"}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <form action={conectar} className="form wialon-form">
          <label>Endereço da plataforma
            <input name="host" defaultValue={servidor} autoComplete="off" />
          </label>
          <label>E-mail da conta
            <input name="email" type="email" autoComplete="off" required />
          </label>
          <label>Senha
            <input name="senha" type="password" autoComplete="new-password" required />
          </label>
          <button type="submit" disabled={conectando}>{conectando ? "Testando…" : "Conectar e testar"}</button>
          <p className="note">A senha só é usada para entrar e não fica guardada: a plataforma guarda a chave de acesso que a CUSAT devolve.</p>
          {rc && <small className={`pill ${rc.ok ? "ok" : "bad"}`} role="status">{rc.msg}</small>}
        </form>
      )}
    </div>
  );
}
