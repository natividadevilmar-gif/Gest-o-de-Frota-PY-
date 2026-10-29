import { describe, expect, it } from "vitest";
import { diasDoParaguai } from "../telemetria/sincronizar";
import { credenciaisWialon, imeisPelaPlaca, ligarUnidades, paraPosicaoWialon, sensoresDiesel, telemetriaDaMensagem } from "./wialon";

const pos = { x: -57.5, y: -25.3, s: 72.4, c: 181, sc: 14 };

describe("mensagens do Wialon", () => {
  it("lê posição e parâmetros Teltonika (io_<código>)", () => {
    const l = paraPosicaoWialon({ t: 1_761_400_000, pos, p: { io_239: 1, io_87: 1_250_500, io_83: 6002, io_84: 4105, io_85: 1450, io_253: 2 } })!;
    expect(l).toEqual({
      data: new Date(1_761_400_000_000), lat: -25.3, lng: -57.5, velocidadeKmh: 72, direcao: 181, satelites: 14,
      ignicao: true, odometroKm: 1250.5, litrosTotal: 600.2, nivelCombustivelL: 410.5, rpm: 1450, evento: "freada",
    });
  });
  it("sem CAN usa o odômetro do GPS e deixa o resto vazio", () => {
    const l = paraPosicaoWialon({ t: 1, pos, p: { io_16: 5000, io_255: 95 } })!;
    expect(l).toMatchObject({ odometroKm: 5, litrosTotal: null, ignicao: null, rpm: null, evento: "excesso" });
  });
  it("lê os nomes de CAN de outras marcas, já em km e litros", () => {
    const l = paraPosicaoWialon({ t: 1, pos, p: { can_mileage: 812_345.6, can_fuel_used: 98_765.4, can_rpm: 1300, ign: 1, fuel_level: 230 } })!;
    expect(l).toMatchObject({ odometroKm: 812_345.6, litrosTotal: 98_765.4, rpm: 1300, ignicao: true, nivelCombustivelL: 230 });
    expect(paraPosicaoWialon({ t: 1, pos, p: { mileage: 812_345_600 } })!.odometroKm).toBe(812_345.6);
  });
  it("diz o que a unidade manda de telemetria", () => {
    expect(telemetriaDaMensagem({ t: 1, pos, p: { io_87: 1, io_85: 900, pwr_ext: 24.1 } })).toEqual({
      odometro: true, diesel: false, tanque: false, rpm: true, ignicao: false, eventos: false, parametros: ["io_85", "io_87", "pwr_ext"],
    });
    expect(telemetriaDaMensagem(null).parametros).toEqual([]);
  });
  it("separa as posições pelos dias do Paraguai (UTC-3)", () => {
    const dias = diasDoParaguai([new Date("2026-10-28T02:59:00Z"), new Date("2026-10-28T03:00:00Z"), new Date("2026-10-27T12:00:00Z")]);
    expect(dias.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-10-27", "2026-10-28"]);
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
  it("usa o token do cadastro, ou o das variáveis para os clientes listados", () => {
    const avm = { nome: "AVM Truck", wialonToken: null, wialonHost: null };
    expect(credenciaisWialon({ ...avm, wialonToken: "t1", wialonHost: "hst-api.wialon.us" }, {})).toEqual({ token: "t1", host: "hst-api.wialon.us" });
    expect(credenciaisWialon(avm, {})).toBeNull();
    const env = { WIALON_TOKEN: "t2", WIALON_CLIENTES: " AVM Truck , Outro " };
    expect(credenciaisWialon(avm, env)).toEqual({ token: "t2", host: undefined });
    expect(credenciaisWialon({ ...avm, nome: "Terceiro" }, env)).toBeNull();
    // Depois da troca de nome, a lista antiga continua valendo.
    expect(credenciaisWialon({ ...avm, nome: "SVM Trucks" }, env)).toEqual({ token: "t2", host: undefined });
  });
  it("acha o IMEI pela placa no nome da unidade", () => {
    const r = imeisPelaPlaca(
      [{ placa: "AAFR 218" }, { placa: "AAGT 507" }, { placa: "AAHM 331" }],
      [
        { id: 1, nm: "AAFR-218", uid: "356307042441013" },
        { id: 2, nm: "Scania R450 - AAGT507", uid: "356307042441014" },
        { id: 3, nm: "AAHM 331", uid: "123" },
      ],
    );
    expect(r.map((x) => x.unidade?.uid ?? null)).toEqual(["356307042441013", "356307042441014", null]);
  });
});

describe("sensores de diesel do Wialon", () => {
  const pos = { x: -55, y: -26, s: 60, c: 90, sc: 12 };
  it("usa o nível e o consumo calculados pelos sensores da unidade", () => {
    const l = paraPosicaoWialon({ t: 1, pos, p: { adc1: 3.2 }, sens: { nivelL: 412.5, consumoL: 15_320.4 } })!;
    expect(l.nivelCombustivelL).toBe(412.5);
    expect(l.litrosTotal).toBe(15_320.4);
  });
  it("acha os sensores pelo tipo e mostra na central", () => {
    const u = { sens: { "1": { id: 1, n: "Tanque", t: "fuel level", p: "adc1" }, "2": { id: 2, n: "Consumo", t: "absolute fuel consumption", p: "can_fuel" } } };
    expect(sensoresDiesel(u)).toEqual({ nivel: 1, consumo: 2 });
    const t = telemetriaDaMensagem({ t: 1, pos, p: { adc1: 3.2 } }, u);
    expect(t.tanque && t.diesel).toBe(true);
    expect(t.parametros).toContain('sensor "Tanque" (fuel level: adc1)');
  });
});
