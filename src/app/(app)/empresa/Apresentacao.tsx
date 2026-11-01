"use client";

import Link from "next/link";
import { useActionState } from "react";
import { recriarEmpresaApresentacao } from "./actions";

/** Botão do admin para criar ou renovar a empresa de apresentação. */
export function Apresentacao({ existe }: { existe: boolean }) {
  const [r, acao, enviando] = useActionState(recriarEmpresaApresentacao, null);
  return (
    <form action={acao} className="form" onSubmit={(e) => { if (existe && !confirm("Recriar a empresa de apresentação? Os dados dela voltam ao exemplo de hoje e a senha do login muda.")) e.preventDefault(); }}>
      <p className="note">
        6 caminhões andando no mapa, motoristas, 60 dias de telemetria e despesas, fretes (um com link de rastreio pronto), revisões e alertas na Central.
        Recrie antes de cada apresentação para as datas ficarem atuais. Ela não entra nos números da KM Cero.
      </p>
      <div className="acoes-painel">
        <button type="submit" className="pri" disabled={enviando}>{enviando ? "Criando… (leva uns segundos)" : existe ? "Recriar apresentação" : "Criar apresentação"}</button>
        {r?.ok && <Link className="btn" href="/painel">Abrir o painel da apresentação</Link>}
      </div>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}
