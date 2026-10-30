"use client";

import { useActionState } from "react";
import { Marca } from "@/components/Marca";
import { entrar } from "./actions";

export function Formulario({ motorista = false, fundo = null }: { motorista?: boolean; fundo?: string | null }) {
  const [estado, acao, enviando] = useActionState(entrar, null);
  return (
    <main className={fundo ? "center login-fundo" : "center"} style={fundo ? { backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url(${fundo})` } : undefined}>
      <div className="card login">
        <div className="logo" style={{ padding: 0 }}>
          <Marca tamanho={30} />
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
