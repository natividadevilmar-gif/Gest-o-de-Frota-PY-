import { describe, expect, it } from "vitest";
import { ArquivoCamera, CMD, formatoArquivo, lerInicioCamera, lerMensagemCamera, montarInicioCamera, montarPedacos } from "./dualcam";

describe("câmeras DualCam", () => {
  it("lê o pacote de início com o IMEI", () => {
    const m = lerMensagemCamera(montarInicioCamera("352093081452251"));
    expect(m?.cmd).toBe(CMD.fechar);
    expect(lerInicioCamera(m!.dados)).toEqual({ protocolo: 5, imei: "352093081452251", ajustes: 0x0f });
  });

  it("espera a mensagem inteira", () => {
    expect(lerMensagemCamera(montarInicioCamera("352093081452251").subarray(0, 10))).toBeNull();
  });

  it("remonta o arquivo conferindo o CRC encadeado", () => {
    const foto = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(2500, 7)]);
    const pedacos = montarPedacos(foto);
    expect(pedacos).toHaveLength(3);
    const arq = new ArquivoCamera(pedacos.length);
    for (const p of pedacos) expect(arq.receber(lerMensagemCamera(p)!.dados)).toBe(true);
    expect(arq.completo).toBe(true);
    expect(arq.conteudo().equals(foto)).toBe(true);
    expect(formatoArquivo(arq.conteudo())).toBe("image/jpeg");
  });

  it("recusa pedaço corrompido", () => {
    const p = lerMensagemCamera(montarPedacos(Buffer.alloc(100, 1))[0])!.dados;
    p[5] ^= 0xff;
    expect(new ArquivoCamera(1).receber(p)).toBe(false);
  });
});
