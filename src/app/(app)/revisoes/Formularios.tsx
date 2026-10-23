"use client";

import { useActionState, useState } from "react";
import { criarItem, registrarServico } from "./actions";

type Item = { id: string; rotulo: string; gatilho: string; odometroKm: number };

export function RegistrarServico({ itens, hoje }: { itens: Item[]; hoje: string }) {
  const [r, acao, enviando] = useActionState(registrarServico, null);
  const [id, setId] = useState(itens[0]?.id ?? "");
  const sel = itens.find((i) => i.id === id);
  return (
    <form className="form" action={acao}>
      <label htmlFor="itemId">Item
        <select id="itemId" name="itemId" value={id} onChange={(e) => setId(e.target.value)}>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.rotulo}</option>)}
        </select>
      </label>
      <label htmlFor="sdata">Data<input id="sdata" name="data" type="date" defaultValue={hoje} required /></label>
      <label htmlFor="odometroKm">Odômetro (km)<input key={id} id="odometroKm" name="odometroKm" type="number" min="0" defaultValue={sel?.odometroKm} required /></label>
      <label htmlFor="custoUsd">Custo (USD)<input id="custoUsd" name="custoUsd" type="number" min="0" step="0.01" defaultValue="0" required /></label>
      {sel?.gatilho === "DATA" && <label htmlFor="proximoVencimento">Novo vencimento<input id="proximoVencimento" name="proximoVencimento" type="date" required /></label>}
      <button className="pri" type="submit" disabled={enviando || !id}>Registrar serviço</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}

export function NovoItem({ caminhoes }: { caminhoes: { id: string; placa: string }[] }) {
  const [r, acao, enviando] = useActionState(criarItem, null);
  const [g, setG] = useState("KM");
  return (
    <form className="form" action={acao}>
      <label htmlFor="caminhaoId">Caminhão
        <select id="caminhaoId" name="caminhaoId">{caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}</select>
      </label>
      <label htmlFor="nome">Item<input id="nome" name="nome" className="wide" placeholder="Óleo de câmbio e diferencial" required /></label>
      <label htmlFor="gatilho">Gatilho
        <select id="gatilho" name="gatilho" value={g} onChange={(e) => setG(e.target.value)}>
          <option value="KM">Por km</option>
          <option value="DATA">Por data</option>
        </select>
      </label>
      {g === "KM" ? (
        <>
          <label htmlFor="intervaloKm">A cada (km)<input id="intervaloKm" name="intervaloKm" type="number" min="1" required /></label>
          <label htmlFor="ultimoKm">Último serviço aos (km)<input id="ultimoKm" name="ultimoKm" type="number" min="0" placeholder="odômetro atual" /></label>
        </>
      ) : (
        <label htmlFor="vencimento">Vencimento<input id="vencimento" name="vencimento" type="date" required /></label>
      )}
      <button type="submit" disabled={enviando}>Adicionar</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
