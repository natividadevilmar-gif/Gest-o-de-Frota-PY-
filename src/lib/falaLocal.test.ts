import { describe, expect, it } from "vitest";
import { lerFalaLocal } from "./falaLocal";

describe("fala sem a Claude API", () => {
  it("entende valor com mil e moeda", () => {
    expect(lerFalaLocal("Pedágio 45 mil guaranis")).toEqual({ categoria: "PEDAGIO", valor: 45000, moeda: "PYG", litros: null });
  });
  it("separa litros do valor", () => {
    expect(lerFalaLocal("diesel 300 litros 2.145.000")).toMatchObject({ categoria: "DIESEL", valor: 2145000, litros: 300 });
  });
  it("entende milhões e meio por extenso", () => {
    expect(lerFalaLocal("manutenção dois milhões e meio")).toMatchObject({ categoria: "MANUTENCAO", valor: 2_500_000 });
  });
  it("pesos argentinos com centavos", () => {
    expect(lerFalaLocal("almoço 12.500,50 pesos")).toMatchObject({ categoria: "ALIMENTACAO", valor: 12500.5, moeda: "ARS" });
  });
  it("borracharia em dólares", () => {
    expect(lerFalaLocal("borracharia 120 dólares")).toMatchObject({ categoria: "PNEUS", valor: 120, moeda: "USD" });
  });
  it("soma milhões e milhares ditos em sequência", () => {
    expect(lerFalaLocal("diesel 300 litros 2 milhões 145 mil").valor).toBe(2_145_000);
    expect(lerFalaLocal("dois milhões e 500 mil").valor).toBe(2_500_000);
    expect(lerFalaLocal("1 milhão 200 mil 500").valor).toBe(1_200_500);
  });
  it("só o valor", () => {
    expect(lerFalaLocal("85000")).toMatchObject({ categoria: "OUTROS", valor: 85000, moeda: null });
  });
});

import { lerNotaLocal } from "./falaLocal";

describe("nota lida no celular", () => {
  it("nota de posto paraguaio", () => {
    const n = lerNotaLocal(`ESTACION COPETROL KM 30
RUC 80012345-6  TIMBRADO 12345678
Fecha 22/10/2026 14:32
GASOIL TIPO III
300,00 L x 7.150
SUBTOTAL 2.145.000
TOTAL Gs. 2.145.000
IVA 10% 195.000`);
    expect(n).toMatchObject({ categoria: "DIESEL", valor: 2145000, moeda: "PYG", litros: 300, data: "2026-10-22", posto: "ESTACION COPETROL KM 30" });
  });
  it("sem linha de total usa o maior valor", () => {
    expect(lerNotaLocal("Restaurante El Paso\nAlmuerzo 45.000\nGaseosa 8.000\nGs").valor).toBe(45000);
  });
  it("fatura com o total numa caixa, longe do rótulo", () => {
    const texto = require("node:fs").readFileSync(__dirname + "/__fixtures__/fatura-sanepar.txt", "utf8");
    expect(lerNotaLocal(texto, new Date("2026-10-24T12:00:00Z"))).toMatchObject({ valor: 471.65, moeda: "BRL", data: "2026-10-23" });
  });
  it("total na linha de baixo do rótulo", () => {
    expect(lerNotaLocal("TOTAL A PAGAR\nR$ 471,65\nConsumo 254,94\nLeitura 01160").valor).toBe(471.65);
  });
  it("cupom com desconto: vale o valor a pagar, com centavos", () => {
    const cupom = `035 07891024132371 CR.DENTAL COLGATE T.ACAO MENTA 180G
2UN X 11,59 F1 23,18
desconto item 035 -3,38
036 07891021002127 FILTRO DE PAPEL BRIGITTA 103 C/30
1UN X 3,89 T19,50% 3,89
QTD. TOTAL DE ITENS 36
VALOR TOTAL R$ 430,39
DESCONTO R$ -4,18
VALOR A PAGAR R$ 426.21
Cartao de Credito R$ 426,21
NFC-e 000384746 Serie 109 25/10/2026 08:57:54
Tributos Incid. Lei Federal 12.741/12 - R$ 111,15
TOTAL DESCONTOS: 4,18`;
    expect(lerNotaLocal(cupom, new Date("2026-10-25T15:00:00Z"))).toMatchObject({ valor: 426.21, moeda: "BRL", data: "2026-10-25" });
  });
  it("sem 'a pagar', desconta o desconto do total", () => {
    expect(lerNotaLocal("VALOR TOTAL R$ 430,39\nDESCONTO R$ -4,18\nCartao R$").valor).toBe(426.21);
  });
  it("centavos com ponto não viram número inteiro", () => {
    expect(lerNotaLocal("TOTAL R$ 426.21").valor).toBe(426.21);
  });
  it("nota argentina em pesos", () => {
    expect(lerNotaLocal("Gomeria Ruta 14\nCUIT 30-12345678-9\nReparacion cubierta\nTOTAL $ 25.500,00")).toMatchObject({ categoria: "PNEUS", valor: 25500, moeda: "ARS" });
  });
});

describe("fala em espanhol", () => {
  it("entende gastos ditos em espanhol", () => {
    expect(lerFalaLocal("almuerzo 60 mil guaraníes")).toMatchObject({ categoria: "ALIMENTACAO", valor: 60000, moeda: "PYG" });
    expect(lerFalaLocal("combustible 300 litros 2 millones 145 mil")).toMatchObject({ categoria: "DIESEL", valor: 2_145_000, litros: 300 });
    expect(lerFalaLocal("peaje 45 mil")).toMatchObject({ categoria: "PEDAGIO", valor: 45000 });
  });
});
