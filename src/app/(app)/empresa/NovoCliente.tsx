"use client";

import { useActionState } from "react";
import { criarCliente } from "./actions";

export function NovoCliente() {
  const [r, acao, enviando] = useActionState(criarCliente, null);
  return (
    <form className="form" action={acao}>
      <label htmlFor="nome">Transportadora<input id="nome" name="nome" className="wide" required /></label>
      <label htmlFor="cidade">Cidade<input id="cidade" name="cidade" required /></label>
      <label htmlFor="ruc">RUC<input id="ruc" name="ruc" /></label>
      <label htmlFor="idioma">Idioma
        <select id="idioma" name="idioma" defaultValue="pt"><option value="pt">Português</option><option value="es">Español</option></select>
      </label>
      <label htmlFor="gestorNome">Nome do gestor<input id="gestorNome" name="gestorNome" className="wide" required /></label>
      <label htmlFor="gestorEmail">E-mail do gestor<input id="gestorEmail" name="gestorEmail" type="email" className="wide" required /></label>
      <label htmlFor="senha">Senha inicial<input id="senha" name="senha" type="password" minLength={8} required /></label>
      <button className="pri" type="submit" disabled={enviando}>Cadastrar cliente</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
