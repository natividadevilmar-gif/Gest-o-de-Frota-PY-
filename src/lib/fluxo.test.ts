import { describe, expect, it } from "vitest";
import { projetarFluxo } from "./fluxo";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const hoje = new Date("2026-11-10T15:00:00Z");

describe("projetarFluxo", () => {
  const f = projetarFluxo({
    saldoInicial: 1000,
    hoje,
    entradas: [
      { data: d("2026-11-12"), valor: 500 },
      { data: d("2026-11-20"), valor: 800 },
      { data: d("2026-11-01"), valor: 300 },
      { data: d("2027-06-01"), valor: 999 },
    ],
    saidas: [
      { data: d("2026-11-05"), valor: 200 },
      { data: d("2026-11-18"), valor: 1500 },
    ],
    despesaDiaria: 10,
    semanas: 4,
  });
  it("põe cada movimento na sua semana; conta vencida entra já, frete vencido fica à parte", () => {
    expect(f.semanas.map((s) => [s.entradas, s.contas, s.despesas])).toEqual([[500, 200, 70], [800, 1500, 70], [0, 0, 70], [0, 0, 70]]);
    expect(f.atrasado).toBe(300);
  });
  it("acumula o saldo e acha a semana mais apertada", () => {
    expect(f.semanas.map((s) => s.saldo)).toEqual([1230, 460, 390, 320]);
    expect(f.menor.saldo).toBe(320);
    expect(f.primeiroNegativo).toBeNull();
    expect(f.d30).toEqual({ entradas: 1300, saidas: 1980, saldo: 320 });
  });
});

describe("fretes futuros", () => {
  it("entram depois do prazo de recebimento", () => {
    const f = projetarFluxo({ saldoInicial: 0, hoje, entradas: [], saidas: [], despesaDiaria: 0, receitaDiaria: 100, prazoRecebimentoDias: 14, semanas: 4 });
    expect(f.semanas.map((s) => s.futuros)).toEqual([0, 0, 700, 700]);
    expect(f.d30.entradas).toBe(1400);
  });
  it("aponta a primeira semana negativa", () => {
    const f = projetarFluxo({ saldoInicial: 100, hoje, entradas: [], saidas: [{ data: d("2026-11-20"), valor: 300 }], despesaDiaria: 0, semanas: 3 });
    expect(f.primeiroNegativo?.inicio.toISOString().slice(0, 10)).toBe("2026-11-17");
  });
});
