"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Botão para voltar ao Painel, em todas as páginas menos o próprio Painel. */
export function VoltarInicio() {
  const caminho = usePathname();
  if (caminho === "/painel") return null;
  return <Link className="btn voltar-inicio" href="/painel">← Página inicial</Link>;
}
