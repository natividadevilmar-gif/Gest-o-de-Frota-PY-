import { describe, expect, it } from "vitest";
import { posicaoDaDica } from "./mapaBase";

// Mapa de 800 x 260 px e quadro de 240 x 230 px (o tamanho do quadro com telemetria).
const [L, A, W, H] = [800, 260, 240, 230];

describe("posicaoDaDica", () => {
  it("abre em cima quando cabe", () => {
    expect(posicaoDaDica(400, 600, L, 700, W, H)).toEqual(["top", [0, -10]]);
  });

  it("abre embaixo quando só cabe embaixo", () => {
    expect(posicaoDaDica(400, 20, L, 700, W, H)).toEqual(["bottom", [0, 14]]);
  });

  it("caminhão embaixo num mapa baixo: abre de lado sem cortar o topo nem a base", () => {
    const [dir, [dx, dy]] = posicaoDaDica(500, 235, L, A, W, H);
    expect(dir).toBe("left");
    expect(dx).toBe(-12);
    const topo = 235 + dy - H / 2;
    expect(topo).toBeGreaterThanOrEqual(6);
    expect(topo + H).toBeLessThanOrEqual(A - 6);
  });

  it("caminhão no alto à esquerda: abre para a direita, empurrado para baixo", () => {
    const [dir, [, dy]] = posicaoDaDica(50, 10, L, A, W, H);
    expect(dir).toBe("right");
    expect(10 + dy - H / 2).toBeGreaterThanOrEqual(6);
  });

  it("mapa mais baixo que o quadro: o topo (placa) fica visível", () => {
    const [, [, dy]] = posicaoDaDica(500, 150, L, 180, W, H);
    expect(150 + dy - H / 2).toBe(6);
  });
});
