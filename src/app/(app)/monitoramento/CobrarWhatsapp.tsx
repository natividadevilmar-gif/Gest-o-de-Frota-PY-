"use client";

import { useState } from "react";
import type { OcorrenciaVista } from "@/lib/monitoramento";
import { juntarNumero, linkWhatsapp, mensagemOcorrencia, PAISES_DDI, separarNumero } from "@/lib/whatsapp";

/** Campo para falar com o motorista pelo WhatsApp sobre o alerta: celular e mensagem já preenchidos, editáveis. */
export function CobrarWhatsapp({ o, aoEnviar }: { o: OcorrenciaVista; aoEnviar: () => void }) {
  const inicial = separarNumero(o.motorista?.celular ?? "", o.pais);
  const [ddi, setDdi] = useState(inicial.ddi);
  const [celular, setCelular] = useState(inicial.local);
  const [texto, setTexto] = useState(() => mensagemOcorrencia({ tipo: o.tipo, titulo: o.titulo, nome: o.motorista?.nome ?? null, placa: o.placa, detalhe: o.detalhe }, o.motorista?.idioma ?? "pt"));
  const numero = juntarNumero(ddi, celular);
  const valido = numero.length >= 10;

  return (
    <form className="oc-whats" onSubmit={(e) => {
      e.preventDefault();
      if (!valido) return;
      window.open(linkWhatsapp(numero, texto), "_blank", "noopener");
      aoEnviar();
    }}>
      <div className="oc-cel">
        <label htmlFor={`wa-ddi-${o.id}`}>País
          <select id={`wa-ddi-${o.id}`} value={ddi} onChange={(e) => setDdi(e.target.value)}>
            {PAISES_DDI.map((p) => <option key={p.ddi} value={p.ddi}>{p.nome}</option>)}
          </select>
        </label>
        <label htmlFor={`wa-cel-${o.id}`}>WhatsApp de {o.motorista?.nome ?? "motorista"}
          <input id={`wa-cel-${o.id}`} value={celular} onChange={(e) => setCelular(e.target.value)} inputMode="tel" placeholder={ddi === "595" ? "981 123 456" : ddi === "55" ? "45 99912 3456" : "número com código de área"} required />
        </label>
      </div>
      {valido && <small>Vai para +{numero}</small>}
      {!o.motorista?.celular && <small>Motorista sem celular no Acesso dos motoristas: digite o número.</small>}
      <label htmlFor={`wa-txt-${o.id}`}>Mensagem
        <textarea id={`wa-txt-${o.id}`} rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <button type="submit" className="oc-btn oc-wa" disabled={!valido}>Enviar no WhatsApp</button>
    </form>
  );
}
