"use client";

export function Imprimir() {
  return <button type="button" className="pri" onClick={() => window.print()}>Imprimir ou salvar PDF</button>;
}
