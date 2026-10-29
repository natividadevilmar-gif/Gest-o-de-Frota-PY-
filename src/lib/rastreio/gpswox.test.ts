import { afterEach, describe, expect, it, vi } from "vitest";
import { Gpswox, ligarAparelhos, paraPosicaoGpswox, type AparelhoGpswox } from "./gpswox";

const aparelho = (x: Partial<AparelhoGpswox>): AparelhoGpswox => ({
  id: 1, name: "AAEA-700 Scania", lat: -25.3, lng: -57.6, speed: 72.4, course: 180, timestamp: 1_761_700_000,
  device_data: { imei: "860896051455350", plate_number: "AAEA700" }, sensors: [], ...x,
});

describe("CUSAT (GPSWOX)", () => {
  it("converte a última posição e os sensores", () => {
    const l = paraPosicaoGpswox(aparelho({
      sensors: [
        { type: "acc", name: "Ignición", val: true, value: "Encendido" },
        { type: "odometer", name: "Odómetro", value: "983147 km" },
        { type: "fuel_tank", name: "Combustible", value: "412,5 L" },
      ],
    }))!;
    expect(l).toMatchObject({ lat: -25.3, lng: -57.6, velocidadeKmh: 72, direcao: 180, ignicao: true, odometroKm: 983147, nivelCombustivelL: 412.5 });
    expect(l.data.toISOString()).toBe(new Date(1_761_700_000_000).toISOString());
    expect(paraPosicaoGpswox(aparelho({ lat: 0, lng: 0 }))).toBeNull();
    expect(paraPosicaoGpswox(aparelho({ sensors: [{ name: "ACC", value: "Off" }] }))!.ignicao).toBe(false);
  });
  it("liga pelo IMEI e, sem IMEI no cadastro, pela placa", () => {
    const a = aparelho({});
    const b = aparelho({ id: 2, name: "Brendon 02 - ABC 123", device_data: { imei: "860896051455351" } });
    const r = ligarAparelhos([
      { placa: "X", rastreadorId: "860896051455350" },
      { placa: "ABC-123", rastreadorId: null },
      { placa: "ZZZ999", rastreadorId: null },
    ], [a, b]);
    expect(r.map((x) => x.aparelho?.id ?? null)).toEqual([1, 2, null]);
  });
  describe("API", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("entra com e-mail e senha e lê os aparelhos dos grupos", async () => {
      const f = vi.fn(async (url: string) => {
        if (url.endsWith("/api/login")) return new Response(JSON.stringify({ status: 1, user_api_hash: "chave" }));
        return new Response(JSON.stringify([{ id: 0, title: "Sin grupo", items: [aparelho({})] }, { id: 3, title: "Brendon", items: [aparelho({ id: 2 })] }]));
      });
      vi.stubGlobal("fetch", f);
      const hash = await Gpswox.entrar("gps.cusat.com.py", "a@b.com", "x");
      expect(hash).toBe("chave");
      expect((await new Gpswox(hash).aparelhos()).map((x) => x.id)).toEqual([1, 2]);
      expect(String(f.mock.calls[1][0])).toContain("user_api_hash=chave");
    });
    it("senha errada vira mensagem clara", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: 0, message: "Datos incorrectos" }), { status: 401 })));
      await expect(Gpswox.entrar("gps.cusat.com.py", "a@b.com", "x")).rejects.toThrow("Datos incorrectos");
    });
  });
});
