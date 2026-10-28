"use client";

import { useActionState } from "react";
import { buscarImeisWialon, type Resultado } from "./actions";

export function BuscarWialon() {
  const [r, acao, enviando] = useActionState<Resultado, FormData>(buscarImeisWialon, null);
  return (
    <form action={acao} className="form">
      <button type="submit" disabled={enviando}>{enviando ? "Buscando no Wialon…" : "Buscar IMEIs no Wialon"}</button>
      {r && <small className={`pill ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</small>}
    </form>
  );
}
