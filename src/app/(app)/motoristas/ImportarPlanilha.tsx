"use client";

import { useActionState } from "react";
import { importarMotoristas } from "./actions";

export function ImportarPlanilha() {
  const [r, acao, enviando] = useActionState(importarMotoristas, null);
  return (
    <form className="form" action={acao}>
      <label htmlFor="planilha">Planilha da frota (.xlsx)
        <input id="planilha" name="planilha" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </label>
      <button type="submit" disabled={enviando}>{enviando ? "Importando…" : "Importar motoristas"}</button>
      {r && <p className={`pill ${r.ok ? "ok" : "bad"}`} role="status" style={{ flexBasis: "100%", whiteSpace: "normal" }}>{r.msg}</p>}
    </form>
  );
}
