import { salvarPainelMdvr } from "./actions";

/** Caminhões com MDVR de 4 câmeras: vídeo ao vivo e gravações no painel do fabricante. */
export function PainelMdvr({ placas, url, admin }: { placas: string[]; url: string | null; admin: boolean }) {
  return (
    <div className="card">
      <div className="card-h"><h2>4 câmeras (MDVR)</h2><p>{placas.length} {placas.length === 1 ? "caminhão" : "caminhões"}: {placas.join(", ")}</p></div>
      <p>Ao vivo e gravações das 4 câmeras (frente, cabine, lateral e ré ou carga) no painel do fabricante do MDVR. Os alertas, o GPS e a CAN continuam aqui, pelo rastreador.</p>
      {url ? (
        <p><a className="oc-btn oc-video" href={url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> Abrir as 4 câmeras</a></p>
      ) : (
        <p className="note">O link do painel das câmeras será cadastrado pela KM Cero na instalação.</p>
      )}
      {admin && (
        <form action={salvarPainelMdvr} className="form">
          <label htmlFor="mdvrUrl" className="largo">Link do painel do MDVR (KM Cero)
            <input id="mdvrUrl" name="mdvrUrl" type="url" defaultValue={url ?? ""} placeholder="https://painel-do-fabricante/..." style={{ minWidth: "28em" }} />
          </label>
          <button type="submit">Salvar link</button>
        </form>
      )}
    </div>
  );
}
