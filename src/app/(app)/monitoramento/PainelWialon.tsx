"use client";

import { useActionState, useState } from "react";
import { conectarWialon, desconectarWialon, ligarCaminhoesWialon, type Resultado } from "./wialon";

type Servidor = { host: string; site: string };

/** Quadro da equipe KM Cero para ligar a conta Wialon do cliente. */
export function PainelWialon({ cliente, conectado, servidor, servidores, ligados, total }: {
  cliente: string; conectado: boolean; servidor: string | null; servidores: (Servidor & { link: string })[]; ligados: number; total: number;
}) {
  const [host, setHost] = useState(servidor ?? servidores[0].host);
  const [rc, conectar, conectando] = useActionState<Resultado, FormData>(conectarWialon, null);
  const [rl, ligar, ligando] = useActionState<Resultado, FormData>(ligarCaminhoesWialon, null);
  const link = servidores.find((s) => s.host === host)?.link;
  return (
    <div className="card wialon-painel">
      <div className="card-h">
        <h2><span className="tag-demo tag-wialon">Wialon</span> Rastreadores da {cliente}</h2>
        <p>{conectado ? <>Conectado · {ligados} de {total} caminhões com posição do Wialon</> : "Ainda não conectado"}</p>
      </div>
      {conectado ? (
        <div className="form">
          <form action={ligar}>
            <button type="submit" disabled={ligando}>{ligando ? "Buscando no Wialon…" : "Ligar os caminhões"}</button>
          </form>
          <form action={desconectarWialon}>
            <button type="submit" className="sec">Desconectar</button>
          </form>
          {rl && <small className={`pill ${rl.ok ? "ok" : "bad"}`} role="status">{rl.msg}</small>}
          {rc?.ok && !rl && <small className="pill ok" role="status">{rc.msg}</small>}
        </div>
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
