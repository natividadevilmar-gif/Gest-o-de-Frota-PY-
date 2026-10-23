"use client";

import { useActionState, useState } from "react";
import { lancarDespesa } from "./actions";

export function LancarDespesa({ caminhoes, hoje }: { caminhoes: { id: string; placa: string }[]; hoje: string }) {
  const [r, acao, enviando] = useActionState(lancarDespesa, null);
  const [cat, setCat] = useState("PEDAGIO");
  return (
    <form className="form" action={acao}>
      <label htmlFor="caminhaoId">Caminhão
        <select id="caminhaoId" name="caminhaoId">{caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}</select>
      </label>
      <label htmlFor="data">Data<input id="data" name="data" type="date" defaultValue={hoje} required /></label>
      <label htmlFor="categoria">Tipo
        <select id="categoria" name="categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="DIESEL">Diesel (abastecimento)</option>
          <option value="PNEUS">Pneus</option>
          <option value="MANUTENCAO">Manutenção</option>
          <option value="PEDAGIO">Pedágio</option>
          <option value="OUTROS">Outros</option>
        </select>
      </label>
      <label htmlFor="valorUsd">Valor (USD)<input id="valorUsd" name="valorUsd" type="number" step="0.01" min="0.01" required /></label>
      {cat === "DIESEL" && <label htmlFor="litros">Litros<input id="litros" name="litros" type="number" step="0.1" min="0.1" required /></label>}
      <label htmlFor="descricao">Descrição<input id="descricao" name="descricao" className="wide" /></label>
      <button className="pri" type="submit" disabled={enviando}>Lançar</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
