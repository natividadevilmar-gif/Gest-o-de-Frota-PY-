// Rota prevista de um frete: acha a cidade de origem e a de destino no OpenStreetMap
// (Nominatim) e pede o caminho de caminhão entre elas ao OSRM. A central compara a
// posição do caminhão com essa linha e abre um alerta quando ele sai dela.

export type PontoRota = [number, number]; // [lat, lng]

/** Mais longe que isso da rota prevista é desvio (estradas paralelas e postos ficam dentro). */
export const DESVIO_KM = 5;
/** Perto da origem ou do destino o caminhão anda pela cidade, fora da estrada: não alerta. */
export const RAIO_CIDADE_KM = 10;

const R = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distância de um ponto até a linha da rota, em km (projeção plana local: boa para poucos km). */
export function distanciaAteRotaKm(p: { lat: number; lng: number }, rota: PontoRota[]): number {
  if (!rota.length) return Infinity;
  const kx = R * rad(1) * Math.cos(rad(p.lat));
  const ky = R * rad(1);
  const xy = ([lat, lng]: PontoRota) => [(lng - p.lng) * kx, (lat - p.lat) * ky] as const;
  let min = Infinity;
  let a = xy(rota[0]);
  if (rota.length === 1) return Math.hypot(a[0], a[1]);
  for (let i = 1; i < rota.length; i++) {
    const b = xy(rota[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / l2)) : 0;
    min = Math.min(min, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    a = b;
  }
  return min;
}

/** Fora da rota: longe da linha e longe das duas pontas (origem e destino). */
export function foraDaRota(p: { lat: number; lng: number }, rota: PontoRota[]) {
  if (rota.length < 2) return false;
  const ponta = (q: PontoRota) => distanciaAteRotaKm(p, [q]);
  if (ponta(rota[0]) <= RAIO_CIDADE_KM || ponta(rota.at(-1)!) <= RAIO_CIDADE_KM) return false;
  return distanciaAteRotaKm(p, rota) > DESVIO_KM;
}

const NOME_PAIS: Record<string, string> = { PY: "Paraguay", BR: "Brasil", AR: "Argentina", BO: "Bolivia", UY: "Uruguay", CL: "Chile" };
const AGENTE = { "User-Agent": "KMCero-GestaoDeFrota/1.0 (gestaodefrota.com.py)" };

let ultimaBusca = 0;
/** Coordenadas de uma cidade no país (Nominatim pede no máximo uma consulta por segundo). */
async function acharCidade(cidade: string, pais: string): Promise<PontoRota | null> {
  const espera = ultimaBusca + 1100 - Date.now();
  if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
  ultimaBusca = Date.now();
  const q = new URLSearchParams({ q: `${cidade}, ${NOME_PAIS[pais] ?? pais}`, format: "jsonv2", limit: "1", countrycodes: pais.toLowerCase() });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: AGENTE, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return null;
  const [j] = (await r.json()) as { lat: string; lon: string }[];
  return j ? [Number(j.lat), Number(j.lon)] : null;
}

/** Rota de estrada entre origem e destino, ou o motivo de não ter saído. */
export async function calcularRota(f: { origem: string; paisOrigem: string; destino: string; paisDestino: string }): Promise<{ rota: PontoRota[]; km: number } | { erro: string }> {
  try {
    const de = await acharCidade(f.origem, f.paisOrigem);
    if (!de) return { erro: `Cidade de origem não encontrada: ${f.origem}` };
    const ate = await acharCidade(f.destino, f.paisDestino);
    if (!ate) return { erro: `Cidade de destino não encontrada: ${f.destino}` };
    const url = `https://router.project-osrm.org/route/v1/driving/${de[1]},${de[0]};${ate[1]},${ate[0]}?overview=full&geometries=geojson`;
    const r = await fetch(url, { headers: AGENTE, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return { erro: `Serviço de rotas respondeu HTTP ${r.status}` };
    const j = (await r.json()) as { routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
    const rt = j.routes?.[0];
    if (!rt) return { erro: "Nenhuma rota de estrada entre as duas cidades." };
    return { rota: simplificar(rt.geometry.coordinates.map(([lng, lat]) => [lat, lng] as PontoRota)), km: Math.round(rt.distance / 1000) };
  } catch {
    return { erro: "Sem conexão com o serviço de rotas." };
  }
}

/** Tira pontos a menos de ~200 m um do outro: a rota fica leve e continua fiel à estrada. */
export function simplificar(rota: PontoRota[], minKm = 0.2): PontoRota[] {
  if (rota.length < 3) return rota;
  const out: PontoRota[] = [rota[0]];
  for (let i = 1; i < rota.length - 1; i++) {
    const [lat, lng] = out.at(-1)!;
    if (distanciaAteRotaKm({ lat, lng }, [rota[i]]) >= minKm) out.push([Math.round(rota[i][0] * 1e5) / 1e5, Math.round(rota[i][1] * 1e5) / 1e5]);
  }
  out.push(rota.at(-1)!);
  return out;
}
