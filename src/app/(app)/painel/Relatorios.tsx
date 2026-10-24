"use client";

import { useState } from "react";

/** Relatórios em Excel do Painel: geral da empresa ou de um motorista, no mês escolhido. */
export function Relatorios({ mes, motoristas }: { mes: string; motoristas: { id: string; nome: string }[] }) {
  const [m, setM] = useState(mes);
  const [mot, setMot] = useState(motoristas[0]?.id ?? "");
  return (
    <div className="relatorios">
      <label htmlFor="relMes">Mês<input id="relMes" type="month" value={m} onChange={(e) => setM(e.target.value)} /></label>
      <a className="btn pri" href={`/painel/relatorio?mes=${m}`}>⬇ Relatório geral da empresa (Excel)</a>
      {motoristas.length > 0 && (
        <div className="rel-motorista">
          <label htmlFor="relMot">Motorista
            <select id="relMot" value={mot} onChange={(e) => setMot(e.target.value)}>
              {motoristas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          <a className="btn" href={`/motoristas/${mot}/relatorio?mes=${m}`}>⬇ Relatório do motorista (Excel)</a>
        </div>
      )}
    </div>
  );
}
