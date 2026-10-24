"use client";

import { useActionState } from "react";
import { trocarSenha } from "./actions";

export function TrocarSenha() {
  const [r, acao, enviando] = useActionState(trocarSenha, null);
  return (
    <form className="form" action={acao} key={r?.ok ? "ok" : "form"}>
      <label htmlFor="atual">Senha atual<input id="atual" name="atual" type="password" autoComplete="current-password" required /></label>
      <label htmlFor="nova">Nova senha<input id="nova" name="nova" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label htmlFor="confirma">Repita a nova senha<input id="confirma" name="confirma" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="pri" type="submit" disabled={enviando}>Trocar senha</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
