"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Botão para voltar à página inicial (Painel do cliente ou, para a equipe KM Cero, Minha empresa). */
export function VoltarInicio({ inicio = "/painel" }: { inicio?: string }) {
  const caminho = usePathname();
  return (
    <div className="voltar-botoes">
      {caminho !== inicio && <Link className="btn voltar-inicio" href={inicio}>← Página inicial</Link>}
      <Suspense fallback={null}><VoltarCentral /></Suspense>
    </div>
  );
}

/** Telas abertas a partir de um alerta da Central (vídeo, comandos) ganham o atalho de volta. */
function VoltarCentral() {
  const busca = useSearchParams();
  if (busca.get("de") !== "central") return null;
  return <Link className="btn pri voltar-inicio" href={`/monitoramento${busca.get("todos") === "1" ? "?todos=1" : ""}`}>← Voltar à Central de monitoramento</Link>;
}
