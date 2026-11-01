"use client";

import { useActionState, useEffect, useRef } from "react";
import { CATEGORIAS_PAGAR } from "@/lib/pagar";
import { criarConta, type ResultadoPagar } from "./actions";

export function NovaConta({ caminhoes, hoje }: { caminhoes: { id: string; placa: string }[]; hoje: string }) {
  const [r, acao, enviando] = useActionState<ResultadoPagar, FormData>(criarConta, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (r?.ok) form.current?.reset(); }, [r]);
  return (
    <form ref={form} action={acao} className="form nova-conta">
      <label>Descrição<input name="descricao" required minLength={2} placeholder="Ex.: Parcela Scania AABN 389" /></label>
      <label>Tipo
        <select name="categoria" defaultValue="PARCELA">
          {Object.entries(CATEGORIAS_PAGAR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>Fornecedor (opcional)<input name="fornecedor" placeholder="Banco, seguradora, oficina…" /></label>
      <label>Caminhão (opcional)
        <select name="caminhaoId" defaultValue="">
          <option value="">Da empresa</option>
          {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
        </select>
      </label>
      <label>Moeda
        <select name="moeda" defaultValue="USD"><option value="USD">USD</option><option value="PYG">₲ Guarani</option><option value="BRL">R$ Real</option><option value="ARS">AR$ Peso</option></select>
      </label>
      <label>Valor (de cada parcela)<input name="valor" inputMode="decimal" required placeholder="0,00" /></label>
      <label>Vencimento<input name="vencimento" type="date" required defaultValue={hoje} /></label>
      <label>Repetir todo mês
        <select name="parcelas" defaultValue="1">
          <option value="1">Não, só uma vez</option>
          {[2, 3, 6, 10, 12, 18, 24, 36, 48, 60].map((n) => <option key={n} value={n}>{n} parcelas</option>)}
        </select>
      </label>
      <button type="submit" className="pri" disabled={enviando}>{enviando ? "Lançando…" : "Lançar conta"}</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
