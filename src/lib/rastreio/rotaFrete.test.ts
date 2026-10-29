import { describe, expect, it } from "vitest";
import { distanciaAteRotaKm, foraDaRota, simplificar, type PontoRota } from "./rotaFrete";

// Uma estrada reta de leste a oeste, de Ciudad del Este para Santa Rita (~ 0,9° de longitude).
const rota: PontoRota[] = [[-25.5, -54.6], [-25.5, -55.0], [-25.5, -55.5]];

describe("rota do frete", () => {
  it("mede a distância até a estrada, não só até os pontos", () => {
    expect(distanciaAteRotaKm({ lat: -25.5, lng: -54.8 }, rota)).toBeLessThan(0.01);
    // 0,1° de latitude ≈ 11 km.
    expect(distanciaAteRotaKm({ lat: -25.6, lng: -54.8 }, rota)).toBeCloseTo(11.1, 0);
  });
  it("é desvio só longe da estrada e longe da origem e do destino", () => {
    expect(foraDaRota({ lat: -25.52, lng: -54.8 }, rota)).toBe(false); // 2 km: estrada paralela
    expect(foraDaRota({ lat: -25.6, lng: -54.8 }, rota)).toBe(true); // 11 km fora
    expect(foraDaRota({ lat: -25.56, lng: -54.62 }, rota)).toBe(false); // na cidade de origem
  });
  it("simplifica sem perder as pontas", () => {
    const densa: PontoRota[] = Array.from({ length: 1001 }, (_, i) => [-25.5, -54.6 - i * 0.0009]);
    const s = simplificar(densa);
    expect(s.length).toBeLessThan(500);
    expect(s[0]).toEqual(densa[0]);
    expect(s.at(-1)).toEqual(densa.at(-1));
  });
});
