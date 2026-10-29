import { describe, expect, it } from "vitest";
import { ehImei, relatorioDoDia, resumirDia, saidaDoDia, type PontoDia } from "./posicoes";

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

describe("relatório do dia (como o do Wialon)", () => {
  it("separa o diesel gasto parado do gasto em viagem", () => {
    const r = relatorioDoDia([
      ponto(0, { odometroKm: 1000, litrosTotal: 500, velocidadeKmh: 0, nivelCombustivelL: 300 }),
      ponto(10, { litrosTotal: 502, velocidadeKmh: 0 }),
      ponto(15, { litrosTotal: 503, velocidadeKmh: 60 }),
      ponto(75, { odometroKm: 1060, litrosTotal: 523, velocidadeKmh: 70 }),
      ponto(80, { odometroKm: 1060, litrosTotal: 523, velocidadeKmh: 0, ignicao: false, nivelCombustivelL: 280 }),
    ])!;
    expect(r).toMatchObject({
      km: 60, litrosTotal: 23, litrosParado: 2, litrosViagem: 21, kmL: 2.86, l100km: 35,
      nivelInicialL: 300, nivelFinalL: 280, odometroFinalKm: 1060, velocidadeMax: 70, velocidadeMedia: 55,
    });
    // Motor ligado de 0 a 80 min; andando de 15 a 75 min (60 km em 1 h, mais 5 min a 70 km/h até parar).
    expect(r.horasMotorS).toBe(80 * 60);
  });
  it("sem CAN deixa o diesel vazio", () => {
    const r = relatorioDoDia([ponto(0, { lat: -25.0 }), ponto(10, { lat: -25.1 })])!;
    expect(r.litrosTotal).toBeNull();
    expect(r.kmL).toBeNull();
    expect(r.nivelInicialL).toBeNull();
  });
});

describe("saída do dia", () => {
  const p = (min: number, v: number) => ({ data: new Date(Date.UTC(2026, 9, 29, 3, min)), velocidadeKmh: v });
  it("é o primeiro ponto andando, não o primeiro sinal da madrugada", () => {
    expect(saidaDoDia([p(0, 0), p(30, 3), p(200, 0), p(245, 12), p(250, 60)])?.data).toEqual(p(245, 12).data);
  });
  it("sem andar, não tem saída", () => {
    expect(saidaDoDia([p(0, 0), p(10, 4)])).toBeNull();
  });
});
