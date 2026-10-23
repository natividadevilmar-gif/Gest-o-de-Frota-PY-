"use client";

import { useActionState, useState } from "react";
import { freteMinimoPorTonelada, margemViagem } from "@/lib/indicadores";
import { num, usd } from "@/lib/formato";
import { registrarViagem } from "./actions";

type Cam = { id: string; placa: string; custoKm: number };

export function Simulador({ caminhoes }: { caminhoes: Cam[] }) {
  const [id, setId] = useState(caminhoes[0]?.id);
  const [ton, setTon] = useState(30);
  const [pr, setPr] = useState(26);
  const [km, setKm] = useState(480);
  const [volta, setVolta] = useState(false);
  const c = caminhoes.find((x) => x.id === id) ?? caminhoes[0];
  const frete = ton * pr;
  const kmVazio = volta ? 0 : km;
  const m = margemViagem(frete, km, kmVazio, c.custoKm);
  const min = freteMinimoPorTonelada(ton, km, kmVazio, c.custoKm);
  return (
    <>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sCam">Caminhão
          <select id="sCam" value={id} onChange={(e) => setId(e.target.value)}>
            {caminhoes.map((x) => <option key={x.id} value={x.id}>{x.placa} · {usd(x.custoKm, 2)}/km</option>)}
          </select>
        </label>
        <label htmlFor="sTon">Toneladas<input id="sTon" type="number" min="1" value={ton} onChange={(e) => setTon(+e.target.value)} /></label>
        <label htmlFor="sPr">Frete por tonelada (USD)<input id="sPr" type="number" min="0" step="0.5" value={pr} onChange={(e) => setPr(+e.target.value)} /></label>
        <label htmlFor="sKm">km de ida<input id="sKm" type="number" min="1" value={km} onChange={(e) => setKm(+e.target.value)} /></label>
        <label htmlFor="sVolta">Volta com carga?
          <select id="sVolta" value={volta ? "1" : "0"} onChange={(e) => setVolta(e.target.value === "1")}>
            <option value="0">Não, volta vazio</option>
            <option value="1">Sim</option>
          </select>
        </label>
      </form>
      <div className="grid g3">
        <div className="kpi"><span className="lbl">Frete</span><b>{usd(frete)}</b><span className="sub">{num(ton)} t × {usd(pr, 2)}</span></div>
        <div className="kpi"><span className="lbl">Custo da viagem</span><b>{usd(m.custoUsd)}</b><span className="sub">{num(m.kmTotal)} km × {usd(c.custoKm, 2)}</span></div>
        <div className="kpi">
          <span className="lbl">Margem</span>
          <b className={m.margemUsd < 0 ? "t-bad" : "t-ok"}>{usd(m.margemUsd)}<small>{num(m.margemPct, 0)}%</small></b>
          <span className="sub">Frete mínimo sem prejuízo: {usd(min, 2)}/t</span>
        </div>
      </div>
    </>
  );
}

export function NovaViagem({ caminhoes, hoje }: { caminhoes: { id: string; placa: string }[]; hoje: string }) {
  const [r, acao, enviando] = useActionState(registrarViagem, null);
  return (
    <form className="form" action={acao}>
      <label htmlFor="caminhaoId">Caminhão
        <select id="caminhaoId" name="caminhaoId">{caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}</select>
      </label>
      <label htmlFor="vdata">Data<input id="vdata" name="data" type="date" defaultValue={hoje} required /></label>
      <label htmlFor="origem">Origem<input id="origem" name="origem" required /></label>
      <label htmlFor="destino">Destino<input id="destino" name="destino" required /></label>
      <label htmlFor="carga">Carga<input id="carga" name="carga" placeholder="Soja" required /></label>
      <label htmlFor="toneladas">Toneladas<input id="toneladas" name="toneladas" type="number" step="0.1" min="0.1" required /></label>
      <label htmlFor="freteUsd">Frete (USD)<input id="freteUsd" name="freteUsd" type="number" step="0.01" min="0.01" required /></label>
      <label htmlFor="kmCarregado">km carregado<input id="kmCarregado" name="kmCarregado" type="number" min="1" required /></label>
      <label htmlFor="kmVazio">km vazio<input id="kmVazio" name="kmVazio" type="number" min="0" required /></label>
      <button className="pri" type="submit" disabled={enviando}>Registrar viagem</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
