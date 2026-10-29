import { salvarPainelMdvr } from "./actions";

/**
 * Câmeras vistas no painel de fora: o do fabricante do MDVR de 4 câmeras ou o da
 * plataforma do cliente (ex.: CUSAT). Os alertas, o GPS e a CAN continuam aqui.
 */
export function PainelMdvr({ placas, url, admin }: { placas: string[]; url: string | null; admin: boolean }) {
  const cusat = !!url && /cusat/i.test(url);
  return (
    <div className="card">
      <div className="card-h">
        <h2>{cusat ? "Câmeras na CUSAT" : "4 câmeras (MDVR)"}</h2>
        {placas.length > 0 && <p>{placas.length} {placas.length === 1 ? "caminhão" : "caminhões"}: {placas.join(", ")}</p>}
      </div>
      <p>{cusat
        ? "Vídeo ao vivo e gravações das câmeras no site da CUSAT (entre com o usuário e a senha do vídeo). Lá, clique no caminhão e no ícone da câmera para ver ao vivo. O GPS e os alertas continuam aqui."
        : "Ao vivo e gravações das 4 câmeras (frente, cabine, lateral e ré ou carga) no painel do fabricante do MDVR. Os alertas, o GPS e a CAN continuam aqui, pelo rastreador."}</p>
      {url ? (
        <p><a className="oc-btn oc-video" href={url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▶</span> {cusat ? "Ver câmera na CUSAT" : "Abrir as 4 câmeras"}</a></p>
      ) : (
        <p className="note">O link do painel das câmeras será cadastrado pela KM Cero na instalação.</p>
      )}
      {admin && (
        <form action={salvarPainelMdvr} className="form">
          <label htmlFor="mdvrUrl" className="largo">Link do painel das câmeras (KM Cero)
            <input id="mdvrUrl" name="mdvrUrl" type="url" defaultValue={url ?? ""} placeholder="https://painel-do-fabricante/..." style={{ width: "100%", maxWidth: "28em" }} />
          </label>
          <button type="submit">Salvar link</button>
        </form>
      )}
    </div>
  );
}
