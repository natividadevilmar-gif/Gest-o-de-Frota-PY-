"use client";

import { useActionState } from "react";
import { criarCaminhao } from "./actions";

export function NovoCaminhao() {
  const [r, acao, enviando] = useActionState(criarCaminhao, null);
  return (
    <form className="form" action={acao}>
      <label htmlFor="placa">Placa<input id="placa" name="placa" placeholder="AAAA 000" required /></label>
      <label htmlFor="modelo">Modelo<input id="modelo" name="modelo" className="wide" placeholder="Scania R450" required /></label>
      <label htmlFor="plano">Plano
        <select id="plano" name="plano" defaultValue="GESTAO">
          <option value="BASICO">Básico (USD 16)</option>
          <option value="GESTAO">Gestão (USD 28)</option>
          <option value="VIDEO">Vídeo (USD 52)</option>
        </select>
      </label>
      <label htmlFor="consumoRefKmL">Consumo de referência (km/l)<input id="consumoRefKmL" name="consumoRefKmL" type="number" step="0.1" defaultValue="2.6" required /></label>
      <label htmlFor="odometroKm">Odômetro (km)<input id="odometroKm" name="odometroKm" type="number" min="0" required /></label>
      <label htmlFor="motorista">Motorista<input id="motorista" name="motorista" className="wide" /></label>
      <label htmlFor="rastreadorId">IMEI do rastreador<input id="rastreadorId" name="rastreadorId" inputMode="numeric" placeholder="15 números" /></label>
      <label htmlFor="salarioMotorista">Salário + encargos (USD/mês)<input id="salarioMotorista" name="salarioMotorista" type="number" min="0" defaultValue="1125" /></label>
      <label htmlFor="seguroMensal">Seguro (USD/mês)<input id="seguroMensal" name="seguroMensal" type="number" min="0" defaultValue="0" /></label>
      <label htmlFor="depreciacaoMensal">Depreciação (USD/mês)<input id="depreciacaoMensal" name="depreciacaoMensal" type="number" min="0" defaultValue="0" /></label>
      <button className="pri" type="submit" disabled={enviando}>Cadastrar</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
