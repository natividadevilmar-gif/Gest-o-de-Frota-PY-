import { describe, expect, it } from "vitest";
import { previstoRota, valorPraca } from "./pedagio";

const py = { id: "a", pais: "PY", rodovia: "PY02", nome: "Peaje Ypacaraí", moeda: "PYG", tarifaEixo: null, tarifaFixa: 60_000 };
const br = { id: "b", pais: "BR", rodovia: "BR-277", nome: "São José dos Pinhais", moeda: "BRL", tarifaEixo: 10.5, tarifaFixa: null };

describe("pedágio previsto", () => {
  it("cobra por eixo ou valor fixo do caminhão pesado", () => {
    expect(valorPraca(br, 6)).toBe(63);
    expect(valorPraca(py, 6)).toBe(60_000);
  });
  it("soma por moeda e em dólar", () => {
    const r = previstoRota([py, br, { ...br, id: "c", nome: "Sem tarifa", tarifaEixo: null }], 6, { USD: 1, PYG: 7500, BRL: 5 });
    expect(r.porMoeda).toEqual([{ moeda: "PYG", valor: 60_000 }, { moeda: "BRL", valor: 63 }]);
    expect(r.usd).toBe(8 + 12.6);
    expect(r.semValor).toEqual(["Sem tarifa"]);
  });
});
