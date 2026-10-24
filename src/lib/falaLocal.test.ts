import { describe, expect, it } from "vitest";
import { lerFalaLocal } from "./falaLocal";

describe("fala sem a Claude API", () => {
  it("entende valor com mil e moeda", () => {
    expect(lerFalaLocal("Pedágio 45 mil guaranis")).toEqual({ categoria: "PEDAGIO", valor: 45000, moeda: "PYG", litros: null });
  });
  it("separa litros do valor", () => {
    expect(lerFalaLocal("diesel 300 litros 2.145.000")).toMatchObject({ categoria: "DIESEL", valor: 2145000, litros: 300 });
  });
  it("entende milhões e meio por extenso", () => {
    expect(lerFalaLocal("manutenção dois milhões e meio")).toMatchObject({ categoria: "MANUTENCAO", valor: 2_500_000 });
  });
  it("pesos argentinos com centavos", () => {
    expect(lerFalaLocal("almoço 12.500,50 pesos")).toMatchObject({ categoria: "ALIMENTACAO", valor: 12500.5, moeda: "ARS" });
  });
  it("borracharia em dólares", () => {
    expect(lerFalaLocal("borracharia 120 dólares")).toMatchObject({ categoria: "PNEUS", valor: 120, moeda: "USD" });
  });
  it("só o valor", () => {
    expect(lerFalaLocal("85000")).toMatchObject({ categoria: "OUTROS", valor: 85000, moeda: null });
  });
});
