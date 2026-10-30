// Praças de pedágio de uma rota pelo OpenStreetMap (Overpass): as cabines (barrier=toll_booth,
// highway=toll_gantry) ao lado da estrada da rota. Cada praça achada é ligada à do cadastro mais
// perto (que tem a tarifa); a que não está no cadastro entra sem tarifa, para a KM Cero completar.

import { distanciaAteRotaKm, type PontoRota } from "./rotaFrete";

export type Cabine = { lat: number; lng: number; nome: string | null; rodovia: string | null };
type PracaCadastro = { id: string; lat: number; lng: number };

/** Cabine a até 700 m da linha da rota conta como do caminho (as duas pistas e a praça larga). */
export const RAIO_CABINE_KM = 0.7;
/** Cabines a menos de 2 km uma da outra são a mesma praça. */
const MESMA_PRACA_KM = 2;
/** Praça do cadastro até 25 km da cabine é a mesma (as coordenadas do cadastro são aproximadas). */
export const CASAR_KM = 25;

const AGENTE = { "User-Agent": "KMCero-GestaoDeFrota/1.0 (gestaodefrota.com.py)" };

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return distanciaAteRotaKm(a, [[b.lat, b.lng]]);
}

/** Pontos da rota a cada ~1,5 km, para a busca "perto da linha" do Overpass. */
function amostrar(rota: PontoRota[], passoKm = 1.5): PontoRota[] {
  if (rota.length < 2) return rota;
  const out: PontoRota[] = [rota[0]];
  for (const p of rota.slice(1)) {
    const [lat, lng] = out.at(-1)!;
    if (distKm({ lat, lng }, { lat: p[0], lng: p[1] }) >= passoKm) out.push(p);
  }
  if (out.at(-1) !== rota.at(-1)) out.push(rota.at(-1)!);
  return out;
}

/** Posição ao longo da rota (índice do ponto mais perto), para pôr as praças na ordem da ida. */
export function posicaoNaRota(p: { lat: number; lng: number }, rota: PontoRota[]): number {
  let melhor = 0, min = Infinity;
  rota.forEach(([lat, lng], i) => {
    const d = distKm(p, { lat, lng });
    if (d < min) { min = d; melhor = i; }
  });
  return melhor;
}

/** Junta as cabines de uma mesma praça (várias cabines, as duas pistas) num ponto só. */
export function agruparCabines(cabines: Cabine[]): Cabine[] {
  const grupos: Cabine[][] = [];
  for (const c of cabines) {
    const g = grupos.find((x) => x.some((y) => distKm(c, y) < MESMA_PRACA_KM));
    if (g) g.push(c); else grupos.push([c]);
  }
  return grupos.map((g) => ({
    lat: g.reduce((a, c) => a + c.lat, 0) / g.length,
    lng: g.reduce((a, c) => a + c.lng, 0) / g.length,
    nome: g.find((c) => c.nome)?.nome ?? null,
    rodovia: g.find((c) => c.rodovia)?.rodovia ?? null,
  }));
}

/**
 * Liga cada praça achada no mapa à do cadastro mais perto (até CASAR_KM, cada uma usada uma vez,
 * os pares mais próximos primeiro). Devolve as ligações e as praças que não estão no cadastro.
 */
export function casarComCadastro(achadas: Cabine[], cadastro: PracaCadastro[], raioKm = CASAR_KM) {
  const pares = achadas.flatMap((c, i) => cadastro.map((p) => ({ i, id: p.id, d: distKm(c, p) }))).filter((x) => x.d <= raioKm).sort((a, b) => a.d - b.d);
  const ligadas = new Map<number, string>();
  const usadas = new Set<string>();
  for (const x of pares) {
    if (ligadas.has(x.i) || usadas.has(x.id)) continue;
    ligadas.set(x.i, x.id);
    usadas.add(x.id);
  }
  return {
    ligadas: [...ligadas].map(([i, id]) => ({ id, cabine: achadas[i] })),
    novas: achadas.filter((_, i) => !ligadas.has(i)),
  };
}

/** Praças de pedágio no caminho, pelo Overpass; null quando o serviço não respondeu. */
export async function cabinesNaRota(rota: PontoRota[]): Promise<Cabine[] | null> {
  const pts = amostrar(rota);
  if (pts.length < 2) return [];
  const linha = pts.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(",");
  const raio = Math.round(RAIO_CABINE_KM * 1000);
  const q = `[out:json][timeout:25];(node(around:${raio},${linha})["barrier"="toll_booth"];node(around:${raio},${linha})["highway"="toll_gantry"];);out;`;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { ...AGENTE, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { elements?: { lat: number; lon: number; tags?: Record<string, string> }[] };
    const cabines = (j.elements ?? []).map((e) => ({ lat: e.lat, lng: e.lon, nome: e.tags?.name ?? null, rodovia: e.tags?.ref ?? null }));
    return agruparCabines(cabines).sort((a, b) => posicaoNaRota(a, rota) - posicaoNaRota(b, rota));
  } catch {
    return null;
  }
}
