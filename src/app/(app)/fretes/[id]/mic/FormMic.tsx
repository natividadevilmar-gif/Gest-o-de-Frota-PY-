"use client";

import { useActionState } from "react";
import { CAMPOS_MIC, type DadosMic } from "@/lib/micDta";
import { salvarMic, type ResultadoMic } from "./actions";

/** Grupos da tela, na ordem em que a gente confere o documento. */
const GRUPOS: { titulo: string; campos: (keyof DadosMic)[] }[] = [
  { titulo: "Documento", campos: ["numero", "fechaEmision", "hoja", "transito"] },
  { titulo: "Transportador", campos: ["porteador", "porteadorRuc", "permiso"] },
  { titulo: "Caminhão", campos: ["placa", "marcaNumero", "ano", "capacidad", "remolque", "propietario", "propietarioRuc"] },
  { titulo: "Percurso e aduanas", campos: ["aduanaPartida", "destinoFinal", "aduanaDestino", "rutaPlazo"] },
  { titulo: "Carga e valores", campos: ["crt", "origenMercaderias", "moneda", "valorFot", "flete", "seguro", "tipoBultos", "cantidadBultos", "pesoBruto", "precintos", "descripcion"] },
  { titulo: "Partes e documentos", campos: ["remitente", "destinatario", "consignatario", "documentosAnexos"] },
];

export function FormMic({ viagemId, dados, salvo }: { viagemId: string; dados: DadosMic; salvo: boolean }) {
  const [r, acao, enviando] = useActionState<ResultadoMic, FormData>(salvarMic.bind(null, viagemId), null);
  const campo = (k: keyof DadosMic) => CAMPOS_MIC.find((c) => c.chave === k)!;
  return (
    <form action={acao} className="mic-form">
      {GRUPOS.map((g) => (
        <fieldset key={g.titulo}>
          <legend>{g.titulo}</legend>
          <div className="mic-campos">
            {g.campos.map((k) => {
              const c = campo(k);
              const rotulo = <span><b>{c.n}</b> {c.pt}</span>;
              if (k === "transito") {
                return (
                  <label key={k}>{rotulo}
                    <select name={k} defaultValue={dados[k]}><option value="SI">Sim</option><option value="NO">Não</option></select>
                  </label>
                );
              }
              return (
                <label key={k} className={c.linhas && c.linhas > 1 ? "mic-largo" : undefined}>{rotulo}
                  {c.linhas && c.linhas > 1 ? <textarea name={k} rows={c.linhas} defaultValue={dados[k]} /> : <input name={k} defaultValue={dados[k]} />}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="form" style={{ alignItems: "center" }}>
        <button type="submit" className="pri" disabled={enviando}>{enviando ? "Salvando…" : salvo ? "Salvar alterações" : "Salvar MIC/DTA"}</button>
        {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
      </div>
    </form>
  );
}
