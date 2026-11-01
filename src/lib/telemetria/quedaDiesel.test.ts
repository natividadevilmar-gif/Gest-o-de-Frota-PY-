import { describe, expect, it } from "vitest";
import { quedasDeDiesel, type PontoTanque } from "./quedaDiesel";

const t0 = Date.parse("2026-11-01T03:00:00Z");
/** Uma leitura a cada 2 minutos; `niveis` e `vels` por leitura. */
const serie = (niveis: number[], vels: number[] = []): PontoTanque[] =>
  niveis.map((n, i) => ({ data: new Date(t0 + i * 120_000), nivelCombustivelL: n, velocidadeKmh: vels[i] ?? 0, lat: -25.3, lng: -57.6 }));

describe("quedasDeDiesel", () => {
  it("acha o tanque esvaziado com o caminhão parado", () => {
    const q = quedasDeDiesel(serie([500, 501, 499, 500, 470, 440, 410, 380, 381, 379, 380, 380]));
    expect(q).toHaveLength(1);
    expect(q[0].litros).toBeGreaterThanOrEqual(110);
    expect(q[0].antesL).toBe(500);
    expect(q[0].depoisL).toBe(380);
  });

  it("ignora uma leitura falsa isolada", () => {
    expect(quedasDeDiesel(serie([500, 500, 500, 300, 500, 500, 500, 500]))).toEqual([]);
  });

  it("ignora o consumo normal rodando", () => {
    const niveis = Array.from({ length: 20 }, (_, i) => 500 - i * 5);
    expect(quedasDeDiesel(serie(niveis, niveis.map(() => 80)))).toEqual([]);
  });

  it("ignora queda pequena (balanço, marcha lenta)", () => {
    expect(quedasDeDiesel(serie([500, 498, 495, 490, 488, 486, 485, 484]))).toEqual([]);
  });

  it("ignora abastecimento (nível subindo)", () => {
    expect(quedasDeDiesel(serie([200, 200, 260, 330, 400, 480, 480, 480, 480]))).toEqual([]);
  });

  it("não alerta antes de as leituras seguintes confirmarem", () => {
    expect(quedasDeDiesel(serie([500, 500, 500, 500, 400]))).toEqual([]);
  });
});
