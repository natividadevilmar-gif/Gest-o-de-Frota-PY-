import { describe, expect, it } from "vitest";
import { crtPadrao, numeroCrt, totalGastos } from "./crt";

const base = {
  viagem: {
    data: new Date("2026-11-01T00:00:00Z"), origem: "Santa Rita", destino: "Paranaguá", paisOrigem: "PY", paisDestino: "BR", carga: "Soja", toneladas: 31,
    freteUsd: 2480, embarcador: "Cooperativa Colonias Unidas", documento: null, rotaKm: 980, kmCarregado: 990,
  },
  cliente: { nome: "SVM Trucks", ruc: "80012345-6", endereco: "Ruta 6 km 4", cidade: "Santa Rita", pais: "PY" },
  numero: "PY0815000001",
};

describe("numeroCrt", () => {
  it("usa o número do documento do frete quando já existe", () => {
    expect(numeroCrt("PY", "PY-ATIT 0815/2025", 7, "CRT 04321")).toBe("04321");
    expect(numeroCrt("PY", null, 7, "crt nº PY.0815.00012")).toBe("PY.0815.00012");
  });
  it("monta com país, licença e sequência", () => {
    expect(numeroCrt("PY", "PY-ATIT 0815/2025", 12, null)).toBe("PY0815000012");
    expect(numeroCrt("BR", "", 3)).toBe("BR0000000003");
  });
});

describe("crtPadrao", () => {
  it("preenche com o frete e a transportadora", () => {
    const d = crtPadrao(base);
    expect(d.remitente).toBe("Cooperativa Colonias Unidas");
    expect(d.porteador).toBe("SVM Trucks · RUC 80012345-6\nRuta 6 km 4, Santa Rita, Paraguay");
    expect(d.lugarCarga).toBe("Santa Rita, Paraguay, 01/11/2026");
    expect(d.lugarEntrega).toBe("Paranaguá, Brasil · plazo 3 días");
    expect(d.pesoBruto).toBe("31000");
    expect(d.flete).toBe("2480.00");
    expect(d.pagador).toBe("REMITENTE");
  });
  it("repete destinatário do último CRT do mesmo remetente, e só dele", () => {
    const anterior = { remitente: "Cooperativa Colonias Unidas\nAv. Paraguay 100", destinatario: "Cargill Agrícola", incoterm: "FCA" };
    const d = crtPadrao({ ...base, anteriorRemetente: anterior, anteriorEmpresa: { permiso: "PY-0815" }, permisoMic: "PY-9999" });
    expect(d.remitente).toBe("Cooperativa Colonias Unidas\nAv. Paraguay 100");
    expect(d.destinatario).toBe("Cargill Agrícola");
    expect(d.incoterm).toBe("FCA");
    expect(d.permiso).toBe("PY-0815");
    const outro = crtPadrao({ ...base, anteriorRemetente: { ...anterior, remitente: "Agrofértil S.A." }, permisoMic: "PY-9999" });
    expect(outro.destinatario).toBe("");
    expect(outro.permiso).toBe("PY-9999");
  });
});

describe("totalGastos", () => {
  it("soma frete, seguro e outros em qualquer formato", () => {
    expect(totalGastos({ flete: "2480.00", seguro: "7,44", otros: "1.000,50" })).toBe(3487.94);
    expect(totalGastos({ flete: "", seguro: "", otros: "" })).toBe(0);
  });
});
