import { describe, expect, it } from "vitest";
import { lerPlanilhaFrota, nomeProprio, placaChave } from "./importarFrota";

describe("planilha da frota", () => {
  it("acha o cabeçalho e lê placa do caminhão, motorista e C.I.", () => {
    const r = lerPlanilhaFrota([
      [null, null, null, "SVM TRUCKS IMPORT EXPORT S.A."],
      ["Nº", "Chapa Tracto", "Chassis", "Veiculo/Marca", "Chapa Semi", "Chofer Condutor ", "C.I.", "Parque"],
      [1, "AAEA-700", "VLUR", "SCANIA 114 380", "CCA011", "ORLANDO ADRIAN MARTINEZ", 5746441, "LUFFE"],
      [2, " AAID-573", "X", "SCANIA", "AAHG532", "CANDIDO ASCONA DE JESUS ", null, "LUFFE"],
      [3, "ABBK384", "Y", "SCANIA", "AAOL191", null, null, "LUFFE"],
      [4, null, null, null, "OCE-593", null, null, null],
    ]);
    expect(r).toEqual([
      { placa: "AAEA-700", nome: "Orlando Adrian Martinez", documento: "5746441" },
      { placa: "AAID-573", nome: "Candido Ascona de Jesus", documento: null },
    ]);
  });
  it("sem coluna de motorista não lê nada", () => {
    expect(lerPlanilhaFrota([["Placa", "Modelo"], ["AAA111", "Volvo"]])).toBeNull();
  });
  it("compara placas sem hífen nem espaço", () => {
    expect(placaChave("aaea-700")).toBe(placaChave("AAEA 700"));
    expect(nomeProprio("GUILLERMO ANTONIO P. OLMEDO")).toBe("Guillermo Antonio P. Olmedo");
  });
});
