"use client";

import { useActionState, useState } from "react";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { salvarCaixa } from "./actions";

const BANDEIRA: Record<Moeda, string> = { PYG: "🇵🇾", USD: "🇺🇸", BRL: "🇧🇷", ARS: "🇦🇷" };
const NOME: Record<Moeda, string> = { PYG: "Guarani", USD: "Dólar", BRL: "Real", ARS: "Peso arg." };

export function FormCaixa({ mes, atual }: { mes: string; atual: { moeda: string; valorOriginal: number; observacao: string | null } | null }) {
  const [r, acao, enviando] = useActionState(salvarCaixa, null);
  const [moeda, setMoeda] = useState<Moeda>((atual?.moeda as Moeda) ?? "USD");
  return (
    <form action={acao} className="frete">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="moeda" value={moeda} />
      <div className="moeda-topo" role="radiogroup" aria-label="Moeda do caixa">
        <span>Moeda do caixa</span>
        <div>
          {(["USD", "PYG", "BRL", "ARS"] as Moeda[]).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={moeda === x} className={moeda === x ? "sel" : ""} onClick={() => setMoeda(x)}>
              <span aria-hidden="true">{BANDEIRA[x]}</span> <b>{SIMBOLO[x]}</b> {NOME[x]}
            </button>
          ))}
        </div>
      </div>
      <fieldset>
        <legend>Dinheiro em caixa no começo do mês</legend>
        <label htmlFor="valor">Valor ({SIMBOLO[moeda]})<input id="valor" name="valor" type="number" step="any" min="0" inputMode="decimal" defaultValue={atual?.valorOriginal} required /></label>
        <label htmlFor="observacao">Observação<input id="observacao" name="observacao" defaultValue={atual?.observacao ?? ""} placeholder="Ex.: saldo do banco + dinheiro" /></label>
      </fieldset>
      <button className="pri grande" type="submit" disabled={enviando}>Salvar caixa inicial</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
