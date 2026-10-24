"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { entregarCaixa } from "./actions";

const BANDEIRA: Record<Moeda, string> = { PYG: "🇵🇾", USD: "🇺🇸", BRL: "🇧🇷", ARS: "🇦🇷" };
const NOME: Record<Moeda, string> = { PYG: "Guarani", USD: "Dólar", BRL: "Real", ARS: "Peso arg." };

type Mot = { id: string; nome: string; caminhaoId: string | null };

export function FormCaixa({ motoristas, caminhoes, hoje }: { motoristas: Mot[]; caminhoes: { id: string; placa: string }[]; hoje: string }) {
  const [r, acao, enviando] = useActionState(entregarCaixa, null);
  const formulario = useRef<HTMLFormElement>(null);
  const [moeda, setMoeda] = useState<Moeda>("PYG");
  const [mot, setMot] = useState(motoristas[0]?.id ?? "");
  const [cam, setCam] = useState(motoristas[0]?.caminhaoId ?? "");
  useEffect(() => { if (r?.ok) formulario.current?.reset(); }, [r]);
  return (
    <form ref={formulario} action={acao} className="frete">
      <input type="hidden" name="moeda" value={moeda} />
      <fieldset>
        <legend>Motorista que sai em viagem</legend>
        <label htmlFor="motoristaId">Motorista
          <select id="motoristaId" name="motoristaId" value={mot} onChange={(e) => { setMot(e.target.value); setCam(motoristas.find((m) => m.id === e.target.value)?.caminhaoId ?? ""); }}>
            {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
        <label htmlFor="caminhaoId">Caminhão
          <select id="caminhaoId" name="caminhaoId" value={cam} onChange={(e) => setCam(e.target.value)}>
            <option value="">Sem caminhão</option>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
          </select>
        </label>
        <label htmlFor="data">Data da entrega do dinheiro<input id="data" name="data" type="date" defaultValue={hoje} required /></label>
      </fieldset>
      <div className="moeda-topo" role="radiogroup" aria-label="Moeda do caixa">
        <span>Moeda do caixa</span>
        <div>
          {(["PYG", "USD", "BRL", "ARS"] as Moeda[]).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={moeda === x} className={moeda === x ? "sel" : ""} onClick={() => setMoeda(x)}>
              <span aria-hidden="true">{BANDEIRA[x]}</span> <b>{SIMBOLO[x]}</b> {NOME[x]}
            </button>
          ))}
        </div>
      </div>
      <fieldset>
        <legend>Dinheiro entregue</legend>
        <label htmlFor="valor">Valor ({SIMBOLO[moeda]})<input id="valor" name="valor" type="number" step="any" min="0.01" inputMode="decimal" required /></label>
        <label htmlFor="observacao" className="largo">Observação<input id="observacao" name="observacao" placeholder="Ex.: combustível e pedágios até Paranaguá" /></label>
      </fieldset>
      <button className="pri grande" type="submit" disabled={enviando}>Entregar caixa</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
