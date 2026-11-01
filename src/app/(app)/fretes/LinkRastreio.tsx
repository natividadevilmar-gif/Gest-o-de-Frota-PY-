"use client";

import { useState, useTransition } from "react";
import { encerrarLinkRastreio, gerarLinkRastreio } from "./actions";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Asuncion" });

/**
 * Link para quem vai receber a carga ver o caminhão no mapa e a previsão de chegada, sem login.
 * A mensagem do WhatsApp sai em português para destino no Brasil e em espanhol nos demais.
 */
export function LinkRastreio({ id, token, expira, placa, destino, paisDestino }: {
  id: string; token: string | null; expira: string | null; placa: string; destino: string; paisDestino: string;
}) {
  const [link, setLink] = useState(token && expira ? { caminho: `/r/${token}`, expira } : null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const ativo = link && new Date(link.expira).getTime() > Date.now() ? link : null;
  // O domínio só existe no navegador: o endereço é montado no clique.
  const endereco = () => `${window.location.origin}${ativo!.caminho}`;
  const mensagem = () => paisDestino === "BR"
    ? `Acompanhe a sua carga (caminhão ${placa}, destino ${destino}) em tempo real: ${endereco()}`
    : `Seguí tu carga (camión ${placa}, destino ${destino}) en tiempo real: ${endereco()}`;

  if (!ativo) {
    return (
      <button type="button" className="link" disabled={ocupado} onClick={() => iniciar(async () => { setLink(await gerarLinkRastreio(id)); })}>
        {ocupado ? "gerando…" : "link de rastreio"}
      </button>
    );
  }
  return (
    <span className="link-rastreio">
      <small className="muted">link ativo até {dataCurta(ativo.expira)}</small>
      <br />
      <button type="button" className="link" onClick={async () => {
        try { await navigator.clipboard.writeText(endereco()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { prompt("Copie o link:", endereco()); }
      }}>{copiado ? "copiado!" : "copiar"}</button>
      {" · "}
      <button type="button" className="link" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagem())}`, "_blank", "noopener")}>WhatsApp</button>
      {" · "}
      <a className="link" href={ativo.caminho} target="_blank" rel="noreferrer">ver</a>
      {" · "}
      <button type="button" className="link" disabled={ocupado} onClick={() => {
        if (confirm("Encerrar o link? Quem tiver o endereço não verá mais o caminhão.")) iniciar(async () => { await encerrarLinkRastreio(id); setLink(null); });
      }}>encerrar</button>
    </span>
  );
}
