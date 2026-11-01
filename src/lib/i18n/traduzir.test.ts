import { describe, expect, it } from "vitest";
import { FRASES } from "./frases";
import { criarTradutor } from "./traduzir";

describe("tradutor das telas", () => {
  const es = criarTradutor(FRASES, "es");
  const en = criarTradutor(FRASES, "en");
  const de = criarTradutor(FRASES, "de");
  const it_ = criarTradutor(FRASES, "it");

  it("traduz frases inteiras mantendo os espaços em volta", () => {
    expect(en("Caminhões e planos")).toBe("Trucks and plans");
    expect(de("  Sair ")).toBe("  Abmelden ");
    expect(es("Lançar despesa")).toBe("Cargar gasto");
  });

  it("deixa como está o que não é do dicionário (nomes, placas, números)", () => {
    expect(en("SVM Trucks")).toBeNull();
    expect(en("AAB 123")).toBeNull();
    expect(en("1.234,5")).toBeNull();
  });

  it("preenche os modelos com os valores e traduz o que vier dentro", () => {
    expect(en("Asunción · 8 caminhões ·")).toBe("Asunción · 8 trucks ·");
    expect(de("Faltam 1.200 km.")).toBe("Noch 1.200 km.");
    expect(en("Excluir o frete ABC 123?")).toBe("Delete freight ABC 123?");
    expect(es("Já existe \"Pedir foto\" na fila para XYZ 999.")).toBe("Ya hay \"Pedir foto\" en cola para XYZ 999.");
  });

  it("troca a ordem dos valores quando o idioma pede", () => {
    // O alemão do modelo usa {0} e {1} na mesma ordem; o espanhol também. Confere que a posição é mantida.
    expect(de("Excluir despesa de USD 10,00 em 03/10/2026")).toBe("Ausgabe über USD 10,00 vom 03/10/2026 löschen");
  });

  it("traduz o nome do mês", () => {
    expect(en("março de 2026")).toBe("March 2026");
    expect(es("outubro de 2026")).toBe("octubre de 2026");
    expect(de("Custo por km · dezembro de 2026")).toBe("Kosten pro km · Dezember 2026");
  });

  it("traduz partes separadas por · e símbolos em volta", () => {
    expect(en("+ Lançar frete")).toBe("+ Log freight");
    expect(en("Ver vídeo →")).toBe("View video →");
    expect(en("12 caminhões")).toBe("12 trucks");
    expect(de("Mensal · Pagamento")).toBe("Monatlich · Zahlung");
    expect(en(". Ele digita o celular e o PIN.")).toBe(". They type their mobile number and PIN.");
  });

  it("traduz para o italiano", () => {
    expect(it_("Caminhões e planos")).toBe("Camion e piani");
    expect(it_("+ Lançar frete")).toBe("+ Registra nolo");
    expect(it_("Faltam 1.200 km.")).toBe("Mancano 1.200 km.");
    expect(it_("Custo por km · dezembro de 2026")).toBe("Costo per km · dicembre 2026");
  });

  it("toda frase tem as cinco colunas e os mesmos {n} do português", () => {
    const marcas = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join();
    for (const l of FRASES) {
      expect(l).toHaveLength(5);
      for (const t of l.slice(1)) expect(marcas(t), `${l[0]} → ${t}`).toBe(marcas(l[0]));
    }
  });
});
