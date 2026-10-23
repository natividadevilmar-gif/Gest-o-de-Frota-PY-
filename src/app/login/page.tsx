"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, null);
  return (
    <main className="center">
      <div className="card login">
        <div className="logo" style={{ padding: 0 }}>
          <i />
          Gestão de Frota PY
        </div>
        <h1>Entrar</h1>
        <form action={acao}>
          <label htmlFor="email">
            E-mail
            <input id="email" name="email" type="email" autoComplete="username" defaultValue={estado?.email} key={estado?.email} required />
          </label>
          <label htmlFor="senha">
            Senha
            <input id="senha" name="senha" type="password" autoComplete="current-password" required />
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
