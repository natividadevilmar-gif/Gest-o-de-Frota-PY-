import { describe, expect, it } from "vitest";
import { micPadrao, numeroMic, prazoDias } from "./micDta";

const base = {
  viagem: {
    data: new Date("2026-11-01T00:00:00Z"), origem: "Santa Rita", destino: "Paranaguá", paisOrigem: "PY", paisDestino: "BR", carga: "Soja", toneladas: 31,
    freteUsd: 2480, embarcador: "Cooperativa Colonias Unidas", documento: "CRT 04321", rotaKm: 980, kmCarregado: 990,
  },
  caminhao: { placa: "AABN 389", modelo: "Scania R450", ano: 2021 },
  cliente: { nome: "SVM Trucks", ruc: "80012345-6", endereco: "Ruta 6 km 4", cidade: "Santa Rita", pais: "PY" },
  numero: "PY26000001",
};

describe("micPadrao", () => {
  it("preenche com o frete, o caminhão e a transportadora", () => {
    const d = micPadrao(base);
    expect(d.porteador).toBe("SVM Trucks\nRuta 6 km 4, Santa Rita, Paraguay");
    expect(d.aduanaPartida).toBe("Santa Rita, Paraguay");
    expect(d.destinoFinal).toBe("Paranaguá, Brasil");
    expect(d.pesoBruto).toBe("31000");
    expect(d.flete).toBe("2480.00");
    expect(d.fechaEmision).toBe("01/11/2026");
    expect(d.documentosAnexos).toBe("CRT 04321, factura comercial");
    expect(d.rutaPlazo).toBe("Santa Rita – Paranaguá · 3 días");
    expect(d.transito).toBe("SI");
  });
  it("repete do último MIC os dados fixos do caminhão e da empresa", () => {
    const d = micPadrao({ ...base, anteriorCaminhao: { remolque: "AAXK 120", capacidad: "45", placa: "OUTRA" }, anteriorEmpresa: { permiso: "PY-1234", porteadorRuc: "" } });
    expect(d.remolque).toBe("AAXK 120");
    expect(d.capacidad).toBe("45");
    expect(d.placa).toBe("AABN 389");
    expect(d.permiso).toBe("PY-1234");
    expect(d.porteadorRuc).toBe("80012345-6");
  });
});

describe("número e prazo", () => {
  it("monta o número com país, ano e sequência", () => {
    expect(numeroMic("PY", 2026, 123)).toBe("PY26000123");
  });
  it("conta 450 km por dia, no mínimo 2 dias", () => {
    expect(prazoDias(100)).toBe(2);
    expect(prazoDias(1400)).toBe(4);
  });
});
