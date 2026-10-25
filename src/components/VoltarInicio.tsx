"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Botão para voltar à página inicial (Painel do cliente ou, para a equipe KM Cero, Minha empresa). */
export function VoltarInicio({ inicio = "/painel" }: { inicio?: string }) {
  const caminho = usePathname();
  if (caminho === inicio) return null;
  return <Link className="btn voltar-inicio" href={inicio}>← Página inicial</Link>;
}
