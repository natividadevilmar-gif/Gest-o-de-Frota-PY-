import { describe, expect, it } from "vitest";
import { datasParcelas, situacaoPagar, totaisPagar } from "./pagar";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const hoje = new Date("2026-11-10T13:00:00Z");

describe("parcelas", () => {
  it("repete o dia em cada mês e usa o último dia nos meses curtos", () => {
    expect(datasParcelas(d("2026-12-31"), 3).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-12-31", "2027-01-31", "2027-02-28"]);
    expect(datasParcelas(d("2026-11-10"), 2).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-11-10", "2026-12-10"]);
  });
});

describe("situação e totais", () => {
  it("classifica pelo vencimento", () => {
    expect(situacaoPagar(d("2026-11-09"), hoje)).toBe("vencida");
    expect(situacaoPagar(d("2026-11-10"), hoje)).toBe("hoje");
    expect(situacaoPagar(d("2026-11-17"), hoje)).toBe("semana");
    expect(situacaoPagar(d("2026-12-10"), hoje)).toBe("mes");
    expect(situacaoPagar(d("2026-12-11"), hoje)).toBe("depois");
  });
  it("soma vencido, semana, 30 dias e pago no mês", () => {
    const contas = [
      { valorUsd: 100, vencimento: d("2026-11-05"), pagoEm: null },
      { valorUsd: 200, vencimento: d("2026-11-12"), pagoEm: null },
      { valorUsd: 300, vencimento: d("2026-12-01"), pagoEm: null },
      { valorUsd: 400, vencimento: d("2027-01-01"), pagoEm: null },
      { valorUsd: 50, vencimento: d("2026-11-01"), pagoEm: d("2026-11-02") },
      { valorUsd: 70, vencimento: d("2026-10-01"), pagoEm: d("2026-10-02") },
    ];
    expect(totaisPagar(contas, hoje)).toEqual({ vencido: 100, semana: 200, trintaDias: 600, pagoNoMes: 50 });
  });
});
