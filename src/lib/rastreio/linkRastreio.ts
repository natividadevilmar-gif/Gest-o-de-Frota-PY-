// Conta do link de rastreio do destinatário: quanto falta pela rota prevista e a hora estimada de chegada.

export type PontoRota = [number, number];

/** Média de um caminhão em estrada contando paradas curtas, para a previsão de chegada. */
export const MEDIA_KMH = 60;
/** A menos disto do fim da rota o caminhão é dado como chegado. */
export const CHEGOU_KM = 2;
/** Validade do link a partir de quando é gerado. */
export const VALIDADE_DIAS = 10;

const R = 6371;
const rad = (g: number) => (g * Math.PI) / 180;
export function distKm(a: PontoRota, b: PontoRota): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rota salva no frete ([[lat, lng], ...]) ou null se não for uma lista de pontos válida. */
export function lerRota(j: unknown): PontoRota[] | null {
  if (!Array.isArray(j) || j.length < 2) return null;
  const ok = j.every((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  return ok ? j.map((p) => [Number(p[0]), Number(p[1])] as PontoRota) : null;
}

/**
 * Km que faltam: do caminhão até o ponto da rota mais perto dele e, dali, pela rota até o fim.
 * No empate fica o ponto mais adiante, para a ida e volta pelo mesmo lugar não reiniciar a conta.
 */
export function kmRestantes(caminhao: PontoRota, rota: PontoRota[]): number {
  let melhor = 0, min = Infinity;
  rota.forEach((p, i) => {
    const d = distKm(caminhao, p);
    if (d <= min) { min = d; melhor = i; }
  });
  let km = min;
  for (let i = melhor; i < rota.length - 1; i++) km += distKm(rota[i], rota[i + 1]);
  return km;
}

/** Hora estimada de chegada, ou null quando já chegou. */
export function previsaoChegada(km: number, agora: Date, mediaKmh = MEDIA_KMH): Date | null {
  if (km <= CHEGOU_KM) return null;
  return new Date(agora.getTime() + (km / mediaKmh) * 3600_000);
}
