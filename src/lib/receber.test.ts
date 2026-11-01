import { describe, expect, it } from "vitest";
import { agruparPorCliente, diasParaVencer, mensagemCobranca, saldo, situacao, totaisReceber, type FreteAReceber } from "./receber";

const hoje = new Date("2026-11-10T15:00:00Z");
const f = (o: Partial<FreteAReceber>): FreteAReceber => ({
  id: "x", embarcador: "Coop A", data: new Date("2026-10-20T00:00:00Z"), vencimento: null, freteUsd: 1000, recebido: false, recebidoUsd: 0,
  origem: "Santa Rita", destino: "Paranaguá", documento: null, placa: "AAA 111", ...o,
});

describe("saldo e vencimento", () => {
  it("desconta o recebido em parte e zera o marcado como recebido", () => {
    expect(saldo(f({ recebidoUsd: 400 }))).toBe(600);
    expect(saldo(f({ recebidoUsd: 400, recebido: true }))).toBe(0);
    expect(saldo(f({ recebidoUsd: 1200 }))).toBe(0);
  });
  it("conta os dias pelo vencimento ou, sem ele, 30 dias depois do frete", () => {
    expect(diasParaVencer(f({ vencimento: new Date("2026-11-13T00:00:00Z") }), hoje)).toBe(3);
    expect(diasParaVencer(f({}), hoje)).toBe(9);
    expect(situacao(f({ vencimento: new Date("2026-11-05T00:00:00Z") }), hoje)).toEqual({ tipo: "vencido", dias: 5 });
    expect(situacao(f({ vencimento: new Date("2026-11-10T00:00:00Z") }), hoje).tipo).toBe("hoje");
    expect(situacao(f({ vencimento: new Date("2026-11-30T00:00:00Z") }), hoje).tipo).toBe("aberto");
  });
});

describe("agrupar por cliente", () => {
  const fretes = [
    f({ id: "1", embarcador: "Coop A", vencimento: new Date("2026-11-01T00:00:00Z"), freteUsd: 500 }),
    f({ id: "2", embarcador: "Coop A", vencimento: new Date("2026-11-20T00:00:00Z"), freteUsd: 300 }),
    f({ id: "3", embarcador: "Cargill", vencimento: new Date("2026-11-12T00:00:00Z"), freteUsd: 2000 }),
    f({ id: "4", embarcador: "Cargill", recebido: true }),
    f({ id: "5", embarcador: " ", vencimento: new Date("2026-11-09T00:00:00Z"), freteUsd: 100, recebidoUsd: 40 }),
  ];
  const g = agruparPorCliente(fretes, hoje);
  it("põe o mais atrasado primeiro e soma o vencido", () => {
    expect(g.map((x) => x.embarcador)).toEqual(["Coop A", "Sem cliente informado", "Cargill"]);
    expect(g[0]).toMatchObject({ saldo: 800, vencido: 500, maiorAtraso: 9 });
    expect(g[2].fretes).toHaveLength(1);
  });
  it("totaliza o que falta receber", () => {
    expect(totaisReceber(g)).toEqual({ total: 2860, vencido: 560, semana: 2000, fretes: 4 });
  });
  it("monta a cobrança com cada frete", () => {
    const m = mensagemCobranca(g[0], "SVM Trucks");
    expect(m).toContain("Buen día, Coop A.");
    expect(m).toContain("(9 días de atraso)");
    expect(m).toContain("Total: USD 800,00");
  });
});
