"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export function Formulario({ motorista = false }: { motorista?: boolean }) {
  const [estado, acao, enviando] = useActionState(entrar, null);
  return (
    <main className="center">
      <div className="card login">
        <div className="logo" style={{ padding: 0 }}>
          <span className="bandeira" aria-hidden="true">
            <span style={{ background: "#D52B1E" }} />
            <span style={{ background: "#FFFFFF" }} />
            <span style={{ background: "#0038A8" }} />
          </span>
          Gestão de Frota PY
        </div>
        <h1>{motorista ? "Acesso do motorista" : "Entrar"}</h1>
        <form action={acao}>
          <label htmlFor="email">
            {motorista ? "Celular" : "E-mail ou celular"}
            <input id="email" name="email" type={motorista ? "tel" : "text"} inputMode={motorista ? "tel" : undefined} autoComplete="username" autoCapitalize="none" defaultValue={estado?.email} key={estado?.email} required />
          </label>
          <label htmlFor="senha">
            {motorista ? "PIN" : "Senha ou PIN"}
            <input id="senha" name="senha" type="password" inputMode={motorista ? "numeric" : undefined} autoComplete="current-password" required />
          </label>
          {estado && <p className="msg bad" role="alert">{estado.erro}</p>}
          <button className="pri" type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
