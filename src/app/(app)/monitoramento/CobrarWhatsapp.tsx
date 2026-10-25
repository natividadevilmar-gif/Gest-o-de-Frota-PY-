"use client";

import { useState } from "react";
import type { OcorrenciaVista } from "@/lib/monitoramento";
import { linkWhatsapp, mensagemOcorrencia, numeroInternacional } from "@/lib/whatsapp";

/** Campo para falar com o motorista pelo WhatsApp sobre o alerta: celular e mensagem já preenchidos, editáveis. */
export function CobrarWhatsapp({ o, aoEnviar }: { o: OcorrenciaVista; aoEnviar: () => void }) {
  const [celular, setCelular] = useState(o.motorista?.celular ?? "");
  const [texto, setTexto] = useState(() => mensagemOcorrencia({ tipo: o.tipo, titulo: o.titulo, nome: o.motorista?.nome ?? null, placa: o.placa, detalhe: o.detalhe }, o.motorista?.idioma ?? "pt"));
  const numero = numeroInternacional(celular, o.pais);
  const valido = numero.length >= 10;

  return (
    <form className="oc-whats" onSubmit={(e) => {
      e.preventDefault();
      if (!valido) return;
      window.open(linkWhatsapp(numero, texto), "_blank", "noopener");
      aoEnviar();
    }}>
      <label htmlFor={`wa-cel-${o.id}`}>WhatsApp de {o.motorista?.nome ?? "motorista"}
        <input id={`wa-cel-${o.id}`} value={celular} onChange={(e) => setCelular(e.target.value)} inputMode="tel" placeholder="0981 123 456" required />
      </label>
      {!o.motorista?.celular && <small>Motorista sem celular no Acesso dos motoristas: digite o número.</small>}
      <label htmlFor={`wa-txt-${o.id}`}>Mensagem
        <textarea id={`wa-txt-${o.id}`} rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <button type="submit" className="oc-btn oc-wa" disabled={!valido}>Enviar no WhatsApp</button>
    </form>
  );
}
