import "server-only";

// Nome do lugar (rua ou estrada, cidade) de um ponto, pelo OpenStreetMap (Nominatim).
// Guardado em memória: o mesmo ponto não é perguntado de novo, e o serviço pede no máximo
// uma consulta por segundo.

const cache = new Map<string, string | null>();
let ultima = 0;

type Endereco = Record<string, string | undefined>;

export function descreverEndereco(a: Endereco): string | null {
  const via = a.road ?? a.highway ?? a.pedestrian;
  const cidade = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb;
  const regiao = a.state ?? a.county;
  const partes = [via, cidade, cidade ? undefined : regiao].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

export async function nomeDoLocal(lat: number, lng: number): Promise<string | null> {
  const chave = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(chave)) return cache.get(chave)!;
  const espera = ultima + 1100 - Date.now();
  if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
  ultima = Date.now();
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=es,pt&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "KMCero-GestaoDeFrota/1.0 (gestaodefrota.com.py)" }, signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: Endereco };
    const nome = j.address ? descreverEndereco(j.address) : null;
    if (cache.size > 5000) cache.clear();
    cache.set(chave, nome);
    return nome;
  } catch {
    return null;
  }
}
