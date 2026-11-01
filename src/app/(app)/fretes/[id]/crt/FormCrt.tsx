"use client";

import { useActionState } from "react";
import { CAMPOS_CRT, type DadosCrt } from "@/lib/crt";
import { salvarCrt, type ResultadoCrt } from "./actions";

/** Grupos da tela, na ordem em que a gente confere o documento. */
const GRUPOS: { titulo: string; campos: (keyof DadosCrt)[] }[] = [
  { titulo: "Documento", campos: ["numero", "fechaEmision", "lugarEmision"] },
  { titulo: "Transportador", campos: ["porteador", "permiso", "porteadoresSucesivos"] },
  { titulo: "Remetente e destinatário", campos: ["remitente", "destinatario", "consignatario", "notificar"] },
  { titulo: "Percurso", campos: ["lugarCarga", "lugarEntrega"] },
  { titulo: "Mercadoria", campos: ["descripcion", "pesoBruto", "pesoNeto", "volumen", "valor", "incoterm", "moneda", "declaracionValor"] },
  { titulo: "Frete e despesas", campos: ["flete", "seguro", "otros", "pagador", "fleteExterno", "reembolso"] },
  { titulo: "Alfândega e observações", campos: ["documentosAnexos", "instruccionesAduana", "observaciones"] },
];

export function FormCrt({ viagemId, dados, salvo }: { viagemId: string; dados: DadosCrt; salvo: boolean }) {
  const [r, acao, enviando] = useActionState<ResultadoCrt, FormData>(salvarCrt.bind(null, viagemId), null);
  const campo = (k: keyof DadosCrt) => CAMPOS_CRT.find((c) => c.chave === k)!;
  return (
    <form action={acao} className="mic-form">
      {GRUPOS.map((g) => (
        <fieldset key={g.titulo}>
          <legend>{g.titulo}</legend>
          <div className="mic-campos">
            {g.campos.map((k) => {
              const c = campo(k);
              const rotulo = <span><b>{c.n}</b> {c.pt}</span>;
              if (k === "pagador") {
                return (
                  <label key={k}>{rotulo}
                    <select name={k} defaultValue={dados[k]}><option value="REMITENTE">Remetente</option><option value="DESTINATARIO">Destinatário</option></select>
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
        <button type="submit" className="pri" disabled={enviando}>{enviando ? "Salvando…" : salvo ? "Salvar alterações" : "Salvar CRT"}</button>
        {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
      </div>
    </form>
  );
}
