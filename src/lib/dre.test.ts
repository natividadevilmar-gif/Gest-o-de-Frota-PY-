import { describe, expect, it } from "vitest";
import { linhaDre, totalDre } from "./dre";

const comp = { Combustível: 3000, Alimentação: 200, Pedágio: 100, Manutenção: 300, Borracharia: 0, Outros: 50, Motorista: 1200, Seguro: 300, Depreciação: 900 };

describe("DRE", () => {
  const a = linhaDre({ id: "a", placa: "AAA 111", km: 9000, composicao: comp }, { receita: 8000, extras: 150, fretes: 4 });
  const b = linhaDre({ id: "b", placa: "BBB 222", km: 0, composicao: { Motorista: 1200, Seguro: 300, Depreciação: 900 } }, { receita: 0, extras: 0, fretes: 0 });
  it("separa custo variável, contribuição, fixo e resultado do caminhão", () => {
    expect(a).toMatchObject({ totalVariavel: 3800, contribuicao: 4200, totalFixo: 2400, resultado: 1800, margemPct: 22.5 });
    expect(b).toMatchObject({ resultado: -2400, margemPct: null });
  });
  it("tira as despesas administrativas do resultado da frota", () => {
    expect(totalDre([a, b], 500)).toMatchObject({ receita: 8000, resultadoFrota: -600, administrativas: 500, liquido: -1100, margemPct: -13.7 });
  });
});
