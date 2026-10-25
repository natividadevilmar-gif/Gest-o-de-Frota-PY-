import { describe, expect, it } from "vitest";
import { confirmacao, lerImei, lerPacote, montarImei, montarPacote, paraPosicao, IO, type Registro } from "./teltonika";

// Exemplo de Codec 8 da documentação da Teltonika.
const EXEMPLO_CODEC8 =
  "000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7CF";

describe("protocolo Teltonika", () => {
  it("lê o exemplo oficial de Codec 8", () => {
    const r = lerPacote(Buffer.from(EXEMPLO_CODEC8, "hex"));
    expect(r?.registros).toHaveLength(1);
    const reg = r!.registros[0];
    expect(reg.data.toISOString()).toBe("2019-06-10T10:04:46.000Z");
    expect(reg.eventoIo).toBe(1);
    expect(reg.io.get(0x15)).toBe(3n);
    expect(reg.io.get(0xf1)).toBe(0x601an);
    expect(reg.io.get(0x4e)).toBe(0n);
    expect(r!.usados).toBe(EXEMPLO_CODEC8.length / 2);
  });

  it("espera o pacote inteiro antes de ler", () => {
    const buf = Buffer.from(EXEMPLO_CODEC8, "hex");
    expect(lerPacote(buf.subarray(0, 30))).toBeNull();
  });

  it("recusa pacote com CRC errado", () => {
    const buf = Buffer.from(EXEMPLO_CODEC8, "hex");
    buf[buf.length - 1] ^= 0xff;
    expect(() => lerPacote(buf)).toThrow(/CRC/);
  });

  it("lê o IMEI e responde com o número de registros", () => {
    expect(lerImei(montarImei("356307042441013"))).toEqual({ imei: "356307042441013", usados: 17 });
    expect(confirmacao(3).toString("hex")).toBe("00000003");
  });

  it("ida e volta em Codec 8 Extended, com dados da CAN", () => {
    const reg: Registro = {
      data: new Date("2026-10-25T13:00:00Z"), prioridade: 0, lat: -25.2637, lng: -57.5759, altitude: 120,
      direcao: 95, satelites: 12, velocidadeKmh: 82, eventoIo: IO.conducao,
      io: new Map<number, bigint | Buffer>([[IO.ignicao, 1n], [IO.odometroCan, 412345678n], [IO.combustivelCan, 1534567n], [IO.rpm, 1450n], [IO.conducao, 2n]]),
    };
    const lido = lerPacote(montarPacote([reg, { ...reg, eventoIo: 0 }]))!;
    expect(lido.registros).toHaveLength(2);
    const p = paraPosicao(lido.registros[0]);
    expect(p).toMatchObject({ lat: -25.2637, lng: -57.5759, velocidadeKmh: 82, ignicao: true, odometroKm: 412345.678, litrosTotal: 153456.7, rpm: 1450, evento: "freada" });
    expect(paraPosicao(lido.registros[1]).evento).toBeNull();
  });
});

import { comprimentoKm, posicaoDemo, ROTAS, trajetoDemo } from "./rotas";

describe("rotas de demonstração", () => {
  it("as rotas têm tamanhos reais", () => {
    expect(comprimentoKm(ROTAS[0].pontos)).toBeGreaterThan(280);
    expect(comprimentoKm(ROTAS[0].pontos)).toBeLessThan(360);
  });
  it("o caminhão fica parado de madrugada e anda durante o dia", () => {
    expect(posicaoDemo("cam1", new Date("2026-10-25T05:00:00Z")).ignicao).toBe(false);
    const dia = trajetoDemo("cam1", new Date("2026-10-25T00:00:00Z"), new Date("2026-10-25T23:00:00Z"));
    expect(dia.length).toBeGreaterThan(40);
    expect(dia.some((p) => p.velocidadeKmh > 0)).toBe(true);
  });
});
