import { describe, expect, it } from "vitest";
import { faixaDe, faixasReceber, kmPorLitroDia, inicioJanela, mediaMovel, periodoValido, porDia, porSemana, somaPor } from "./dashboard";

const hoje = new Date("2026-11-10T15:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("janela e períodos", () => {
  it("aceita só 30, 60 ou 90 dias", () => {
    expect(periodoValido("90")).toBe(90);
    expect(periodoValido("7")).toBe(30);
    expect(periodoValido(undefined)).toBe(30);
  });
  it("conta hoje como o último dia", () => {
    expect(inicioJanela(hoje, 30).toISOString().slice(0, 10)).toBe("2026-10-12");
  });
});

describe("séries", () => {
  it("soma por dia e põe zero nos dias vazios", () => {
    const s = porDia([{ data: d("2026-11-08"), valor: 100 }, { data: d("2026-11-08"), valor: 50 }, { data: d("2026-11-10"), valor: 7 }, { data: d("2026-10-01"), valor: 999 }], d("2026-11-08"), 3);
    expect(s.map((p) => p.valor)).toEqual([150, 0, 7]);
  });
  it("agrupa em semanas que terminam hoje, a primeira mais curta", () => {
    const s = porSemana([{ data: d("2026-11-10"), valor: 1000 }, { data: d("2026-11-03"), valor: 500 }, { data: d("2026-10-12"), valor: 80 }], [{ data: d("2026-11-04"), valor: 300 }], hoje, 30);
    expect(s).toHaveLength(5);
    expect(s[0].inicio.toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(s[0].fim.toISOString().slice(0, 10)).toBe("2026-10-13");
    expect(s[0].fretes).toBe(80);
    expect(s[4]).toMatchObject({ fretes: 1000, despesas: 300 });
    expect(s[3]).toMatchObject({ fretes: 500, despesas: 0 });
  });
  it("soma por chave da maior para a menor", () => {
    expect(somaPor([{ c: "A", v: 1 }, { c: "B", v: 5 }, { c: "A", v: 2 }, { c: "C", v: 0 }], (x) => x.c, (x) => x.v)).toEqual([{ nome: "B", valor: 5 }, { nome: "A", valor: 3 }]);
  });
  it("média móvel usa os dias que já existem no começo", () => {
    expect(mediaMovel([10, 20, 30, 40].map((valor, i) => ({ dia: d(`2026-11-0${i + 1}`), valor })), 3).map((p) => p.valor)).toEqual([10, 15, 20, 30]);
  });
  it("separa o que falta receber pelo vencimento", () => {
    const f = faixasReceber([
      { vencimento: d("2026-09-01"), saldo: 100 }, { vencimento: d("2026-11-01"), saldo: 200 },
      { vencimento: d("2026-11-15"), saldo: 300 }, { vencimento: d("2026-12-30"), saldo: 400 }, { vencimento: d("2026-11-15"), saldo: 0 },
    ], hoje);
    expect(f.map((x) => x.valor)).toEqual([100, 200, 300, 400]);
  });
  it("acha a faixa de cada vencimento e o km/l de cada dia", () => {
    expect(faixaDe(d("2026-11-10"), hoje)).toBe(2);
    expect(faixaDe(d("2026-11-09"), hoje)).toBe(1);
    expect(faixasReceber([{ vencimento: d("2026-11-11"), saldo: 5 }, { vencimento: d("2026-11-12"), saldo: 5 }], hoje)[2]).toMatchObject({ valor: 10, qtd: 2 });
    const k = kmPorLitroDia([{ data: d("2026-11-08"), km: 500, litros: 200 }, { data: d("2026-11-09"), km: 300, litros: null }], d("2026-11-08"), 2);
    expect(k.map((p) => p.valor)).toEqual([2.5, 0]);
  });
});
