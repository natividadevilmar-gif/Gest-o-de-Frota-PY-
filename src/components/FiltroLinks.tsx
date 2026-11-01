"use client";

import { useRouter } from "next/navigation";

export type OpcaoLink = { nome: string; href: string; atual?: boolean };

/** Caixa de escolha compacta: cada opção é um link, e escolher abre a página dele. */
export function FiltroLinks({ rotulo, opcoes }: { rotulo: string; opcoes: OpcaoLink[] }) {
  const router = useRouter();
  const atual = opcoes.find((o) => o.atual)?.href ?? opcoes[0]?.href;
  return (
    <label className="dash-filtro">
      <span>{rotulo}</span>
      <select value={atual} onChange={(e) => router.push(e.target.value)}>
        {opcoes.map((o) => <option key={o.href} value={o.href}>{o.nome}</option>)}
      </select>
    </label>
  );
}
