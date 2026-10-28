"use client";

import { useActionState, useState, useTransition } from "react";
import { apagarDemonstracao, conectarWialon, desconectarWialon, importarUnidadesWialon, ligarCaminhoesWialon, listarUnidadesWialon, trazerHistoricoWialon, type Historico, type ListaUnidades, type Resultado } from "./wialon";

const RODADAS_MAX = 30;
const sim = (v: boolean) => (v ? "sim" : "–");

type Servidor = { host: string; site: string };

/** Quadro da equipe KM Cero para ligar a conta Wialon do cliente. */
export function PainelWialon({ cliente, conectado, servidor, servidores, ligados, total, demo }: {
  cliente: string; conectado: boolean; servidor: string | null; servidores: (Servidor & { link: string })[]; ligados: number; total: number; demo: number;
}) {
  const [host, setHost] = useState(servidor ?? servidores[0].host);
  const [rc, conectar, conectando] = useActionState<Resultado, FormData>(conectarWialon, null);
  const [rl, ligar, ligando] = useActionState<Resultado, FormData>(ligarCaminhoesWialon, null);
  const [ri, importar, importando] = useActionState<Resultado, FormData>(importarUnidadesWialon, null);
  const [ra, apagar, apagando] = useActionState<Resultado, FormData>(apagarDemonstracao, null);
  const [lista, listar, listando] = useActionState<ListaUnidades, FormData>(listarUnidadesWialon, null);
  const [rh, setRh] = useState<Historico | null>(null);
  const [trazendo, iniciar] = useTransition();
  const link = servidores.find((s) => s.host === host)?.link;
  // Cada rodada trabalha uns 40 segundos; segue chamando enquanto faltar caminhão.
  const trazer = () => iniciar(async () => {
    for (let i = 0; i < RODADAS_MAX; i++) {
      const r = await trazerHistoricoWialon().catch((e: Error) => ({ ok: false, msg: e.message, faltam: 0 }));
      setRh(r);
      if (!r.faltam) break;
    }
  });
  return (
    <div className="card wialon-painel">
      <div className="card-h">
        <h2><span className="tag-demo tag-wialon">Wialon</span> Rastreadores da {cliente}</h2>
        <p>{conectado ? <>Conectado · {ligados} de {total} caminhões com posição do Wialon</> : "Ainda não conectado"}</p>
      </div>
      {conectado ? (
        <>
          <div className="form">
            <form action={importar}>
              <button type="submit" className="pri" disabled={importando}>{importando ? "Cadastrando…" : "Cadastrar os caminhões do Wialon"}</button>
            </form>
            <form action={ligar}>
              <button type="submit" disabled={ligando}>{ligando ? "Buscando no Wialon…" : "Ligar pela placa"}</button>
            </form>
            <button type="button" onClick={trazer} disabled={trazendo || ligados === 0}>{trazendo ? "Trazendo do Wialon…" : "Trazer a telemetria do mês"}</button>
            <form action={listar}>
              <button type="submit" disabled={listando}>{listando ? "Buscando…" : "Ver as unidades"}</button>
            </form>
            {demo > 0 && (
              <form action={apagar} onSubmit={(e) => { if (!confirm(`Apagar os ${demo} caminhões de demonstração e tudo de exemplo ligado a eles? Não tem volta.`)) e.preventDefault(); }}>
                <button type="submit" disabled={apagando}>{apagando ? "Apagando…" : `Apagar os ${demo} de demonstração`}</button>
              </form>
            )}
            <form action={desconectarWialon}>
              <button type="submit">Desconectar</button>
            </form>
          </div>
          <p className="note">Cadastrar cria na plataforma um caminhão para cada unidade do Wialon que ainda não está aqui, já com o IMEI. Ligar pela placa só serve para caminhões já cadastrados com a mesma placa do nome da unidade.
            A telemetria (km, diesel, RPM, freadas e excessos) chega sozinha a cada minuto; Trazer a telemetria do mês busca também os dias anteriores.</p>
          {rh && <p><small className={`pill ${rh.ok ? "ok" : rh.faltam ? "info" : "bad"}`} role="status">{rh.msg}</small></p>}
          {[ri, rl, ra, rc?.ok && !ri && !rl ? rc : null].map((r, i) => r && <p key={i}><small className={`pill ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</small></p>)}
          {lista && !lista.ok && <p><small className="pill bad" role="status">{lista.msg}</small></p>}
          {lista?.ok && (
            <div className="tw">
              <table>
                <thead><tr><th>Unidade no Wialon</th><th>IMEI</th><th>Caminhão na plataforma</th><th>Última mensagem</th><th>Odômetro</th><th>Diesel</th><th>Tanque</th><th>RPM</th><th>Ignição</th><th>Freadas e excessos</th></tr></thead>
                <tbody>
                  {lista.unidades.map((u) => (
                    <tr key={`${u.nome}-${u.imei}`}>
                      <td>{u.nome}</td>
                      <td className="mono">{u.imei ?? "–"}</td>
                      <td>{u.placa ?? <span className="pill warn">não cadastrado</span>}</td>
                      <td>{u.ultima ? new Date(u.ultima).toLocaleString("pt-BR", { timeZone: "America/Asuncion" }) : "sem mensagens"}</td>
                      <td>{sim(u.telemetria.odometro)}</td>
                      <td>{sim(u.telemetria.diesel)}</td>
                      <td>{sim(u.telemetria.tanque)}</td>
                      <td>{sim(u.telemetria.rpm)}</td>
                      <td>{sim(u.telemetria.ignicao)}</td>
                      <td>{sim(u.telemetria.eventos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="note">
                <summary>Parâmetros que cada unidade envia</summary>
                {lista.unidades.map((u) => <p key={`${u.nome}-${u.imei}-p`}><b>{u.nome}</b>: <code>{u.telemetria.parametros.join(", ") || "nenhum"}</code></p>)}
              </details>
            </div>
          )}
        </>
      ) : (
        <form action={conectar} className="form wialon-form">
          <label>1. Endereço onde vocês entram no Wialon
            <select name="host" value={host} onChange={(e) => setHost(e.target.value)}>
              {servidores.map((s) => <option key={s.host} value={s.host}>{s.site}</option>)}
            </select>
          </label>
          <p className="note">2. <a href={link} target="_blank" rel="noreferrer">Abra o Wialon e autorize</a>. Depois copie o endereço inteiro da barra do navegador (ou só o código depois de <code>access_token=</code>).</p>
          <label>3. Cole aqui
            <input name="token" placeholder="https://…access_token=…" autoComplete="off" />
          </label>
          <button type="submit" disabled={conectando}>{conectando ? "Conferindo…" : "Conectar"}</button>
          {rc && <small className={`pill ${rc.ok ? "ok" : "bad"}`} role="status">{rc.msg}</small>}
        </form>
      )}
    </div>
  );
}
