"use client";

import { useActionState } from "react";
import { mudarRastreador, type Resultado } from "./actions";

export function CampoRastreador({ id, placa, atual }: { id: string; placa: string; atual: string | null }) {
  const [r, acao, enviando] = useActionState<Resultado, FormData>(mudarRastreador, null);
  return (
    <form action={acao} className="form" style={{ flexWrap: "nowrap" }}>
      <input type="hidden" name="id" value={id} />
      <input
        name="rastreadorId"
        defaultValue={atual ?? ""}
        placeholder="IMEI (15 números)"
        inputMode="numeric"
        className="mono"
        style={{ width: "17ch" }}
        aria-label={`IMEI do rastreador de ${placa}`}
      />
      <button type="submit" disabled={enviando}>Salvar</button>
      {r && <small className={`pill ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</small>}
    </form>
  );
}
