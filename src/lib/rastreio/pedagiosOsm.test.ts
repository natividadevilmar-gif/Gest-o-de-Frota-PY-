import { describe, expect, it, vi } from "vitest";
import { agruparCabines, cabinesNaRota, casarComCadastro } from "./pedagiosOsm";

describe("pedágios do OpenStreetMap", () => {
  it("junta as cabines da mesma praça", () => {
    const g = agruparCabines([
      { lat: -25.5, lng: -49.0, nome: "Praça X", rodovia: null },
      { lat: -25.5005, lng: -49.0004, nome: null, rodovia: "BR-277" },
      { lat: -25.3, lng: -50.0, nome: null, rodovia: null },
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ nome: "Praça X", rodovia: "BR-277" });
  });

  it("liga cada praça à do cadastro mais perto e separa as que faltam", () => {
    const achadas = [
      { lat: -25.08, lng: -53.3, nome: null, rodovia: null }, // perto de Cascavel (cadastro com coordenada aproximada)
      { lat: -25.53, lng: -49.01, nome: "Pedágio São José dos Pinhais", rodovia: "BR-277" },
    ];
    const cadastro = [
      { id: "cascavel", lat: -25.03, lng: -53.35 },
      { id: "ceu-azul", lat: -25.15, lng: -53.85 },
    ];
    const r = casarComCadastro(achadas, cadastro);
    expect(r.ligadas.map((l) => l.id)).toEqual(["cascavel"]);
    expect(r.novas.map((n) => n.nome)).toEqual(["Pedágio São José dos Pinhais"]);
  });
});

describe("cabinesNaRota", () => {
  it("lê o Overpass, junta as cabines e põe na ordem da rota", async () => {
    const rota: [number, number][] = [[-25.0, -53.4], [-25.2, -52.0], [-25.5, -49.0]];
    const elementos = [
      { lat: -25.5301, lon: -49.0101, tags: { name: "Praça São José", ref: "BR-277" } },
      { lat: -25.0301, lon: -53.3501, tags: {} },
      { lat: -25.0305, lon: -53.3509, tags: { ref: "BR-277" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ elements: elementos }))));
    const r = await cabinesNaRota(rota);
    vi.unstubAllGlobals();
    expect(r?.map((c) => c.rodovia)).toEqual(["BR-277", "BR-277"]);
    expect(r?.[1].nome).toBe("Praça São José");
  });

  it("devolve null quando o Overpass não responde", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 504 })));
    expect(await cabinesNaRota([[-25, -53], [-25.5, -49]])).toBeNull();
    vi.unstubAllGlobals();
  });
});
