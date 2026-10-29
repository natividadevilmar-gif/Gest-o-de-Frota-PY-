"use client";

import { useActionState } from "react";
import { criarGestor, novaSenhaGestor, removerGestor } from "./actions";

type Gestor = { id: string; nome: string; email: string; cliente: string };

function NovaSenha({ g }: { g: Gestor }) {
  const [r, acao, enviando] = useActionState(novaSenhaGestor, null);
  return (
    <form action={acao} className="form" style={{ flexWrap: "nowrap" }}>
      <input type="hidden" name="id" value={g.id} />
      <input name="senha" type="text" minLength={8} required placeholder="nova senha" aria-label={`Nova senha de ${g.email}`} style={{ width: 140 }} />
      <button type="submit" disabled={enviando}>Trocar</button>
      {r && <small className={`pill ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</small>}
    </form>
  );
}

export function AcessosGestores({ clientes, gestores }: { clientes: { id: string; nome: string }[]; gestores: Gestor[] }) {
  const [r, acao, enviando] = useActionState(criarGestor, null);
  return (
    <>
      <div className="tw">
        <table>
          <thead><tr><th>Cliente</th><th>Gestor</th><th>Login</th><th>Senha</th><th></th></tr></thead>
          <tbody>
            {gestores.map((g) => (
              <tr key={g.id}>
                <td><b>{g.cliente}</b></td>
                <td>{g.nome}</td>
                <td className="mono">{g.email}</td>
                <td><NovaSenha g={g} /></td>
                <td>
                  <form action={removerGestor} onSubmit={(e) => { if (!confirm(`Tirar o acesso de ${g.email}?`)) e.preventDefault(); }}>
                    <input type="hidden" name="id" value={g.id} />
                    <button type="submit">Remover</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="form" action={acao}>
        <label htmlFor="g-cliente">Cliente
          <select id="g-cliente" name="clienteId" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label htmlFor="g-nome">Nome<input id="g-nome" name="nome" required /></label>
        <label htmlFor="g-email">E-mail (login)<input id="g-email" name="email" type="email" className="wide" required /></label>
        <label htmlFor="g-senha">Senha<input id="g-senha" name="senha" type="text" minLength={8} required /></label>
        <button className="pri" type="submit" disabled={enviando}>Criar acesso</button>
        {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
      </form>
    </>
  );
}
