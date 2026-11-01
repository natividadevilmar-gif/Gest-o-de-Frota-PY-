import { describe, expect, it } from "vitest";
import { CHEGOU_KM, distKm, kmRestantes, lerRota, previsaoChegada, type PontoRota } from "./linkRastreio";

// Asunción → Coronel Oviedo → Ciudad del Este, mais ou menos pela PY02.
const ROTA: PontoRota[] = [[-25.2828, -57.6359], [-25.4473, -56.44], [-25.5097, -54.6111]];
const total = distKm(ROTA[0], ROTA[1]) + distKm(ROTA[1], ROTA[2]);

describe("link de rastreio", () => {
  it("no começo falta a rota inteira", () => {
    expect(kmRestantes(ROTA[0], ROTA)).toBeCloseTo(total, 5);
  });

  it("no meio falta só o trecho final", () => {
    expect(kmRestantes(ROTA[1], ROTA)).toBeCloseTo(distKm(ROTA[1], ROTA[2]), 5);
  });

  it("no destino não há previsão: já chegou", () => {
    const km = kmRestantes([-25.51, -54.612], ROTA);
    expect(km).toBeLessThan(CHEGOU_KM);
    expect(previsaoChegada(km, new Date())).toBeNull();
  });

  it("previsão a 60 km/h", () => {
    const agora = new Date("2026-11-01T12:00:00Z");
    expect(previsaoChegada(120, agora)?.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("lê só rotas válidas", () => {
    expect(lerRota([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
    expect(lerRota([[1, 2]])).toBeNull();
    expect(lerRota("x")).toBeNull();
    expect(lerRota([[1, "a"], [3, 4]])).toBeNull();
  });
});
