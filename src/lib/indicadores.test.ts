import { describe, expect, it } from "vitest";
import {
  comparacaoReferenciaPct,
  composicaoCusto,
  consumoPorAbastecimento,
  custoPorKm,
  custoTotal,
  desvioCombustivelPct,
  freteMinimoPorTonelada,
  fracaoMes,
  intervaloMes,
  kmPorLitro,
  litrosExcedentes,
  margemViagem,
  mensalidadeTotal,
  planoPermite,
  situacaoPagamento,
  statusRevisao,
  suspeitaDesvio,
} from "./indicadores";

const hoje = new Date("2026-10-23T12:00:00Z");

describe("planos", () => {
  it("libera módulos conforme o plano", () => {
    expect(planoPermite("BASICO", "painel")).toBe(true);
    expect(planoPermite("BASICO", "custos")).toBe(false);
    expect(planoPermite("GESTAO", "custos")).toBe(true);
    expect(planoPermite("GESTAO", "video")).toBe(false);
    expect(planoPermite("VIDEO", "video")).toBe(true);
  });

  it("soma a mensalidade pelos preços do plano de negócio", () => {
    expect(mensalidadeTotal(["BASICO", "GESTAO", "VIDEO", "VIDEO"])).toBe(16 + 28 + 52 + 52);
  });
});

describe("custo por km", () => {
  it("soma custos variáveis e fixos e divide pelo km", () => {
    const total = custoTotal({
      variaveis: [
        { categoria: "DIESEL", valorUsd: 3500 },
        { categoria: "PNEUS", valorUsd: 380 },
        { categoria: "MANUTENCAO", valorUsd: 420 },
      ],
      salarioMotorista: 1125,
      seguroMensal: 260,
      depreciacaoMensal: 1250,
    });
    expect(total).toBe(6935);
    expect(custoPorKm(total, 9420)).toBeCloseTo(0.7362, 4);
  });

  it("não divide por zero quando o caminhão não rodou", () => {
    expect(custoPorKm(1000, 0)).toBeNull();
  });
});

describe("consumo", () => {
  it("calcula km/l e compara com a referência do modelo", () => {
    const kml = kmPorLitro(10150, 4180)!;
    expect(kml).toBeCloseTo(2.428, 3);
    expect(comparacaoReferenciaPct(kml, 2.5)).toBeCloseTo(-2.87, 2);
    expect(litrosExcedentes(10150, 4180, 2.5)).toBeCloseTo(120, 0);
  });

  it("alerta desvio acima de 3% entre abastecido e consumido", () => {
    const d = desvioCombustivelPct(4420, 4180);
    expect(d).toBeCloseTo(5.74, 2);
    expect(suspeitaDesvio(d)).toBe(true);
    expect(suspeitaDesvio(desvioCombustivelPct(3560, 3540))).toBe(false);
    expect(desvioCombustivelPct(100, null)).toBeNull();
  });
});

describe("revisões", () => {
  it("avisa com 1.000 km de antecedência", () => {
    const item = { gatilho: "KM" as const, intervaloKm: 30000, ultimoKm: 385000 };
    expect(statusRevisao(item, 412380, hoje)).toMatchObject({ situacao: "em_dia", kmRestantes: 2620 });
    expect(statusRevisao(item, 414100, hoje)).toMatchObject({ situacao: "proxima", kmRestantes: 900 });
    expect(statusRevisao(item, 415200, hoje)).toMatchObject({ situacao: "vencida", kmRestantes: -200 });
  });

  it("trata vencimento por data", () => {
    expect(statusRevisao({ gatilho: "DATA", vencimento: new Date("2026-10-19") }, 0, hoje)).toMatchObject({
      situacao: "vencida",
      diasRestantes: -4,
    });
    expect(statusRevisao({ gatilho: "DATA", vencimento: new Date("2026-11-02") }, 0, hoje).situacao).toBe("proxima");
    expect(statusRevisao({ gatilho: "DATA", vencimento: new Date("2027-01-15") }, 0, hoje).situacao).toBe("em_dia");
  });

  it("falha ativa fica vencida até ser resolvida", () => {
    expect(statusRevisao({ gatilho: "FALHA", resolvido: false }, 0, hoje).situacao).toBe("vencida");
    expect(statusRevisao({ gatilho: "FALHA", resolvido: true }, 0, hoje).situacao).toBe("em_dia");
  });
});

describe("viagens", () => {
  it("inclui o retorno vazio no custo", () => {
    const m = margemViagem(960, 520, 520, 0.81);
    expect(m.kmTotal).toBe(1040);
    expect(m.custoUsd).toBeCloseTo(842.4, 1);
    expect(m.margemUsd).toBeCloseTo(117.6, 1);
    expect(m.margemPct).toBeCloseTo(12.25, 2);
  });

  it("calcula o frete mínimo por tonelada", () => {
    expect(freteMinimoPorTonelada(30, 480, 480, 0.76)).toBeCloseTo(24.32, 2);
    expect(freteMinimoPorTonelada(0, 480, 480, 0.76)).toBeNull();
  });
});

describe("cobrança", () => {
  it("bloqueia depois de 15 dias de atraso", () => {
    expect(situacaoPagamento(0)).toBe("em_dia");
    expect(situacaoPagamento(9)).toBe("atrasado");
    expect(situacaoPagamento(15)).toBe("atrasado");
    expect(situacaoPagamento(16)).toBe("bloqueado");
  });
});

describe("intervaloMes", () => {
  it("vai do dia 1 ao dia 1 do mês seguinte", () => {
    const { inicio, fim } = intervaloMes("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("fracaoMes", () => {
  it("rateia o mês em andamento pelos dias completos", () => {
    expect(fracaoMes("2026-10", hoje)).toBeCloseTo(22 / 31, 6);
    expect(fracaoMes("2026-09", hoje)).toBe(1);
    expect(fracaoMes("2026-11", hoje)).toBe(0);
  });
});

describe("combustível", () => {
  it("soma diesel e Arla 32 em Combustível", () => {
    const c = composicaoCusto({
      variaveis: [
        { categoria: "DIESEL", valorUsd: 1000 },
        { categoria: "ARLA32", valorUsd: 40 },
      ],
      salarioMotorista: 0,
      seguroMensal: 0,
      depreciacaoMensal: 0,
    });
    expect(c["Combustível"]).toBe(1040);
  });

  it("mede km/l entre dois tanques cheios", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const r = consumoPorAbastecimento([
      { data: d("2026-10-01"), litros: 300, odometroKm: 100000, tanqueCheio: true },
      { data: d("2026-10-03"), litros: 200, odometroKm: 100500, tanqueCheio: false },
      { data: d("2026-10-05"), litros: 300, odometroKm: 101250, tanqueCheio: true },
      { data: d("2026-10-07"), litros: 250, odometroKm: null, tanqueCheio: true },
    ]);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeNull();
    expect(r[2]).toBeCloseTo(1250 / 500, 6);
    expect(r[3]).toBeNull();
  });

  it("descarta km/l impossível por odômetro digitado errado", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const r = consumoPorAbastecimento([
      { data: d("2026-10-01"), litros: 300, odometroKm: 100000, tanqueCheio: true },
      { data: d("2026-10-05"), litros: 300, odometroKm: 190000, tanqueCheio: true },
    ]);
    expect(r[1]).toBeNull();
  });
});

import { paraUsd } from "./cambio";

describe("câmbio", () => {
  it("converte guaranis, reais e pesos argentinos para dólar", () => {
    const c = { pygPorUsd: 7300, brlPorUsd: 5.4, arsPorUsd: 1450 };
    expect(paraUsd(145_000, "ARS", c)).toBe(100);
    expect(paraUsd(2_500_000, "PYG", c)).toBe(342.47);
    expect(paraUsd(540, "BRL", c)).toBe(100);
    expect(paraUsd(99.9, "USD", c)).toBe(99.9);
  });
});
