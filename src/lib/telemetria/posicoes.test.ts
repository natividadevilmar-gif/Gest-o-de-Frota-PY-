import { describe, expect, it } from "vitest";
import { ehImei, resumirDia, type PontoDia } from "./posicoes";

const t0 = new Date("2026-10-25T10:00:00Z").getTime();
const ponto = (min: number, x: Partial<PontoDia>): PontoDia => ({
  data: new Date(t0 + min * 60_000), lat: -25.3, lng: -57.5, velocidadeKmh: 60, ignicao: true,
  odometroKm: null, litrosTotal: null, rpm: 1400, evento: null, ...x,
});

describe("resumo do dia a partir das posições", () => {
  it("usa odômetro e combustível da CAN e conta eventos", () => {
    const d = resumirDia([
      ponto(0, { odometroKm: 1000, litrosTotal: 500, velocidadeKmh: 0 }),
      ponto(1, { velocidadeKmh: 70 }),
      ponto(2, { velocidadeKmh: 90, rpm: 2000 }),
      ponto(3, { velocidadeKmh: 60, evento: "freada" }),
      ponto(4, { odometroKm: 1250.5, litrosTotal: 600.25, velocidadeKmh: 0, ignicao: false }),
    ], 990)!;
    expect(d).toEqual({ km: 250.5, litrosCan: 100.3, odometroKm: 1251, marchaLentaPct: 25, excessosVelocidade: 1, frenagensBruscas: 1, rpmAltoPct: 25 });
  });
  it("sem CAN, soma a distância pelo GPS", () => {
    const d = resumirDia([ponto(0, { lat: -25.0 }), ponto(10, { lat: -25.1 })], 5000)!;
    expect(d.km).toBeCloseTo(11.1, 0);
    expect(d.litrosCan).toBeNull();
    expect(d.odometroKm).toBe(5011);
  });
  it("reconhece o IMEI do aparelho", () => {
    expect(ehImei("356307042441013")).toBe(true);
    expect(ehImei("SIM-AAFR218")).toBe(false);
  });
});
