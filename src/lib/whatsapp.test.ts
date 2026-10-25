import { describe, expect, it } from "vitest";
import { juntarNumero, linkWhatsapp, mensagemOcorrencia, mensagemPedagio, numeroInternacional } from "./whatsapp";

describe("WhatsApp do motorista", () => {
  it("põe o código do país no celular local", () => {
    expect(numeroInternacional("0981 123 456", "PY")).toBe("595981123456");
    expect(numeroInternacional("45 99912-3456", "BR")).toBe("5545999123456");
    expect(numeroInternacional("+595 981 123456", "BR")).toBe("595981123456");
    expect(numeroInternacional("595981123456", "PY")).toBe("595981123456");
    // DDD 55 do Rio Grande do Sul: número local, não código do país.
    expect(numeroInternacional("55 99912-3456", "BR")).toBe("5555999123456");
    expect(juntarNumero("55", "45 99912-3456")).toBe("5545999123456");
    expect(juntarNumero("54", "011 1234-5678")).toBe("541112345678");
    expect(juntarNumero("595", "+595 981 123456")).toBe("595981123456");
  });
  it("monta a cobrança no idioma do motorista", () => {
    const o = { nome: "Nelson Duarte", placa: "AABN 389", detalhe: "Passou por Iruña, Trinidad em 24/10/2026 (previsto USD 19,20) e lançou USD 0,00." };
    expect(mensagemPedagio(o, "es")).toContain("Hola Nelson, el camión AABN 389 pasó por el peaje Iruña, Trinidad el 24/10/2026 (previsto USD 19,20)");
    expect(mensagemPedagio(o, "pt")).toContain("URGENTE");
    expect(linkWhatsapp("595981123456", "a b")).toBe("https://wa.me/595981123456?text=a%20b");
  });
});

describe("texto pronto por alerta", () => {
  it("excesso traz a velocidade", () => {
    const t = mensagemOcorrencia({ tipo: "excesso", titulo: "AABN 389 a 97 km/h", detalhe: "", placa: "AABN 389", nome: "Nelson Duarte" }, "es");
    expect(t).toContain("Hola Nelson, el camión AABN 389 está a 97 km/h");
  });
  it("tipo desconhecido usa o texto genérico", () => {
    expect(mensagemOcorrencia({ tipo: "outro", titulo: "X", detalhe: "Y", placa: "P", nome: null }, "pt")).toContain("sobre o caminhão P: X. Y");
  });
});
