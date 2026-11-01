"use client";

/** Manda o resumo da semana pelo WhatsApp (o dono escolhe o contato) ou imprime / salva em PDF. */
export function EnviarSemana({ texto }: { texto: string }) {
  return (
    <div className="acoes-painel nao-imprimir">
      <button type="button" className="pri" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n\n${window.location.href}`)}`, "_blank", "noopener")}>
        Enviar resumo pelo WhatsApp
      </button>
      <button type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
    </div>
  );
}
