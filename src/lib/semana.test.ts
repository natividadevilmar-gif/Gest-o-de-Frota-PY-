import { describe, expect, it } from "vitest";
import { resumirSemana, segundaDaSemana, semanaPassada, type LinhaCaminhao } from "./semana";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("semana", () => {
  it("segunda-feira da semana", () => {
    expect(segundaDaSemana(d("2026-11-01")).toISOString().slice(0, 10)).toBe("2026-10-26"); // domingo
    expect(segundaDaSemana(d("2026-11-02")).toISOString().slice(0, 10)).toBe("2026-11-02"); // segunda
    expect(segundaDaSemana(d("2026-11-04")).toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("semana passada vai de segunda a segunda", () => {
    const s = semanaPassada(d("2026-11-04"));
    expect(s.inicio.toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(s.fim.toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("totais, km/l e melhor e pior motorista", () => {
    const l = (id: string, km: number, litrosCan: number | null, abast: number, exc: number, mot: string | null = id): LinhaCaminhao =>
      ({ id, placa: id.toUpperCase(), motorista: mot, km, litrosCan, litrosAbastecidos: abast, excessos: exc, freadas: 0 });
    const r = resumirSemana([l("a", 1000, 400, 0, 2), l("b", 2000, null, 800, 30), l("c", 50, null, 0, 0), l("d", 0, null, 0, 0, null)]);
    expect(r.km).toBe(3050);
    expect(r.litros).toBe(1200);
    expect(r.kmL).toBeCloseTo(2.5);
    expect(r.rodaram).toBe(3);
    expect(r.melhor?.id).toBe("a");
    expect(r.pior?.id).toBe("b");
    expect(r.caminhoes[0].id).toBe("b");
  });
});
