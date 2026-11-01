import { describe, expect, it } from "vitest";
import { faixaPedida, MAX_VIDEO_BYTES, validarArquivo } from "./registroCarga";

describe("validarArquivo", () => {
  it("aceita foto JPEG e vídeo webm com codecs", () => {
    expect(validarArquivo("foto", "image/jpeg", 300_000)).toEqual({ ok: true, formato: "image/jpeg" });
    expect(validarArquivo("video", "video/webm;codecs=vp8,opus", 1_000_000)).toEqual({ ok: true, formato: "video/webm" });
    expect(validarArquivo("video", "video/mp4", 1_000_000)).toEqual({ ok: true, formato: "video/mp4" });
  });
  it("recusa formato trocado, vazio ou grande demais", () => {
    expect(validarArquivo("foto", "video/mp4", 10).ok).toBe(false);
    expect(validarArquivo("video", "image/png", 10).ok).toBe(false);
    expect(validarArquivo("audio", "audio/ogg", 10).ok).toBe(false);
    expect(validarArquivo("foto", "image/jpeg", 0).ok).toBe(false);
    expect(validarArquivo("video", "video/mp4", MAX_VIDEO_BYTES + 1).ok).toBe(false);
  });
});

describe("faixaPedida", () => {
  it("lê as formas do cabeçalho Range", () => {
    expect(faixaPedida("bytes=0-1", 1000)).toEqual({ inicio: 0, fim: 1 });
    expect(faixaPedida("bytes=100-", 1000)).toEqual({ inicio: 100, fim: 999 });
    expect(faixaPedida("bytes=-200", 1000)).toEqual({ inicio: 800, fim: 999 });
    expect(faixaPedida("bytes=900-5000", 1000)).toEqual({ inicio: 900, fim: 999 });
  });
  it("ignora pedido ausente ou fora do arquivo", () => {
    expect(faixaPedida(null, 1000)).toBeNull();
    expect(faixaPedida("bytes=2000-", 1000)).toBeNull();
    expect(faixaPedida("bytes=5-2", 1000)).toBeNull();
    expect(faixaPedida("items=0-1", 1000)).toBeNull();
  });
});
