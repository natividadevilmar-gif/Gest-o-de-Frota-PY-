import { describe, expect, it } from "vitest";
import { filtroClientesWialon, ligarUnidades, paraPosicaoWialon } from "./wialon";

const pos = { x: -57.5, y: -25.3, s: 72.4, c: 181, sc: 14 };

describe("mensagens do Wialon", () => {
  it("lê posição e parâmetros Teltonika (io_<código>)", () => {
    const l = paraPosicaoWialon({ t: 1_761_400_000, pos, p: { io_239: 1, io_87: 1_250_500, io_83: 6002, io_85: 1450, io_253: 2 } })!;
    expect(l).toEqual({
      data: new Date(1_761_400_000_000), lat: -25.3, lng: -57.5, velocidadeKmh: 72, direcao: 181, satelites: 14,
      ignicao: true, odometroKm: 1250.5, litrosTotal: 600.2, rpm: 1450, evento: "freada",
    });
  });
  it("sem CAN usa o odômetro do GPS e deixa o resto vazio", () => {
    const l = paraPosicaoWialon({ t: 1, pos, p: { io_16: 5000, io_255: 95 } })!;
    expect(l).toMatchObject({ odometroKm: 5, litrosTotal: null, ignicao: null, rpm: null, evento: "excesso" });
  });
  it("ignora mensagem sem posição", () => {
    expect(paraPosicaoWialon({ t: 1, pos: null })).toBeNull();
  });
  it("liga caminhão e unidade pelo IMEI", () => {
    const pares = ligarUnidades(
      [{ placa: "AAFR218", rastreadorId: "356307042441013" }, { placa: "XYZ", rastreadorId: null }],
      [{ id: 7, nm: "Scania 1", uid: "356307042441013" }, { id: 8, nm: "XYZ", uid: "111" }],
    );
    expect(pares.map((p) => [p.caminhao.placa, p.unidade.id])).toEqual([["AAFR218", 7]]);
  });
  it("limita aos clientes configurados", () => {
    expect(filtroClientesWialon(" AVM Truck , Outro ")).toEqual({ cliente: { nome: { in: ["AVM Truck", "Outro"], mode: "insensitive" } } });
    expect(filtroClientesWialon("")).toEqual({});
  });
});
