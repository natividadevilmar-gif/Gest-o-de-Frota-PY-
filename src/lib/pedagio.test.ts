import { describe, expect, it } from "vitest";
import { passagensPedagio, previstoRota, valorPraca } from "./pedagio";

const py = { id: "a", pais: "PY", rodovia: "PY02", nome: "Peaje Ypacaraí", moeda: "PYG", tarifaEixo: null, tarifaFixa: 60_000 };
const br = { id: "b", pais: "BR", rodovia: "BR-277", nome: "São José dos Pinhais", moeda: "BRL", tarifaEixo: 10.5, tarifaFixa: null };

describe("pedágio previsto", () => {
  it("cobra por eixo ou valor fixo do caminhão pesado", () => {
    expect(valorPraca(br, 6)).toBe(63);
    expect(valorPraca(py, 6)).toBe(60_000);
    expect(valorPraca(py, 9)).toBe(60_000);
    expect(valorPraca(br, 9)).toBe(94.5);
  });
  it("soma por moeda e em dólar", () => {
    const r = previstoRota([py, br, { ...br, id: "c", nome: "Sem tarifa", tarifaEixo: null }], 6, { USD: 1, PYG: 7500, BRL: 5 });
    expect(r.porMoeda).toEqual([{ moeda: "PYG", valor: 60_000 }, { moeda: "BRL", valor: 63 }]);
    expect(r.usd).toBe(8 + 12.6);
    expect(r.semValor).toEqual(["Sem tarifa"]);
  });
});

describe("passagens pelas praças", () => {
  const t = (min: number) => new Date(Date.UTC(2026, 9, 25, 12, min));
  const praca = { id: "ypa", lat: -25.405, lng: -57.283 };
  it("acha a praça entre dois pontos espaçados e conta a volta", () => {
    const ida = [{ lat: -25.39, lng: -57.35, data: t(0) }, { lat: -25.39, lng: -57.14, data: t(20) }, { lat: -25.42, lng: -56.88, data: t(40) }];
    const volta = [...ida].reverse().map((p, i) => ({ ...p, data: t(60 + i * 20) }));
    const r = passagensPedagio([...ida, ...volta], [praca]);
    expect(r.map((x) => x.pracaId)).toEqual(["ypa", "ypa"]);
    expect(r[0].data.getTime()).toBeGreaterThan(t(0).getTime());
    expect(r[0].data.getTime()).toBeLessThan(t(20).getTime());
  });
  it("ignora trilha longe da praça", () => {
    expect(passagensPedagio([{ lat: -25.0, lng: -57.0, data: t(0) }, { lat: -25.0, lng: -56.9, data: t(10) }], [praca])).toEqual([]);
  });
});
