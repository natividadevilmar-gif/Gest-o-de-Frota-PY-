"use client";

import { useActionState, useEffect, useState } from "react";
import { criarAcesso } from "./actions";

type Props = {
  motoristas: { id: string; nome: string }[];
  caminhoes: { id: string; placa: string; motorista: string | null; lanca: boolean }[];
};

export function NovoAcesso({ motoristas, caminhoes }: Props) {
  const [r, acao, enviando] = useActionState(criarAcesso, null);
  const [quem, setQuem] = useState(motoristas[0]?.id ?? "novo");
  // Depois de criar, o motorista sai da lista: volta a seleção para um que ainda não tem acesso.
  const primeiro = motoristas[0]?.id ?? "novo";
  useEffect(() => {
    if (quem !== "novo" && !motoristas.some((m) => m.id === quem)) setQuem(primeiro);
  }, [motoristas, quem, primeiro]);
  return (
    <form className="form" action={acao} key={r?.ok ? r.msg : "form"}>
      <label htmlFor="motoristaId">Motorista
        <select id="motoristaId" name="motoristaId" value={quem} onChange={(e) => setQuem(e.target.value)}>
          {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          <option value="novo">+ Novo motorista</option>
        </select>
      </label>
      {quem === "novo" && <label htmlFor="nome">Nome do motorista<input id="nome" name="nome" className="wide" required /></label>}
      <label htmlFor="caminhaoId">Caminhão dele
        <select id="caminhaoId" name="caminhaoId" defaultValue="">
          <option value="">Manter como está</option>
          {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}{c.motorista ? ` (hoje: ${c.motorista})` : ""}{c.lanca ? "" : " · plano Básico, sem despesas"}</option>)}
        </select>
      </label>
      <label htmlFor="celular">Celular (login)<input id="celular" name="celular" inputMode="tel" placeholder="celular do motorista, ex.: 09XX XXX XXX" required /></label>
      <label htmlFor="pin">PIN (6 a 8 números)<input id="pin" name="pin" inputMode="numeric" pattern="\d{6,8}" maxLength={8} required /></label>
      <button className="pri" type="submit" disabled={enviando}>Criar acesso</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
