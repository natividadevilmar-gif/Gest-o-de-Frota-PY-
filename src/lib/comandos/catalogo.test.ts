import { describe, expect, it } from "vitest";
import { efeitoNoMotor, podeEnviar, textoComando } from "./catalogo";

describe("comandos", () => {
  it("o bloqueio espera o caminhão quase parar", () => {
    expect(podeEnviar("bloquear", 72)).toBe(false);
    expect(podeEnviar("bloquear", 8)).toBe(true);
    expect(podeEnviar("posicao", 90)).toBe(true);
  });
  it("monta o texto de cada comando", () => {
    expect(textoComando("bloquear")).toBe("setdigout 1");
    expect(textoComando("foto", { camera: "cabine" })).toBe("camreq:1,2");
    expect(textoComando("video", { agora: new Date(1_700_000_010_000) })).toBe("camreq:0,1,1700000000,10");
    expect(textoComando("livre", { livre: "  getver " })).toBe("getver");
  });
  it("só bloquear e desbloquear mudam o motor", () => {
    expect(efeitoNoMotor("bloquear")).toBe(true);
    expect(efeitoNoMotor("desbloquear")).toBe(false);
    expect(efeitoNoMotor("posicao")).toBeNull();
  });
});
